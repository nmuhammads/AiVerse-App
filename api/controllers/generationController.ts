import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import crypto from 'crypto'
import { Request, Response } from 'express'

// Типы для запросов к Kie.ai
import { uploadImageFromBase64, uploadImageFromUrl, createThumbnail } from '../services/r2Service.js'
import { processVideoForKling, deleteFromR2, isBase64Video } from '../services/videoProcessingService.js'
import { tg } from './telegramController.js'
import { createNotification, getUserNotificationSettings } from './notificationController.js'
import { createPiapiTask, pollPiapiTask, checkPiapiTask } from '../services/piapiService.js'
import { getAppConfig, setAppConfig } from '../services/supabaseService.js'
import { generateNanoGPTImage } from '../services/nanoImageService.js'
import { logBalanceChange, safeRefund } from '../services/balanceAuditService.js'
import { checkMyApiAvailability, generateWithMyApi, isMyApiConfigured, isMyApiEnabledForModel } from '../services/myApiService.js'

interface KieAIRequest {
  model: string
  prompt: string
  aspect_ratio?: string
  images?: string[]
  negative_prompt?: string
  meta?: {
    generationId: number
    tokens: number
    userId: number
  }
  resolution?: string
  google_search?: boolean
  // Параметры для видео (Seedance 1.5 Pro)
  video_duration?: '4' | '8' | '12'
  video_resolution?: '480p' | '720p'
  fixed_lens?: boolean
  generate_audio?: boolean
  // Параметры для GPT Image 1.5
  gpt_image_quality?: 'medium' | 'high'
  // Параметры для Kling AI
  kling_duration?: '5' | '10'
  kling_sound?: boolean
  kling_mc_quality?: '720p' | '1080p'
  character_orientation?: 'image' | 'video'
  video_url?: string
}

interface KieAIResponse {
  images?: string[]
  inputImages?: string[]
  error?: string
  timeout?: boolean  // Таймаут без ошибки — генерация продолжается
}

// Конфигурация моделей
const MODEL_CONFIGS = {
  flux: { kind: 'flux-kontext' as const, model: 'flux-kontext-pro' },
  seedream4: { kind: 'jobs' as const, model: 'bytedance/seedream-v4-text-to-image' },
  'seedream4-5': { kind: 'jobs' as const, model: 'bytedance/seedream-4-5-text-to-image' },
  nanobanana: { kind: 'jobs' as const, model: 'google/nano-banana-edit' },
  'nanobanana-pro': { kind: 'jobs' as const, model: 'nano-banana-pro' },
  'nanobanana-2': { kind: 'jobs' as const, model: 'nano-banana-2' },
  'qwen-edit': { kind: 'jobs' as const, model: 'qwen/text-or-image' },
  'seedance-1.5-pro': { kind: 'jobs' as const, model: 'bytedance/seedance-1.5-pro', mediaType: 'video' as const },
  'gpt-image-1.5': { kind: 'jobs' as const, model: 'gpt-image/1.5-text-to-image', dbModel: 'gptimage1.5' },
  'test-model': { kind: 'test' as const, model: 'test-model' }, // Тестовая модель (не вызывает API)
  // Kling AI v2.6 модели
  'kling-t2v': { kind: 'jobs' as const, model: 'kling-2.6/text-to-video', mediaType: 'video' as const },
  'kling-i2v': { kind: 'jobs' as const, model: 'kling-2.6/image-to-video', mediaType: 'video' as const },
  'kling-mc': { kind: 'jobs' as const, model: 'kling-2.6/motion-control', mediaType: 'video' as const },
  'qwen-image': { kind: 'nanogpt' as const, model: 'qwen-image' },
}

// Маппинг внешних API имён моделей (от Kie.ai) к внутренним именам
// Используется для генераций созданных другими ботами
const EXTERNAL_MODEL_MAP: Record<string, string> = {
  'kling-2.6/motion-control': 'kling-mc',
  'kling-2.6/text-to-video': 'kling-t2v',
  'kling-2.6/image-to-video': 'kling-i2v',
  'bytedance/seedance-1.5-pro': 'seedance-1.5-pro',
  'nano-banana-pro': 'nanobanana-pro',
  'nano-banana-2': 'nanobanana-2',
  'google/nano-banana-edit': 'nanobanana',
  'gpt-image/1.5-text-to-image': 'gpt-image-1.5',
}

// Список video моделей — включает оба формата (внутренний и внешний API)
const VIDEO_MODELS = [
  'seedance-1.5-pro', 'kling-t2v', 'kling-i2v', 'kling-mc',
  'bytedance/seedance-1.5-pro', 'kling-2.6/motion-control', 'kling-2.6/text-to-video', 'kling-2.6/image-to-video'
]

// Определить media type по имени модели (поддерживает оба формата имён)
function getMediaType(model: string): 'video' | 'image' {
  return VIDEO_MODELS.includes(model) ? 'video' : 'image'
}

/**
 * Register prompt in registered_prompts table for authorship tracking.
 * Computes SHA-256 hash of cleaned prompt text.
 */
async function registerPromptInDb(
  authorUserId: number,
  promptText: string,
  generationId: number
): Promise<void> {
  try {
    // Remove fingerprint markers if present
    const MARKER_START = '\u200D'
    const MARKER_END = '\u2060'
    let cleanText = promptText
    const startIdx = promptText.indexOf(MARKER_START)
    const endIdx = promptText.indexOf(MARKER_END)
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleanText = promptText.slice(0, startIdx) + promptText.slice(endIdx + 1)
    }
    // Remove metadata suffix [type=...; ratio=...; photos=...; avatars=...]
    cleanText = cleanText.replace(/\s*\[type=[^\]]+\]\s*$/i, '').trim()

    // Compute hash
    const normalized = cleanText.toLowerCase()
    const promptHash = crypto.createHash('sha256').update(normalized).digest('hex')

    // Check if already registered
    const existing = await supaSelect('registered_prompts', `?prompt_hash=eq.${promptHash}&select=id`)
    if (existing.ok && Array.isArray(existing.data) && existing.data.length > 0) {
      console.log(`[RegisterPrompt] Prompt hash already exists, skipping`)
      return
    }

    // Insert new record
    const result = await supaPost('registered_prompts', {
      author_user_id: authorUserId,
      generation_id: generationId,
      prompt_hash: promptHash,
      prompt_text: cleanText.slice(0, 1000), // Limit to 1000 chars
      source: 'generation'
    })

    if (result.ok) {
      console.log(`[RegisterPrompt] Registered prompt for gen ${generationId}, hash: ${promptHash.slice(0, 16)}...`)
    } else {
      console.error(`[RegisterPrompt] Failed to register prompt:`, result)
    }
  } catch (e) {
    console.error(`[RegisterPrompt] Error:`, e)
  }
}

function mapSeedreamImageSize(ratio?: string): string | undefined {
  switch (ratio) {
    case '1:1': return 'square_hd'
    case '16:9': return 'landscape_16_9'
    case '21:9': return 'landscape_21_9'
    case '4:3': return 'landscape_4_3'
    case '3:4': return 'portrait_4_3'
    case '9:16': return 'portrait_16_9'
    case '16:21': return 'portrait_16_9'
    default: return undefined
  }
}

function mapNanoBananaImageSize(ratio?: string): string | undefined {
  switch (ratio) {
    case '1:1':
    case '16:9':
    case '9:16':
    case '4:3':
    case '3:4':
    case '21:9':
      return ratio
    case '16:21':
      return '9:16'
    default:
      return '1:1'
  }
}

function mapQwenImageSize(ratio?: string): string | undefined {
  switch (ratio) {
    case '1:1':
      return 'square_hd'
    case '16:9':
      return 'landscape_16_9'
    case '21:9':
      return 'landscape_16_9'
    case '4:3':
      return 'landscape_4_3'
    case '3:4':
      return 'portrait_4_3'
    case '9:16':
      return 'portrait_16_9'
    default:
      return undefined
  }
}

function getPublicBaseUrl(): string | null {
  const url = process.env.WEBAPP_URL || process.env.RAILWAY_PUBLIC_DOMAIN || null
  return url ? (url.startsWith('http') ? url : `https://${url}`) : null
}

function ensureUploadsDir(): string {
  const root = process.cwd()
  const dir = path.join(root, 'uploads')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function saveBase64Image(imageBase64: string): { localPath: string; publicUrl: string } {
  const baseUrl = getPublicBaseUrl()
  const dir = ensureUploadsDir()
  const fileName = `gen-${Date.now()}.png`
  const localPath = path.join(dir, fileName)
  const commaIdx = imageBase64.indexOf(',')
  const data = commaIdx >= 0 ? imageBase64.slice(commaIdx + 1) : imageBase64
  const buf = Buffer.from(data, 'base64')
  fs.writeFileSync(localPath, buf)
  const publicUrl = baseUrl ? `${baseUrl}/uploads/${fileName}` : `http://localhost:${process.env.PORT || '3001'}/uploads/${fileName}`
  return { localPath, publicUrl }
}


interface KieMetaPayload {
  meta?: {
    generationId: number
    tokens: number
    userId: number
  }
  callBackUrl?: string
}

function prepareKieMeta(meta: { generationId: number; tokens: number; userId: number }): KieMetaPayload {
  const baseUrl = getPublicBaseUrl()

  // 1. Construct CallBack URL with query params
  let callBackUrl: string | undefined
  if (baseUrl) {
    callBackUrl = `${baseUrl}/api/webhook/kie?generationId=${meta.generationId}&userId=${meta.userId}`
  }

  // 2. Return payload with both unified meta object and callback
  return {
    meta,
    callBackUrl
  }
}

async function createFluxTask(apiKey: string, prompt: string, aspectRatio?: string, inputImageUrl?: string, onTaskCreated?: (taskId: string) => void, metaPayload?: KieMetaPayload) {
  const body: Record<string, unknown> = {
    prompt,
    aspectRatio: aspectRatio || '1:1',
    model: 'flux-kontext-pro',
    ...metaPayload // Spread unified metadata (meta object + callBackUrl)
  }
  if (inputImageUrl) body.inputImage = inputImageUrl
  console.log('[Flux] Creating task:', JSON.stringify(body))
  const resp = await fetch('https://api.kie.ai/api/v1/flux/kontext/generate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const json = await resp.json()
  if (!resp.ok || json?.code !== 200) {
    console.error('[Flux] Task create failed:', json)
    throw new Error(json?.msg || 'Flux task create failed')
  }
  console.log('[Flux] Task created, ID:', json.data?.taskId)
  const taskId = String(json.data?.taskId || '')
  if (onTaskCreated && taskId) onTaskCreated(taskId)
  return taskId
}

const DEFAULT_TIMEOUT_MS = (() => { const v = Number(process.env.KIE_TASK_TIMEOUT_MS || 0); return Number.isFinite(v) && v > 0 ? v : 300000 })()

async function checkFluxTask(apiKey: string, taskId: string) {
  const url = `https://api.kie.ai/api/v1/flux/kontext/record-info?taskId=${encodeURIComponent(taskId)}`
  const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } })
  const json = await resp.json().catch(() => null)
  if (json && json.code === 200 && json.data) {
    const s = json.data.successFlag
    if (s === 1 && json.data.response?.resultImageUrl) {
      return { status: 'success', imageUrl: String(json.data.response.resultImageUrl), error: '' }
    }
    if (s === 2 || s === 3) {
      return { status: 'failed', error: json.data.errorMessage || 'Flux task failed', imageUrl: '' }
    }
  }
  return { status: 'pending', imageUrl: '', error: '' }
}

async function checkJobsTask(apiKey: string, taskId: string) {
  const url = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`
  const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } })
  const json = await resp.json().catch(() => null)
  if (json && json.code === 200 && json.data) {
    const state = json.data.state
    if (state === 'success' && typeof json.data.resultJson === 'string') {
      try {
        const r = JSON.parse(json.data.resultJson)
        const first = (r.resultUrls && r.resultUrls[0]) || (Array.isArray(r.result_urls) && r.result_urls[0])
        if (first) {
          return { status: 'success', imageUrl: String(first), error: '' }
        }
      } catch { /* ignore */ }
    }
    if (state === 'fail') {
      return { status: 'failed', error: json.data.failMsg || 'Jobs task failed', imageUrl: '' }
    }
  }
  return { status: 'pending', imageUrl: '', error: '' }
}

async function pollFluxTask(apiKey: string, taskId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const start = Date.now()
  console.log(`[Flux] Polling task ${taskId} (timeout: ${timeoutMs}ms)`)
  while (Date.now() - start < timeoutMs) {
    const url = `https://api.kie.ai/api/v1/flux/kontext/record-info?taskId=${encodeURIComponent(taskId)}`
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } })
    const json = await resp.json().catch(() => null)
    if (json && json.code === 200 && json.data) {
      const s = json.data.successFlag
      if (s === 1 && json.data.response?.resultImageUrl) {
        console.log(`[Flux] Task ${taskId} success`)
        return String(json.data.response.resultImageUrl)
      }
      if (s === 2 || s === 3) {
        console.error(`[Flux] Task ${taskId} failed:`, json.data.errorMessage)
        throw new Error(json.data.errorMessage || 'Flux task failed')
      }
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  console.log(`[Flux] Task ${taskId} timed out after ${timeoutMs}ms - status stays pending for later check`)
  return 'TIMEOUT'
}

async function createJobsTask(apiKey: string, modelId: string, input: Record<string, unknown>, onTaskCreated?: (taskId: string) => void, metaPayload?: KieMetaPayload) {
  // Merge meta payload into input (for Jobs, meta is usually inside input object or top level? 
  // Based on user snippet: {"input": "...", "callBackUrl": "...", "meta": {...}, "model": "..."}
  // The 'createJobsTask' function wraps 'input' inside a body { model: modelId, input }.
  // Wait, looking at current `createJobsTask` implementation:
  // body: JSON.stringify({ model: modelId, input })
  // The user example shows `meta` and `callBackUrl` at the TOP LEVEL of the JSON body, alongside `model`.

  // We need to adjust how `createJobsTask` constructs the body.
  // It currently takes `input` and puts it in `input`.
  // If we want `meta` and `callBackUrl` at top level, we need to merge them into the body object, NOT inside `input` usually.
  // BUT `createJobsTask` signature is `createJobsTask(apiKey, modelId, input, ...)` where `input` is put into `body.input`.

  const body: any = { model: modelId, input }
  if (metaPayload) {
    if (metaPayload.meta) body.meta = metaPayload.meta
    if (metaPayload.callBackUrl) body.callBackUrl = metaPayload.callBackUrl
  }

  console.log(`[Jobs] Creating task for ${modelId}:`, JSON.stringify(body))
  const resp = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const json = await resp.json()
  if (!resp.ok || json?.code !== 200) {
    console.error(`[Jobs] Task create failed for ${modelId}:`, json)
    throw new Error(json?.msg || 'Jobs task create failed')
  }
  console.log(`[Jobs] Task created for ${modelId}, ID:`, json.data?.taskId)
  const taskId = String(json.data?.taskId || '')
  if (onTaskCreated && taskId) onTaskCreated(taskId)
  return taskId
}

async function pollJobsTask(apiKey: string, taskId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const start = Date.now()
  console.log(`[Jobs] Polling task ${taskId} (timeout: ${timeoutMs}ms)`)
  while (Date.now() - start < timeoutMs) {
    const url = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } })
    const json = await resp.json().catch(() => null)
    if (json && json.code === 200 && json.data) {
      const state = json.data.state
      if (state === 'success' && typeof json.data.resultJson === 'string') {
        try {
          const r = JSON.parse(json.data.resultJson)
          const first = (r.resultUrls && r.resultUrls[0]) || (Array.isArray(r.result_urls) && r.result_urls[0])
          if (first) {
            console.log(`[Jobs] Task ${taskId} success`)
            return String(first)
          }
        } catch { /* ignore */ }
      }
      if (state === 'fail') {
        const errorMsg = json.data.failMsg || 'Jobs task failed'
        console.error(`[Jobs] Task ${taskId} failed:`, errorMsg)

        // Special handling for Gemini content policy error
        if (errorMsg.toLowerCase().includes('gemini could not generate') ||
          errorMsg.toLowerCase().includes('could not generate an image')) {
          throw new Error('Gemini не смог сгенерировать изображение с этим промптом. Попробуйте другой промпт или используйте Seedream.')
        }

        throw new Error(errorMsg)
      }
    }
    await new Promise(r => setTimeout(r, 30000))
  }
  console.log(`[Jobs] Task ${taskId} timed out after ${timeoutMs}ms - status stays pending for later check`)
  return 'TIMEOUT'
}

// --- Supabase helpers for recording generation and deducting balance ---
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''

function supaHeaders() {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } as Record<string, string>
}

async function supaSelect(table: string, query: string) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`
  const r = await fetch(url, { headers: { ...supaHeaders(), 'Content-Type': 'application/json', Prefer: 'count=exact' } })
  const data = await r.json().catch(() => null)
  return { ok: r.ok, data }
}

async function supaPost(table: string, body: unknown, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params}`
  const r = await fetch(url, { method: 'POST', headers: { ...supaHeaders(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => null)
  return { ok: r.ok, data }
}

async function supaPatch(table: string, filter: string, body: unknown) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`
  const r = await fetch(url, { method: 'PATCH', headers: { ...supaHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => null)
  return { ok: r.ok, data }
}

// Атомарное обновление с возвратом данных - для защиты от race condition
// Возвращает массив обновлённых записей. Если пустой - условие не выполнилось.
async function supaPatchAtomic(table: string, filter: string, body: unknown) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...supaHeaders(),
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'  // Возвращает обновлённые записи
    },
    body: JSON.stringify(body)
  })
  const data = await r.json().catch(() => [])
  return { ok: r.ok, data: Array.isArray(data) ? data : [] }
}

const MODEL_PRICES: Record<string, number> = {
  nanobanana: 3,
  'nanobanana-pro': 15,
  'nanobanana-2': 5,
  seedream4: 4,
  'seedream4-5': 7,
  flux: 4,
  'gpt-image-1.5': 5, // Default: medium quality
  'test-model': 0, // Тестовая модель — бесплатно
}

// ============ NanoBanana Pro API Provider Functions ============

type ApiProvider = 'kie' | 'piapi' | 'myapi'
type ProFallbackProvider = 'kie' | 'piapi'

/**
 * Get current primary API provider for NanoBanana Pro from database
 */
async function getNanobananaApiProvider(): Promise<ProFallbackProvider> {
  const value = await getAppConfig('image_generation_primary_api')
  return (value === 'piapi' ? 'piapi' : 'kie') as ProFallbackProvider
}

/**
 * Switch NanoBanana Pro API provider and persist to database
 */
export async function switchNanobananaApiProvider(): Promise<ProFallbackProvider> {
  const current = await getNanobananaApiProvider()
  const next: ProFallbackProvider = current === 'kie' ? 'piapi' : 'kie'
  await setAppConfig('image_generation_primary_api', next)
  console.log(`[API Switch] NanoBanana Pro API switched: ${current} -> ${next}`)
  return next
}

/**
 * Check if error indicates service unavailability (should trigger fallback)
 */
function isServiceUnavailableError(error: any): boolean {
  const msg = String(error?.message || error || '').toLowerCase()
  return (
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('524') ||
    msg.includes('service unavailable') ||
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('rate limit') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('internal error') ||
    msg.includes('please try again later') ||
    msg.includes('ai studio api http error')
  )
}

// Цены для GPT Image 1.5 по качеству
const GPT_IMAGE_PRICES: Record<string, number> = {
  medium: 5,
  high: 15,
}

// Рассчитать стоимость GPT Image 1.5 в токенах
function calculateGptImageCost(quality: string): number {
  return GPT_IMAGE_PRICES[quality] ?? 5
}

// Цены для видео-генерации Seedance 1.5 Pro
// Формула: ceil(api_credits * 1.5) — наценка 1.5x от стоимости API
const VIDEO_PRICES: Record<string, Record<string, { base: number; audio: number }>> = {
  '480p': {
    '4': { base: 12, audio: 24 },
    '8': { base: 21, audio: 42 },
    '12': { base: 29, audio: 58 },
  },
  '720p': {
    '4': { base: 24, audio: 48 },
    '8': { base: 42, audio: 84 },
    '12': { base: 58, audio: 116 },
  },
}

// Рассчитать стоимость видео в токенах
function calculateVideoCost(resolution: string, duration: string, withAudio: boolean): number {
  const prices = VIDEO_PRICES[resolution]?.[duration]
  if (!prices) return 42 // Default: 720p, 8s
  return withAudio ? prices.audio : prices.base
}

// === Цены для Kling AI v2.6 ===
// T2V & I2V: фиксированная цена по длительности
const KLING_VIDEO_PRICES: Record<string, { base: number; audio: number }> = {
  '5': { base: 55, audio: 110 },
  '10': { base: 110, audio: 220 },
}

// Motion Control: цена за секунду (минимум 5 сек)
const KLING_MC_PRICES: Record<string, number> = {
  '720p': 6,
  '1080p': 9,
}

// Рассчитать стоимость Kling в токенах
function calculateKlingCost(
  mode: string, // 't2v' | 'i2v' | 'motion-control'
  duration: string,
  withSound: boolean,
  mcQuality: string = '720p',
  videoDurationSeconds: number = 0
): number {
  if (mode === 'motion-control' || mode === 'kling-mc') {
    const pricePerSec = KLING_MC_PRICES[mcQuality] || 6
    const effectiveDuration = Math.max(5, videoDurationSeconds)
    return effectiveDuration * pricePerSec
  }
  const prices = KLING_VIDEO_PRICES[duration] || KLING_VIDEO_PRICES['5']
  return withSound ? prices.audio : prices.base
}

async function completeGeneration(
  generationId: number,
  userId: number,
  imageUrl: string,
  model: string,
  cost: number,
  parentId?: number,
  contestEntryId?: number,
  inputImages?: string[],
  resolution?: string,
  languageCode?: string
) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !userId || !generationId) return

  // 0. Check if already completed to prevent double charge
  const check = await supaSelect('generations', `?id=eq.${generationId}&select=status`)
  if (check.ok && Array.isArray(check.data) && check.data[0]?.status === 'completed') {
    console.log(`[DB] Generation ${generationId} already completed, skipping.`)
    return
  }

  console.log(`[DB] Completing generation ${generationId} for user ${userId}, model: ${model}`)
  try {
    // Determine media type from model (supports both internal and external API model names)
    const mediaType = getMediaType(model)

    // 1. Update generation status - save video to video_url, image to image_url
    const updatePayload: Record<string, unknown> = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      media_type: mediaType
    }

    if (mediaType === 'video') {
      updatePayload.video_url = imageUrl
    } else {
      updatePayload.image_url = imageUrl
    }

    // Inherit is_prompt_private from parent generation (for blind remix)
    if (parentId) {
      const parentPrivacyCheck = await supaSelect('generations', `?id=eq.${parentId}&select=is_prompt_private`)
      if (parentPrivacyCheck.ok && Array.isArray(parentPrivacyCheck.data) && parentPrivacyCheck.data.length > 0) {
        const parentIsPrivate = parentPrivacyCheck.data[0].is_prompt_private
        if (parentIsPrivate) {
          updatePayload.is_prompt_private = true
          console.log(`[DB] Inheriting is_prompt_private=true from parent generation ${parentId}`)
        }
      }
    }

    const updateRes = await supaPatch('generations', `?id=eq.${generationId}`, updatePayload)
    console.log(`[DB] Generation ${generationId} status updated (media_type: ${mediaType}, url field: ${mediaType === 'video' ? 'video_url' : 'image_url'}):`, updateRes.ok)

    // Баланс уже списан при создании генерации (в handleGenerateImage)
    // При успешном завершении не нужно ничего делать с балансом
    console.log(`[DB] Generation completed, balance was already debited at start`)

    // 3. Handle Remix Logic
    if (contestEntryId) {
      // Contest Remix Logic: Only update contest entry count
      const entry = await supaSelect('contest_entries', `?id=eq.${contestEntryId}&select=remix_count`)
      if (entry.ok && Array.isArray(entry.data) && entry.data.length > 0) {
        const newCount = (entry.data[0].remix_count || 0) + 1
        await supaPatch('contest_entries', `?id=eq.${contestEntryId}`, { remix_count: newCount })
        console.log(`[DB] Contest entry ${contestEntryId} remix count updated: ${newCount}`)
      }
    } else if (parentId) {
      // Standard Global Remix Logic
      // Increment remix_count for parent generation
      const pGen = await supaSelect('generations', `?id=eq.${parentId}&select=remix_count,user_id`)
      if (pGen.ok && Array.isArray(pGen.data) && pGen.data.length > 0) {
        const parentGen = pGen.data[0]
        const newGenCount = (parentGen.remix_count || 0) + 1
        await supaPatch('generations', `?id=eq.${parentId}`, { remix_count: newGenCount })

        // Increment remix_count for parent author AND give reward
        if (parentGen.user_id && String(parentGen.user_id) !== String(userId)) { // Don't reward self-remix
          const pUser = await supaSelect('users', `?user_id=eq.${parentGen.user_id}&select=remix_count,balance`)
          if (pUser.ok && Array.isArray(pUser.data) && pUser.data.length > 0) {
            const parentUser = pUser.data[0]
            const newUserCount = (parentUser.remix_count || 0) + 1

            let rewardAmount = 1
            if (model === 'nanobanana-pro' || model === 'nanobanana-2') {
              rewardAmount = cost <= 7 ? 1 : (cost <= 10 ? 2 : 3)
            }
            const newBalance = (parentUser.balance || 0) + rewardAmount

            // Update user stats
            await supaPatch('users', `?user_id=eq.${parentGen.user_id}`, {
              remix_count: newUserCount,
              balance: newBalance
            })

            // Record reward transaction
            await supaPost('remix_rewards', {
              user_id: parentGen.user_id,
              source_generation_id: parentId,
              remix_generation_id: generationId,
              amount: rewardAmount
            })
            console.log(`[DB] Remix reward given to user ${parentGen.user_id}: +${rewardAmount}`)

            // Notify parent author about remix
            try {
              await createNotification(
                parentGen.user_id,
                'remix',
                'Новый ремикс 🔄',
                `Кто-то использовал вашу работу! +${rewardAmount} токен${rewardAmount > 1 ? 'а' : ''}`,
                { generation_id: parentId, deep_link: '/accumulations' }
              )
            } catch (e) {
              console.error('[Notification] Failed to notify about remix:', e)
            }
          }
        }
      }
    }

    // 3.5 Send Telegram Notification (if enabled in settings)
    try {
      if (userId) {
        const settings = await getUserNotificationSettings(userId)
        if (settings.telegram_generation) {
          let caption = `✨ Генерация завершена!`
          if ((model === 'nanobanana-pro' || model === 'nanobanana-2') && (resolution === '2K' || resolution === '4K')) {
            if (languageCode === 'en') {
              caption += "\n\n⚠️ The file is too large. Telegram does not show it in full quality. Save to gallery to view in detail."
            } else {
              caption += "\n\n⚠️ Файл слишком большой. Telegram не показывает его в полном качестве. Сохраните в галерею для детального просмотра."
            }
          }
          await tg('sendDocument', {
            chat_id: userId,
            document: imageUrl,
            caption: caption
          })
          console.log(`[Notification] Sent photo to user ${userId}`)
        } else {
          console.log(`[Notification] Telegram generation disabled for user ${userId}`)
        }
      }
    } catch (e) {
      console.error('[Notification] Failed to send Telegram notification:', e)
    }

    // 3.6 Create in-app notification (always)
    try {
      await createNotification(
        userId,
        'generation_completed',
        'Генерация готова ✨',
        'Ваше изображение создано',
        { generation_id: generationId, deep_link: `/profile?gen=${generationId}` }
      )
      console.log(`[Notification] In-app notification created for user ${userId}`)
    } catch (e) {
      console.error('[Notification] Failed to create in-app notification:', e)
    }


    // 4. Generate Thumbnail (Async, don't block response)
    // For videos: use first input image as thumbnail (more efficient than extracting from video)
    // For images: use the generated image itself
    const isVideoModel = model === 'seedance-1.5-pro'
    const thumbnailSource = isVideoModel && inputImages && inputImages.length > 0
      ? inputImages[0]  // Use first input frame for video thumbnail
      : imageUrl        // Use generated image for image thumbnail

    if (thumbnailSource) {
      createThumbnail(thumbnailSource, thumbnailSource, `gen_${generationId}_thumb.jpg`).catch(err => {
        console.error(`[Thumbnail] Failed to generate thumbnail for ${generationId}:`, err)
      })
      if (isVideoModel) {
        console.log(`[Thumbnail] Creating video thumbnail from input image for ${generationId}`)
      }
    }

  } catch (e) {
    console.error('completeGeneration error:', e)
  }
}

// Функция для генерации изображения через Kie.ai
async function generateImageWithKieAI(
  apiKey: string,
  requestData: KieAIRequest,
  onTaskCreated?: (taskId: string) => void
): Promise<KieAIResponse> {
  try {
    const { model, prompt, aspect_ratio, images, negative_prompt, resolution, google_search } = requestData
    const cfg = MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS]

    const hasImages = images && images.length > 0
    let imageUrls: string[] = []

    if (hasImages) {
      // Save all images
      imageUrls = images!.map(img => {
        if (typeof img === 'string') {
          if (img.startsWith('http')) return img
          const saved = saveBase64Image(img)
          return saved.publicUrl
        }
        return ''
      }).filter(Boolean)
    }

    // Prepare Metadata Payload if available
    let metaPayload: KieMetaPayload | undefined
    if (requestData.meta) {
      metaPayload = prepareKieMeta(requestData.meta)
    }

    // Тестовая модель — возвращает placeholder изображение без вызова API
    if (model === 'test-model') {
      console.log('[Test Model] Simulating generation...')
      await new Promise(resolve => setTimeout(resolve, 5000)) // Симуляция задержки 5 сек
      const testImage = `https://placehold.co/1024x1024/8b5cf6/ffffff/png?text=Test+${Date.now()}`
      console.log('[Test Model] Returning test image:', testImage)
      return { images: [testImage], inputImages: imageUrls }
    }

    // NanoGPT Models (Qwen Image)
    if (cfg.kind === 'nanogpt') {
      console.log(`[NanoGPT] Generating using model: ${model}`)

      const result = await generateNanoGPTImage({
        prompt,
        model: 'qwen-image', // Explicitly cast to known model type if needed, or use model as is if matches
        size: resolution || '1024x1024', // Use explicit resolution or default
        image: imageUrls.length > 0 ? imageUrls[0] : undefined // Use first image for i2i
      })

      if (result.url) {
        return { images: [result.url], inputImages: imageUrls }
      } else if (result.b64_json) {
        // Handle base64 response by saving it
        const saved = saveBase64Image(result.b64_json)
        return { images: [saved.publicUrl], inputImages: imageUrls }
      }

      throw new Error('NanoGPT did not return an image URL or base64')
    }

    if (cfg.kind === 'flux-kontext') {
      const taskId = await createFluxTask(apiKey, prompt, aspect_ratio, imageUrls[0], onTaskCreated, metaPayload)
      const url = await pollFluxTask(apiKey, taskId)
      if (url === 'TIMEOUT') return { timeout: true, inputImages: imageUrls }
      return { images: [url], inputImages: imageUrls }
    }

    if (model === 'seedream4' || model === 'seedream4-5') {
      const image_size = mapSeedreamImageSize(aspect_ratio)
      // Different prompt key or structure? No, Seedream usually just 'prompt'
      const input: Record<string, unknown> = { prompt }

      // Default quality
      if (model === 'seedream4-5') {
        input.quality = 'high'
      } else {
        input.image_resolution = '2K' // Seedream 4 specific
      }

      if (model === 'seedream4' && image_size) {
        input.image_size = image_size
      } else if (model === 'seedream4-5') {
        if (aspect_ratio && aspect_ratio !== 'Auto') {
          input.aspect_ratio = aspect_ratio
        } else {
          input.aspect_ratio = '1:1'
        }
      }

      if (imageUrls.length > 0) {
        // Edit Mode
        const mode = model === 'seedream4-5' ? 'seedream/4.5-edit' : 'bytedance/seedream-v4-edit'
        if (model === 'seedream4-5') {
          const taskId = await createJobsTask(apiKey, mode, { ...input, image_urls: imageUrls }, onTaskCreated, metaPayload)
          const url = await pollJobsTask(apiKey, taskId)
          if (url === 'TIMEOUT') return { timeout: true, inputImages: imageUrls }
          return { images: [url], inputImages: imageUrls }
        }

        const taskId = await createJobsTask(apiKey, mode, { ...input, image_urls: imageUrls }, onTaskCreated, metaPayload)
        const url = await pollJobsTask(apiKey, taskId)
        if (url === 'TIMEOUT') return { timeout: true, inputImages: imageUrls }
        return { images: [url], inputImages: imageUrls }
      } else {
        const mode = model === 'seedream4-5' ? 'seedream/4.5-text-to-image' : 'bytedance/seedream-v4-text-to-image'
        const taskId = await createJobsTask(apiKey, mode, input, onTaskCreated, metaPayload)
        const url = await pollJobsTask(apiKey, taskId)
        if (url === 'TIMEOUT') return { timeout: true, inputImages: [] }
        return { images: [url], inputImages: [] }
      }
    }

    if (model === 'nanobanana' || model === 'nanobanana-pro' || model === 'nanobanana-2') {
      const isPro = model === 'nanobanana-pro'
      const isNb2 = model === 'nanobanana-2'
      const modelId = isPro ? 'nano-banana-pro' : (isNb2 ? 'nano-banana-2' : (imageUrls.length > 0 ? 'google/nano-banana-edit' : 'google/nano-banana'))

      const res = (isPro || isNb2) ? (resolution || (isNb2 ? '1K' : '4K')) : undefined
      const normalizedRes = typeof res === 'string' ? res.toUpperCase() : ''
      const modelLabel = isPro ? 'nanobanana-pro' : (isNb2 ? 'nanobanana-2' : 'nanobanana')

      let image_size: string | undefined
      if (aspect_ratio !== 'Auto') {
        image_size = mapNanoBananaImageSize(aspect_ratio)
      }

      // Helper to update api_provider in DB
      const updateApiProvider = async (provider: ApiProvider) => {
        const genId = metaPayload?.meta?.generationId
        if (genId) {
          await supaPatch('generations', `?id=eq.${genId}`, { api_provider: provider })
          console.log(`[${modelLabel}] Updated api_provider to ${provider} for gen ${genId}`)
        }
      }

      // Non-Pro, Non-NB2 NanoBanana uses only Kie
      if (!isPro && !isNb2) {
        const input: Record<string, unknown> = {
          prompt,
          output_format: 'png'
        }
        if (imageUrls.length > 0) input.image_urls = imageUrls
        if (image_size) input.image_size = image_size

        const taskId = await createJobsTask(apiKey, modelId, input, onTaskCreated, metaPayload)
        const url = await pollJobsTask(apiKey, taskId)
        if (url === 'TIMEOUT') return { timeout: true, inputImages: imageUrls }
        return { images: [url], inputImages: imageUrls }
      }

      // Try MyAPI first for supported NB2/Pro combinations.
      const myApiModelSupported = isPro || isNb2
      const myApiFeatureEnabled = isMyApiEnabledForModel(model as 'nanobanana-pro' | 'nanobanana-2')
      const myApiResolutionSupported = isPro
        ? normalizedRes === '2K'
        : (isNb2 ? (normalizedRes === '1K' || normalizedRes === '2K') : false)
      const myApiInputSupported = imageUrls.length <= 5

      if (myApiModelSupported) {
        if (!myApiFeatureEnabled) {
          console.log(`[MyAPI][RouteDecision] Skip for ${modelLabel}: disabled by env flag`)
        } else if (!isMyApiConfigured()) {
          console.log(`[MyAPI][RouteDecision] Skip for ${modelLabel}: MY_API_KEY is not configured`)
        } else if (!myApiResolutionSupported) {
          console.log(`[MyAPI][RouteDecision] Skip for ${modelLabel}: resolution ${normalizedRes || 'unknown'} is not supported`)
        } else if (!myApiInputSupported) {
          console.log(`[MyAPI][RouteDecision] Skip for ${modelLabel}: image_input count ${imageUrls.length} > 5`)
        } else {
          try {
            console.log(`[MyAPI][Availability] Checking capacity for ${modelLabel}, resolution=${normalizedRes}`)
            const availability = await checkMyApiAvailability()
            const hasFreeNow = availability.has_free_account_now === true
            const queueSlotsLeft = Number(availability.queue_slots_left || 0)
            const hasQueueSlot = queueSlotsLeft > 0

            if (hasFreeNow && hasQueueSlot) {
              console.log(`[MyAPI][RouteDecision] Using MyAPI for ${modelLabel}: has_free_account_now=true, queue_slots_left=${queueSlotsLeft}`)
              try {
                const myApiResult = await generateWithMyApi({
                  prompt,
                  model: model as 'nanobanana-pro' | 'nanobanana-2',
                  resolution: normalizedRes as '1K' | '2K',
                  aspectRatio: aspect_ratio,
                  imageInput: imageUrls
                })
                await updateApiProvider('myapi')
                console.log(`[MyAPI][Generate] Success for ${modelLabel}: generated_model=${myApiResult.generatedModel || 'unknown'}, actual_resolution=${myApiResult.actualResolution || 'unknown'}`)
                return { images: [myApiResult.imageUrl], inputImages: imageUrls }
              } catch (error) {
                console.error(`[MyAPI][Fallback] Generate failed for ${modelLabel}, using current chain:`, error)
              }
            } else {
              console.log(`[MyAPI][RouteDecision] Skip for ${modelLabel}: has_free_account_now=${availability.has_free_account_now}, queue_slots_left=${queueSlotsLeft}`)
            }
          } catch (error) {
            console.error(`[MyAPI][Fallback] Availability failed for ${modelLabel}, using current chain:`, error)
          }
        }
      }

      // ============ NanoBanana 2 fallback chain: Kie only ============
      if (isNb2) {
        const input: Record<string, unknown> = {
          prompt,
          output_format: 'png'
        }
        if (imageUrls.length > 0) input.image_input = imageUrls
        if (aspect_ratio && aspect_ratio !== 'Auto') input.aspect_ratio = aspect_ratio
        if (res) input.resolution = res
        if (google_search) input.google_search = true

        const taskId = await createJobsTask(apiKey, 'nano-banana-2', input, onTaskCreated, metaPayload)
        const url = await pollJobsTask(apiKey, taskId)
        if (url === 'TIMEOUT') return { timeout: true, inputImages: imageUrls }
        await updateApiProvider('kie')
        return { images: [url], inputImages: imageUrls }
      }

      // ============ NanoBanana Pro fallback chain: Kie <-> PiAPI ============
      const primaryProvider = await getNanobananaApiProvider()
      console.log(`[NanoBanana Pro] Using primary provider: ${primaryProvider}`)

      // Helper to generate via specific provider
      const generateWithProvider = async (provider: ProFallbackProvider): Promise<{ url: string; taskId: string; provider: ProFallbackProvider }> => {
        if (provider === 'piapi') {
          // PiAPI uses image_urls (not image_input)
          const piapiInput = {
            prompt,
            output_format: 'png' as const,
            resolution: (res || '4K') as '2K' | '4K',
            safety_level: 'low' as const,
            ...(imageUrls.length > 0 && { image_urls: imageUrls }),
            ...(aspect_ratio && aspect_ratio !== 'Auto' && { aspect_ratio })
          }

          const result = await createPiapiTask(piapiInput, {
            generationId: metaPayload?.meta?.generationId || 0,
            userId: metaPayload?.meta?.userId || 0
          })
          if (onTaskCreated) onTaskCreated(result.taskId)
          const url = await pollPiapiTask(result.taskId)
          return { url, taskId: result.taskId, provider: 'piapi' }
        } else {
          // Kie.ai uses image_input for Pro
          const input: Record<string, unknown> = {
            prompt,
            output_format: 'png'
          }
          if (imageUrls.length > 0) input.image_input = imageUrls
          if (aspect_ratio && aspect_ratio !== 'Auto') input.aspect_ratio = aspect_ratio
          if (res) input.resolution = res

          const taskId = await createJobsTask(apiKey, 'nano-banana-pro', input, onTaskCreated, metaPayload)
          const url = await pollJobsTask(apiKey, taskId)
          return { url, taskId, provider: 'kie' }
        }
      }

      // Try primary, fallback to backup on service errors
      try {
        const result = await generateWithProvider(primaryProvider)
        if (result.url === 'TIMEOUT') return { timeout: true, inputImages: imageUrls }
        await updateApiProvider(result.provider)
        return { images: [result.url], inputImages: imageUrls }
      } catch (error) {
        if (isServiceUnavailableError(error)) {
          const backupProvider: ProFallbackProvider = primaryProvider === 'kie' ? 'piapi' : 'kie'
          console.log(`[NanoBanana Pro Fallback] ${primaryProvider} failed, trying ${backupProvider}:`, (error as Error).message)

          try {
            const result = await generateWithProvider(backupProvider)
            if (result.url === 'TIMEOUT') return { timeout: true, inputImages: imageUrls }
            await updateApiProvider(result.provider)
            return { images: [result.url], inputImages: imageUrls }
          } catch (backupError) {
            console.error(`[NanoBanana Pro Fallback] Both providers failed:`, backupError)
            throw backupError
          }
        }
        throw error
      }
    }

    // Seedance 1.5 Pro — Видео генерация
    if (model === 'seedance-1.5-pro') {
      const { video_duration, video_resolution, fixed_lens, generate_audio } = requestData as any

      const input: Record<string, unknown> = {
        prompt,
        aspect_ratio: aspect_ratio || '16:9',
        resolution: video_resolution || '720p',
        duration: video_duration || '8',
        fixed_lens: fixed_lens ?? false,
        generate_audio: generate_audio ?? false,
      }

      // Добавить изображения если есть (I2V режим)
      if (imageUrls.length > 0) {
        input.input_urls = imageUrls
      }

      console.log('[Seedance] Creating video task:', JSON.stringify(input))
      const taskId = await createJobsTask(apiKey, 'bytedance/seedance-1.5-pro', input, onTaskCreated, metaPayload)

      // Для видео используем более длинный таймаут — 6 минут
      const VIDEO_TIMEOUT_MS = 360000
      const url = await pollJobsTask(apiKey, taskId, VIDEO_TIMEOUT_MS)

      if (url === 'TIMEOUT') {
        console.log('[Seedance] Video generation timed out, status stays pending')
        return { timeout: true, inputImages: imageUrls }
      }

      console.log('[Seedance] Video generated:', url)
      return { images: [url], inputImages: imageUrls }
    }

    // GPT Image 1.5 — Text-to-Image и Image-to-Image
    if (model === 'gpt-image-1.5') {
      const { gpt_image_quality } = requestData as any
      const quality = gpt_image_quality || 'medium'

      // Маппинг соотношений сторон (только 1:1, 2:3, 3:2 поддерживаются)
      let apiAspectRatio = aspect_ratio || '1:1'
      if (!['1:1', '2:3', '3:2'].includes(apiAspectRatio)) {
        apiAspectRatio = '1:1' // Fallback
      }

      const input: Record<string, unknown> = {
        prompt,
        aspect_ratio: apiAspectRatio,
        quality,
      }

      // Выбор модели: T2I или I2I
      let modelId = 'gpt-image/1.5-text-to-image'
      if (imageUrls.length > 0) {
        modelId = 'gpt-image/1.5-image-to-image'
        input.input_urls = imageUrls
      }

      console.log(`[GPT Image 1.5] Creating task (${modelId}):`, JSON.stringify(input))
      const taskId = await createJobsTask(apiKey, modelId, input, onTaskCreated, metaPayload)
      const url = await pollJobsTask(apiKey, taskId)

      if (url === 'TIMEOUT') {
        console.log('[GPT Image 1.5] Generation timed out, status stays pending')
        return { timeout: true, inputImages: imageUrls }
      }

      console.log('[GPT Image 1.5] Image generated:', url)
      return { images: [url], inputImages: imageUrls }
    }

    // Kling T2V — Text to Video
    if (model === 'kling-t2v') {
      const { kling_duration, kling_sound } = requestData as any

      const input: Record<string, unknown> = {
        prompt,
        aspect_ratio: aspect_ratio || '16:9',
        duration: kling_duration || '5',
        sound: kling_sound ?? false,
      }

      console.log('[Kling T2V] Creating task:', JSON.stringify(input))
      const taskId = await createJobsTask(apiKey, 'kling-2.6/text-to-video', input, onTaskCreated, metaPayload)

      const KLING_TIMEOUT_MS = 360000 // 6 min for T2V
      const url = await pollJobsTask(apiKey, taskId, KLING_TIMEOUT_MS)

      if (url === 'TIMEOUT') {
        console.log('[Kling T2V] Generation timed out, status stays pending')
        return { timeout: true, inputImages: [] }
      }

      console.log('[Kling T2V] Video generated:', url)
      return { images: [url], inputImages: [] }
    }

    // Kling I2V — Image to Video
    if (model === 'kling-i2v') {
      const { kling_duration, kling_sound } = requestData as any

      const input: Record<string, unknown> = {
        prompt,
        image_urls: imageUrls,
        duration: kling_duration || '5',
        sound: kling_sound ?? false,
      }

      console.log('[Kling I2V] Creating task:', JSON.stringify(input))
      const taskId = await createJobsTask(apiKey, 'kling-2.6/image-to-video', input, onTaskCreated, metaPayload)

      const KLING_TIMEOUT_MS = 360000 // 6 min for I2V
      const url = await pollJobsTask(apiKey, taskId, KLING_TIMEOUT_MS)

      if (url === 'TIMEOUT') {
        console.log('[Kling I2V] Generation timed out, status stays pending')
        return { timeout: true, inputImages: imageUrls }
      }

      console.log('[Kling I2V] Video generated:', url)
      return { images: [url], inputImages: imageUrls }
    }

    // Kling Motion Control
    if (model === 'kling-mc') {
      const { character_orientation, kling_mc_quality, video_url } = requestData as any

      const input: Record<string, unknown> = {
        prompt,
        input_urls: imageUrls,
        video_urls: [video_url],  // video_url is already processed and uploaded to R2
        character_orientation: character_orientation || 'video',
        mode: kling_mc_quality || '720p',
      }

      console.log('[Kling MC] Creating task:', JSON.stringify(input))
      const taskId = await createJobsTask(apiKey, 'kling-2.6/motion-control', input, onTaskCreated, metaPayload)

      // Motion Control может занимать до 30 минут
      const KLING_MC_TIMEOUT_MS = 1800000 // 30 min
      const url = await pollJobsTask(apiKey, taskId, KLING_MC_TIMEOUT_MS)

      if (url === 'TIMEOUT') {
        console.log('[Kling MC] Generation timed out after 30 minutes')
        return { timeout: true, inputImages: imageUrls }
      }

      console.log('[Kling MC] Video generated:', url)
      return { images: [url], inputImages: imageUrls }
    }


    throw new Error('Unsupported model')
  } catch (error) {
    console.error('Kie.ai API error:', error)
    return { error: error instanceof Error ? error.message : 'Failed to generate image' }
  }
}

// Основной контроллер для обработки запросов генерации
export async function handleGenerateImage(req: Request, res: Response) {
  console.log('[API] /generate request received:', {
    model: req.body.model,
    userId: req.body.user_id,
    hasImages: req.body.images?.length > 0
  })

  try {
    let {
      prompt, model, aspect_ratio, images, negative_prompt, user_id, resolution, google_search, contest_entry_id,
      // Параметры для видео (Seedance 1.5 Pro)
      video_duration, video_resolution, fixed_lens, generate_audio,
      // Параметры для Kling AI
      kling_duration, kling_sound, kling_mc_quality, character_orientation, video_url, video_duration_seconds,
      // Количество изображений для множественной генерации
      image_count = 1
    } = req.body

    // Ограничить image_count до 1-4, и только для изображений (не для видео)
    // Video models support only 1 image at a time
    const imageCount = VIDEO_MODELS.includes(model) ? 1 : Math.max(1, Math.min(4, Number(image_count) || 1))

    const parent_id = req.body.parent_id

    // Флаг и данные для слепого ремикса (когда промпт получен из родительской генерации с is_prompt_private)
    let isBlindRemix = false
    let blindRemixAuthorUsername = ''

    // Если prompt пустой, но есть parent_id — получить промпт из родительской генерации (слепой ремикс)
    if ((!prompt || typeof prompt !== 'string' || !prompt.trim()) && parent_id) {
      console.log('[API] Empty prompt with parent_id, fetching from parent generation:', parent_id)

      const isAuthorPrompt = typeof parent_id === 'string' && (parent_id.startsWith('p') || parent_id.startsWith('P'))

      if (isAuthorPrompt) {
        const numericId = parent_id.substring(1)
        const parentQuery = `?id=eq.${numericId}&select=prompt_text,users(username)`
        const parentResult = await supaSelect('author_prompts', parentQuery)

        if (parentResult.ok && Array.isArray(parentResult.data) && parentResult.data.length > 0) {
          const parentData = parentResult.data[0]
          prompt = parentData.prompt_text
          // Author prompts are public, not a blind remix
        }
      } else {
        const parentQuery = `?id=eq.${parent_id}&select=prompt,is_prompt_private,users(username)`
        const parentResult = await supaSelect('generations', parentQuery)

        if (parentResult.ok && Array.isArray(parentResult.data) && parentResult.data.length > 0) {
          const parentData = parentResult.data[0]
          const parentPrompt = parentData.prompt
          const parentIsPrivate = parentData.is_prompt_private
          const parentUsername = parentData.users?.username || 'Unknown'

          if (parentPrompt) {
            // Удалить метаданные из промпта [type=...; ratio=...; photos=...; avatars=...]
            prompt = parentPrompt.replace(/\s*\[type=[^\]]+\]\s*$/, '').trim()
            console.log('[API] Got prompt from parent generation:', prompt.slice(0, 50) + '...')

            // Если родительский промпт приватный — это слепой ремикс
            if (parentIsPrivate) {
              isBlindRemix = true
              blindRemixAuthorUsername = parentUsername
              console.log(`[API] Blind remix detected, parent author: @${parentUsername}`)
            }
          }
        }

      } // close else block

      if (!prompt || !prompt.trim()) {
        return res.status(400).json({
          error: 'Parent generation prompt not found'
        })
      }
    }

    // Валидация входных данных
    // Валидация входных данных
    if ((!prompt || typeof prompt !== 'string') && model !== 'kling-mc') {
      return res.status(400).json({
        error: 'Prompt is required and must be a string'
      })
    }
    if (!prompt) prompt = ''

    if (!model || !MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS]) {
      return res.status(400).json({
        error: 'Valid model is required. Available models: flux, seedream4, seedream4-5, nanobanana'
      })
    }

    // SIMULATION MODE
    if (prompt.trim().toLowerCase() === 'test') {
      await new Promise(resolve => setTimeout(resolve, 10000)) // Simulate delay

      const mockImage = 'https://placehold.co/1024x1024/png?text=Test+Generation'
      const mediaType = getMediaType(model)

      // Simulate Telegram Notification
      if (user_id) {
        try {
          await tg('sendDocument', {
            chat_id: user_id,
            document: mockImage,
            caption: '✨ Тестовая генерация завершена!'
          })
        } catch (e) { console.error('Simulated tg error', e) }
      }

      return res.json({
        image: mockImage,
        images: [mockImage],
        prompt: prompt,
        model: model,
        generation_ids: [],
        primary_generation_id: null,
        media_type: mediaType,
      })
    }

    // Upload input images to R2 (for DB) in parallel
    // We use original images for generation to ensure compatibility
    let r2ImagesPromise: Promise<string[]> = Promise.resolve(images || [])

    if (images && images.length > 0) {
      const { uploadImageFromUrl } = await import('../services/r2Service.js')

      // Start R2 uploads in background
      console.log('Starting background R2 uploads for', images.length, 'images')
      r2ImagesPromise = Promise.all(images.map(async (img: string) => {
        try {
          // Case 1: Base64 Image
          if (img.startsWith('data:image')) {
            const { uploadImageFromBase64 } = await import('../services/r2Service.js')
            const result = await uploadImageFromBase64(img)
            console.log('R2 Base64 upload complete. New:', result)
            return result
          }

          // Case 2: HTTP URL
          if (img.startsWith('http')) {
            const { uploadImageFromUrl } = await import('../services/r2Service.js')
            const result = await uploadImageFromUrl(img)
            console.log('R2 URL upload complete. Original:', img, 'New:', result)
            return result
          }

          // Case 3: Unknown format
          return img
        } catch (e) {
          console.error('R2 upload failed for image:', e)
          return img // Fallback to original
        }
      }))
    }

    // Проверка API ключа
    const apiKey = process.env.KIE_API_KEY
    if (!apiKey) {
      console.error('KIE_API_KEY is missing')
      return res.status(500).json({
        error: 'KIE_API_KEY is not configured'
      })
    }

    // Проверка баланса пользователя
    let languageCode = 'ru'
    let cost = 0
    if (user_id) {
      cost = MODEL_PRICES[model] ?? 0
      // Dynamic pricing for NanoBanana Pro
      if (model === 'nanobanana-pro' && resolution === '2K') {
        cost = 10
      }
      // Dynamic pricing for NanoBanana 2
      if (model === 'nanobanana-2') {
        const NB2_PRICES: Record<string, number> = { '1K': 5, '2K': 7, '4K': 10 }
        cost = NB2_PRICES[resolution || '1K'] ?? 5
      }
      // Dynamic pricing for Seedance 1.5 Pro (Video)
      if (model === 'seedance-1.5-pro') {
        cost = calculateVideoCost(
          video_resolution || '720p',
          video_duration || '8',
          generate_audio ?? false
        )
      }
      // Dynamic pricing for GPT Image 1.5
      if (model === 'gpt-image-1.5') {
        const gpt_image_quality = req.body.gpt_image_quality || 'medium'
        cost = calculateGptImageCost(gpt_image_quality)
      }
      // Dynamic pricing for Kling T2V/I2V
      if (model === 'kling-t2v' || model === 'kling-i2v') {
        const kling_duration = req.body.kling_duration || '5'
        const kling_sound = req.body.kling_sound ?? false
        cost = calculateKlingCost('t2v', kling_duration, kling_sound)
      }
      // Dynamic pricing for Kling Motion Control
      if (model === 'kling-mc') {
        const kling_mc_quality = req.body.kling_mc_quality || '720p'
        const video_duration_seconds = req.body.video_duration_seconds || 5
        cost = calculateKlingCost('motion-control', '', false, kling_mc_quality, video_duration_seconds)
      }
      const q = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(user_id))}&select=balance,language_code`)
      const balance = Array.isArray(q.data) && q.data[0]?.balance != null ? Number(q.data[0].balance) : 0
      if (Array.isArray(q.data) && q.data[0]?.language_code) {
        languageCode = String(q.data[0].language_code)
      }

      if (balance < cost) {
        console.warn(`Insufficient balance for user ${user_id}. Required: ${cost}, Available: ${balance}`)
        return res.status(403).json({
          error: `Insufficient balance. Required: ${cost}, Available: ${balance}`
        })
      }

      // Умножить стоимость на количество изображений
      const totalCost = cost * imageCount

      if (balance < totalCost) {
        console.warn(`Insufficient balance for ${imageCount} images. Required: ${totalCost}, Available: ${balance}`)
        return res.status(403).json({
          error: `Insufficient balance. Required: ${totalCost}, Available: ${balance}`
        })
      }

      // Использовать totalCost для дальнейших операций
      cost = totalCost
    }

    // Create Pending Generation Record
    let generationId = 0
    const createdGenerationIds: number[] = []
    let r2Images: string[] = []

    if (user_id && Number(user_id)) {
      // Extract parent_id from request body
      const parent_id = req.body.parent_id

      // Wait for R2 uploads to complete before saving to DB
      try {
        r2Images = await r2ImagesPromise
      } catch (e) {
        console.error('Failed to await R2 images:', e)
        r2Images = images || [] // Fallback to original images
      }

      // Prepare metadata string
      const metadata = {
        ratio: aspect_ratio,
        imagesCount: images ? images.length : 0
      }
      const type = (metadata.imagesCount > 0) ? 'text_photo' : 'text'
      const ratio = metadata.ratio || '1:1'
      const photos = metadata.imagesCount
      const metaString = ` [type=${type}; ratio=${ratio}; photos=${photos}; avatars=0]`

      // Для слепого ремикса сохраняем placeholder вместо оригинального промпта
      const dbPrompt = isBlindRemix
        ? `🔒 Prompt from @${blindRemixAuthorUsername}`
        : prompt
      const promptWithMeta = dbPrompt + metaString

      // Insert pending record
      // Для GPT Image 1.5 используем gptimage1.5 в БД
      const dbModel = model === 'gpt-image-1.5' ? 'gptimage1.5' : model
      const dbParentId = (typeof parent_id === 'string' && (parent_id.startsWith('p') || parent_id.startsWith('P'))) ? null : parent_id;
      const genBody: any = {
        user_id: Number(user_id),
        prompt: promptWithMeta,
        model: dbModel,
        status: 'pending',
        input_images: r2Images.length > 0 ? r2Images : undefined,
        parent_id: dbParentId,
        // Для слепого ремикса сразу устанавливаем is_prompt_private
        is_prompt_private: isBlindRemix ? true : undefined,
        cost: cost,
        resolution: resolution
      }

      console.log('[DB] Creating pending generation record...')
      const genRes = await supaPost('generations', genBody)
      if (genRes.ok && Array.isArray(genRes.data) && genRes.data.length > 0) {
        generationId = genRes.data[0].id
        createdGenerationIds.push(generationId)
        console.log('[DB] Pending generation created, ID:', generationId)

        // Register prompt for authorship tracking (async, don't wait)
        if (!isBlindRemix) {
          registerPromptInDb(Number(user_id), prompt, generationId).catch(e => {
            console.error('[RegisterPrompt] Background registration failed:', e)
          })
        }

        // Списать токены СРАЗУ при создании генерации
        if (cost > 0) {
          const balQ = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(user_id))}&select=balance`)
          const currBal = Array.isArray(balQ.data) && balQ.data[0]?.balance != null ? Number(balQ.data[0].balance) : null
          if (typeof currBal === 'number') {
            const nextBal = Math.max(0, currBal - cost)
            await supaPatch('users', `?user_id=eq.${encodeURIComponent(String(user_id))}`, { balance: nextBal })
            logBalanceChange({ userId: Number(user_id), oldBalance: currBal, newBalance: nextBal, reason: 'generation', referenceId: generationId, metadata: { model } })
            console.log(`[DB] Balance debited at start for user ${user_id}: ${currBal} -> ${nextBal}`)
          }
        }

        // === KLING MOTION CONTROL VIDEO UPLOAD LOGIC (with upscaling) ===
        // Process video: check resolution, upscale if needed, then upload to R2
        if (model === 'kling-mc' && req.body.video_url && req.body.video_url.startsWith('data:video')) {
          const { processVideoForKling } = await import('../services/videoProcessingService.js')
          console.log(`[API] Processing reference video for Gen ${generationId}...`)
          try {
            const processed = await processVideoForKling(req.body.video_url)
            video_url = processed.url
            console.log(`[API] Reference video processed: ${processed.originalResolution} -> ${processed.newResolution}, upscaled: ${processed.upscaled}`)
            console.log(`[API] Reference video uploaded: ${video_url}`)

            // Update DB record with video input
            await supaPatch('generations', `?id=eq.${generationId}`, { video_input: video_url })
            console.log(`[DB] Updated generation ${generationId} with video_input`)

          } catch (e) {
            console.error(`[API] Failed to process/upload video for Gen ${generationId}`, e)
            throw new Error(`Video processing failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
          }
        }
        // === END KLING MC UPLOAD ===

      } else {
        console.error('Failed to create pending generation record', genRes)
        // We continue, but generationId will be 0, so meta won't be sent
      }
    }


    // Вызов Kie.ai API с таймаутом
    // Set a hard timeout for the entire generation process (e.g. 5 min) to avoid platform timeouts
    // For video: Seedance 6 min, Kling T2V/I2V 6 min, Kling MC 15 min
    let GENERATION_TIMEOUT_MS = 300000 // default 5 min for images
    if (model === 'seedance-1.5-pro' || model === 'kling-t2v' || model === 'kling-i2v') {
      GENERATION_TIMEOUT_MS = 360000 // 6 min
    } else if (model === 'kling-mc') {
      GENERATION_TIMEOUT_MS = 1800000 // 30 min for Motion Control
    }

    console.log(`[API] Starting generation (imageCount: ${imageCount}) with timeout protection...`)

    // Для множественной генерации выполняем параллельные запросы
    const generateSingleImage = async (index: number) => {
      const singleGenPromise = generateImageWithKieAI(apiKey, {
        model,
        prompt,
        aspect_ratio,
        images: (r2Images && r2Images.length > 0) ? r2Images : images,
        negative_prompt,
        meta: generationId && index === 0 ? {
          generationId,
          tokens: cost / imageCount,
          userId: Number(user_id)
        } : undefined,
        resolution,
        google_search,
        video_duration,
        video_resolution,
        fixed_lens,
        generate_audio,
        gpt_image_quality: req.body.gpt_image_quality,
        // Kling параметры
        kling_duration,
        kling_sound,
        kling_mc_quality,
        character_orientation,
        video_url,
      }, async (taskId) => {
        if (generationId && index === 0) {
          console.log(`[API] Task ID received: ${taskId} for generation ${generationId}`)
          await supaPatch('generations', `?id=eq.${generationId}`, { task_id: taskId })
        }
      })

      const timeoutPromise = new Promise<KieAIResponse>((_, reject) => {
        setTimeout(() => reject(new Error('Generation process timed out')), GENERATION_TIMEOUT_MS)
      })

      return Promise.race([singleGenPromise, timeoutPromise])
    }

    // Выполняем параллельные генерации
    const generationPromises = Array.from({ length: imageCount }, (_, i) => generateSingleImage(i))
    const results = await Promise.allSettled(generationPromises)

    // Собираем успешные результаты
    const successfulImages: string[] = []
    let hasTimeout = false
    let lastError: string | null = null

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const kieResult = result.value
        if (kieResult.timeout) {
          hasTimeout = true
        } else if (kieResult.error) {
          lastError = kieResult.error
        } else if (kieResult.images && kieResult.images.length > 0) {
          successfulImages.push(kieResult.images[0])
        }
      } else {
        lastError = result.reason?.message || 'Generation failed'
      }
    }

    // Если все запросы завершились таймаутом
    if (successfulImages.length === 0 && hasTimeout) {
      console.log('[API] All generations timed out, generationId:', generationId)
      const mediaType = getMediaType(model)
      return res.json({
        status: 'pending',
        generationId: generationId,
        generation_ids: createdGenerationIds,
        primary_generation_id: generationId || createdGenerationIds[0] || null,
        media_type: mediaType,
        message: 'Генерация занимает больше времени. Результат будет в профиле или токены вернутся.'
      })
    }

    // Если все запросы завершились с ошибкой
    if (successfulImages.length === 0 && lastError) {
      console.error('[API] All generations failed with error:', lastError)

      let finalError = lastError
      if (finalError.toLowerCase().includes('text length') || finalError.toLowerCase().includes('limit')) {
        finalError = 'Длина текста превышает максимально допустимый лимит'
      } else if (finalError.toLowerCase().includes('nsfw') || finalError.toLowerCase().includes('flagged as sensitive')) {
        finalError = 'Из-за политик разработчика нейросети модель вернула ошибку. Попробуйте сгенерировать, выбрав модель Seedream (рекомендуем Seedream 4.5 для лучшего качества).'
      }

      // Mark as failed and REFUND tokens (with protection)
      if (generationId) {
        await supaPatch('generations', `?id=eq.${generationId}`, {
          status: 'failed',
          error_message: finalError
        })

        if (cost > 0 && user_id) {
          await safeRefund({ generationId, userId: Number(user_id), amount: cost, metadata: { model, error: finalError } })
        }
      }

      return res.status(500).json({ error: finalError })
    }

    // Успешная генерация
    console.log(`[API] Generation successful: ${successfulImages.length}/${imageCount} images`)

    // Первое изображение обрабатываем через completeGeneration (для основной записи в БД)
    if (successfulImages.length > 0 && generationId) {
      const firstImage = successfulImages[0]
      const dbParentId = (typeof req.body.parent_id === 'string' && (req.body.parent_id.startsWith('p') || req.body.parent_id.startsWith('P'))) ? null : req.body.parent_id;
      await completeGeneration(generationId, Number(user_id), firstImage, model, cost / imageCount, dbParentId, req.body.contest_entry_id, r2Images, resolution, languageCode)


      // Fetch user settings once for all extra notifications
      let userSettings: any = null
      try {
        if (Number(user_id)) {
          userSettings = await getUserNotificationSettings(Number(user_id))
        }
      } catch (e) { console.error('Failed to get user settings for extra notifications', e) }

      // Для дополнительных изображений создаём отдельные записи
      for (let i = 1; i < successfulImages.length; i++) {
        const extraImage = successfulImages[i]
        // Подготовить prompt с метаданными
        const metaStr = ` [type=${images && images.length > 0 ? 'text_photo' : 'text'}; ratio=${aspect_ratio || '1:1'}; photos=${images ? images.length : 0}; avatars=0]`
        const extraPrompt = isBlindRemix ? `🔒 Prompt from @${blindRemixAuthorUsername}` + metaStr : prompt + metaStr
        // Создать новую запись generation для дополнительного изображения
        const extraGenBody = {
          user_id: Number(user_id),
          prompt: extraPrompt,
          model: model === 'gpt-image-1.5' ? 'gptimage1.5' : model,
          status: 'completed',
          image_url: extraImage,
          completed_at: new Date().toISOString(),
          input_images: r2Images.length > 0 ? r2Images : undefined,
          cost: cost / imageCount,
          resolution: resolution,
          media_type: 'image'
        }
        const extraGenRes = await supaPost('generations', extraGenBody)
        let extraGenId = 0
        if (extraGenRes.ok && Array.isArray(extraGenRes.data) && extraGenRes.data.length > 0) {
          extraGenId = extraGenRes.data[0].id
          createdGenerationIds.push(extraGenId)
        }
        console.log(`[DB] Created extra generation record for image ${i + 1}`)

        // Send Telegram Notification for extra image
        if (userSettings && userSettings.telegram_generation) {
          try {
            let caption = '✨ Генерация завершена!'
            if (model === 'nanobanana-pro' && (resolution === '2K' || resolution === '4K')) {
              if (languageCode === 'en') {
                caption += "\n\n⚠️ The file is too large. Telegram does not show it in full quality. Save to gallery to view in detail."
              } else {
                caption += "\n\n⚠️ Файл слишком большой. Telegram не показывает его в полном качестве. Сохраните в галерею для детального просмотра."
              }
            }
            await tg('sendDocument', {
              chat_id: Number(user_id),
              document: extraImage,
              caption: caption
            })
            console.log(`[Notification] Sent extra photo ${i + 1} to user ${user_id}`)
          } catch (e) {
            console.error(`[Notification] Failed to send extra photo ${i + 1} to Telegram:`, e)
          }
        }

        // Create in-app notification for extra image
        if (extraGenId) {
          try {
            await createNotification(
              Number(user_id),
              'generation_completed',
              'Генерация готова ✨',
              'Ваше изображение создано',
              { generation_id: extraGenId, deep_link: `/profile?gen=${extraGenId}` }
            )
          } catch (e) { console.error('[Notification] Failed to create in-app notification for extra image:', e) }
        }
      }
    }

    // Вернуть все успешные изображения
    return res.json({
      image: successfulImages[0], // Обратная совместимость
      images: successfulImages,   // Новый формат для множественной генерации
      prompt: prompt,
      model: model,
      generation_ids: createdGenerationIds,
      primary_generation_id: generationId || createdGenerationIds[0] || null,
      media_type: getMediaType(model),
    })

  } catch (error) {
    console.error('Generation error:', error)
    // Try to update DB status if possible (we might not have generationId in scope easily here if it failed early,
    // but usually we want to catch it inside the main logic. This is a fallback.)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

export async function handleCheckPendingGenerations(req: Request, res: Response) {
  const { user_id } = req.body
  if (!user_id) return res.status(400).json({ error: 'user_id is required' })

  console.log(`[CheckStatus] Checking pending generations for user ${user_id}`)

  // Fetch user language code
  let languageCode = 'ru'
  try {
    const uQ = await supaSelect('users', `?user_id=eq.${user_id}&select=language_code`)
    if (uQ.ok && Array.isArray(uQ.data) && uQ.data[0]) {
      languageCode = uQ.data[0].language_code || 'ru'
    }
  } catch (e) {
    console.error('[CheckStatus] Failed to fetch language code', e)
  }

  // Get pending generations (all of them, to handle missing task_id too)
  // Note: use 'ilike' pattern to catch statuses with leading/trailing spaces from other bots' data
  const q = await supaSelect('generations', `?user_id=eq.${user_id}&status=ilike.*pending*&select=*,input_images`)
  if (!q.ok || !Array.isArray(q.data)) {
    return res.json({ checked: 0, updated: 0 })
  }

  const pending = q.data
  let updated = 0
  const apiKey = process.env.KIE_API_KEY || ''

  // Расширенное логирование
  console.log(`[CheckStatus] Found ${pending.length} pending generation(s):`)
  for (const gen of pending) {
    console.log(`  - ID: ${gen.id}, model: ${gen.model}, task_id: ${gen.task_id || 'MISSING'}, api_provider: ${gen.api_provider || 'kie'}, cost: ${gen.cost || 0}`)
  }

  for (const gen of pending) {
    // Handle missing model AND task_id - mark as failed
    if (!gen.model && !gen.task_id) {
      console.log(`[CheckStatus] Gen ${gen.id} missing both model and task_id, marking failed`)

      // Атомарно обновить статус ТОЛЬКО если ещё pending (защита от race condition)
      const updateRes = await supaPatchAtomic('generations',
        `?id=eq.${gen.id}&status=eq.pending`,
        { status: 'failed', error_message: 'Missing model and task ID' }
      )

      // Если ничего не обновлено - другой запрос уже обработал
      if (updateRes.data.length === 0) {
        console.log(`[CheckStatus] Gen ${gen.id} already processed, skipping refund`)
        continue
      }

      // Возврат токенов ONLY после успешного атомарного обновления (с защитой)
      const cost = gen.cost || 0
      if (cost > 0) {
        await safeRefund({ generationId: gen.id, userId: gen.user_id, amount: cost, metadata: { model: gen.model, error: 'Missing model and task ID' } })
      }

      updated++
      continue
    }

    // Handle missing task_id (but has model)
    if (!gen.task_id) {
      console.log(`[CheckStatus] Gen ${gen.id} missing task_id, marking failed`)

      // Атомарно обновить статус ТОЛЬКО если ещё pending (защита от race condition)
      const updateRes = await supaPatchAtomic('generations',
        `?id=eq.${gen.id}&status=eq.pending`,
        { status: 'failed', error_message: 'Missing task ID' }
      )

      // Если ничего не обновлено - другой запрос уже обработал
      if (updateRes.data.length === 0) {
        console.log(`[CheckStatus] Gen ${gen.id} already processed, skipping refund`)
        continue
      }

      // Возврат токенов ONLY после успешного атомарного обновления (с защитой)
      const cost = gen.cost || (gen.model ? MODEL_PRICES[gen.model] : 0) || 0
      if (cost > 0) {
        await safeRefund({ generationId: gen.id, userId: gen.user_id, amount: cost, metadata: { model: gen.model, error: 'Missing task ID' } })
      }

      updated++
      continue
    }

    let result = { status: 'pending', imageUrl: '', error: '' }

    // Определить провайдер API (по умолчанию kie)
    const provider = gen.api_provider || 'kie'

    try {
      if (provider === 'piapi') {
        // Проверка Piapi генерации
        console.log(`[CheckStatus] Checking Piapi gen ${gen.id} with task_id ${gen.task_id}...`)
        const piapiResult = await checkPiapiTask(gen.task_id)

        if (piapiResult.code === 200 && piapiResult.data) {
          const status = piapiResult.data.status

          if (status === 'completed') {
            const imageUrl = piapiResult.data.output?.image_url ||
              piapiResult.data.output?.image_urls?.[0]
            if (imageUrl) {
              result = { status: 'success', imageUrl, error: '' }
            }
          } else if (status === 'failed') {
            const errorMsg = piapiResult.data.error?.message || 'Piapi task failed'
            result = { status: 'failed', imageUrl: '', error: errorMsg }
          }
          // Если pending - оставляем result как есть
        }
        console.log(`[CheckStatus] Piapi gen ${gen.id} result: status=${result.status}, hasUrl=${!!result.imageUrl}, error=${result.error || 'none'}`)
      } else {
        // Проверка Kie.ai генерации (существующий код)
        console.log(`[CheckStatus] Checking Kie gen ${gen.id} with task_id ${gen.task_id}...`)
        result = await checkJobsTask(apiKey, gen.task_id)
        console.log(`[CheckStatus] Kie gen ${gen.id} result: status=${result.status}, hasUrl=${!!result.imageUrl}, error=${result.error || 'none'}`)
      }

      if (result.status === 'success' && result.imageUrl) {
        let cost = gen.cost

        // Fallback cost calculation if not saved
        if (typeof cost !== 'number') {
          if (gen.model === 'nanobanana-pro' && gen.resolution === '2K') {
            cost = 10
          } else {
            cost = MODEL_PRICES[gen.model] || 0
          }
        }

        await completeGeneration(gen.id, gen.user_id, result.imageUrl, gen.model, cost, gen.parent_id, undefined, gen.input_images, gen.resolution, languageCode)
        updated++
      } else if (result.status === 'failed') {
        // Атомарно обновить статус ТОЛЬКО если ещё pending (защита от race condition)
        const updateRes = await supaPatchAtomic('generations',
          `?id=eq.${gen.id}&status=eq.pending`,
          { status: 'failed', error_message: result.error }
        )

        // Если ничего не обновлено - другой запрос уже обработал
        if (updateRes.data.length === 0) {
          console.log(`[CheckStatus] Gen ${gen.id} already processed, skipping refund`)
          continue
        }

        // Возврат токенов ТОЛЬКО после успешного атомарного обновления (с защитой)
        const cost = gen.cost || MODEL_PRICES[gen.model] || 0
        if (cost > 0) {
          await safeRefund({ generationId: gen.id, userId: gen.user_id, amount: cost, metadata: { model: gen.model, error: result.error } })
        }

        updated++
      }
    } catch (e) {
      console.error(`[CheckStatus] Error checking ${provider} gen ${gen.id}:`, e)
    }
  }

  return res.json({ checked: pending.length, updated })
}

// Get generation by ID for remix functionality
export async function getGenerationById(req: Request, res: Response) {
  console.log('[getGenerationById] === REQUEST RECEIVED ===')
  try {
    const { id } = req.params
    console.log('[getGenerationById] Requested ID:', id)

    if (!id) {
      console.log('[getGenerationById] ERROR: No ID provided')
      return res.status(400).json({ error: 'Generation ID required' })
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.log('[getGenerationById] ERROR: Supabase not configured')
      return res.status(500).json({ error: 'Database not configured' })
    }

    if (typeof id === 'string' && (id.startsWith('p') || id.startsWith('P'))) {
      const numericId = id.substring(1)
      const query = `?id=eq.${numericId}&select=id,prompt_text,author_user_id,users(username,first_name)`
      const result = await supaSelect('author_prompts', query)

      if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
        return res.status(404).json({ error: 'Author prompt not found' })
      }

      const promptData = result.data[0]
      return res.json({
        id,
        prompt: promptData.prompt_text,
        is_prompt_private: false,
        model: 'nanobanana-pro',
        input_images: [],
        aspect_ratio: '1:1',
        generation_type: 'text',
        media_type: 'image',
        users: promptData.users,
        status: 'completed',
        error_message: null
      })
    }

    // Fetch generation - include video_url and video_input for video generations
    // Note: aspect_ratio not in DB, extracted from prompt metadata
    const query = `?id=eq.${id}&select=id,prompt,model,input_images,image_url,video_url,video_input,user_id,status,media_type,is_prompt_private,error_message,users(username,first_name)`
    console.log('[getGenerationById] Query:', query)

    const result = await supaSelect('generations', query)
    console.log('[getGenerationById] Supabase result.ok:', result.ok, 'data length:', Array.isArray(result.data) ? result.data.length : 'not array')

    // Log error details if query failed
    if (!result.ok) {
      console.error('[getGenerationById] Supabase error response:', JSON.stringify(result.data))
    }

    if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
      console.log('[getGenerationById] ERROR: Generation not found or query failed')
      return res.status(404).json({ error: 'Generation not found' })
    }

    const gen = result.data[0]
    console.log('[getGenerationById] Found generation:', {
      id: gen.id,
      model: gen.model,
      status: gen.status,
      media_type: gen.media_type,
      aspect_ratio: gen.aspect_ratio,
      prompt_length: gen.prompt?.length,
      has_input_images: !!gen.input_images?.length
    })

    // Check if generation is deleted
    if (gen.status === 'deleted') {
      console.log('[getGenerationById] ERROR: Generation is deleted')
      return res.status(404).json({ error: 'Generation not found' })
    }

    // Parse metadata from prompt to extract ratio, type etc.
    let cleanPrompt = gen.prompt || ''
    let ratio = '1:1'
    let type = 'text'

    // Extract metadata from prompt: [type=text_photo; ratio=3:4; photos=1; avatars=0]
    const metaMatch = cleanPrompt.match(/\s*\[type=([^;]+);\s*ratio=([^;]+);[^\]]*\]\s*$/)
    if (metaMatch) {
      type = metaMatch[1]
      ratio = metaMatch[2]
      cleanPrompt = cleanPrompt.replace(/\s*\[type=[^\]]+\]\s*$/, '').trim()
    }

    const response = {
      id: gen.id,
      prompt: cleanPrompt, // Always return prompt for generation to work
      is_prompt_private: !!gen.is_prompt_private,
      model: gen.model,
      input_images: gen.input_images || [],
      image_url: gen.image_url,
      video_url: gen.video_url,
      video_input: gen.video_input || null, // For Kling MC remix
      aspect_ratio: ratio,
      generation_type: type,
      media_type: gen.media_type || (gen.model === 'seedance-1.5-pro' ? 'video' : 'image'),
      users: gen.users,
      status: gen.status, // Для polling в мульти-генерации
      error_message: gen.error_message || null, // Для отображения ошибок
    }

    console.log('[getGenerationById] Sending response:', {
      id: response.id,
      model: response.model,
      media_type: response.media_type,
      aspect_ratio: response.aspect_ratio,
      prompt_preview: response.prompt?.slice(0, 50)
    })
    console.log('[getGenerationById] === DONE ===')

    return res.json(response)
  } catch (e) {
    console.error('[getGenerationById] ERROR:', e)
    return res.status(500).json({ error: 'Failed to fetch generation' })
  }
}

// Soft delete generation by setting status to 'deleted'
export async function deleteGeneration(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { user_id } = req.body

    if (!id) {
      return res.status(400).json({ error: 'Generation ID required' })
    }

    if (!user_id) {
      return res.status(400).json({ error: 'User ID required' })
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    // Verify ownership
    const query = `?id=eq.${id}&user_id=eq.${user_id}&select=id,status`
    const result = await supaSelect('generations', query)

    if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
      return res.status(403).json({ error: 'Generation not found or not owned by user' })
    }

    const gen = result.data[0]

    // Check if already deleted
    if (gen.status === 'deleted') {
      return res.json({ ok: true, message: 'Already deleted' })
    }

    // Soft delete by updating status
    const updateRes = await supaPatch('generations', `?id=eq.${id}`, { status: 'deleted' })

    if (!updateRes.ok) {
      return res.status(500).json({ error: 'Failed to delete generation' })
    }

    console.log(`[Delete] Generation ${id} soft deleted by user ${user_id}`)
    return res.json({ ok: true })
  } catch (e) {
    console.error('deleteGeneration error:', e)
  }
}

export async function deleteEditVariant(req: Request, res: Response) {
  try {
    const { id, index } = req.params
    const { user_id } = req.body
    const variantIndex = parseInt(index, 10)

    if (!id) {
      return res.status(400).json({ error: 'Generation ID required' })
    }

    if (!user_id) {
      return res.status(400).json({ error: 'User ID required' })
    }

    if (isNaN(variantIndex) || variantIndex < 0) {
      return res.status(400).json({ error: 'Valid variant index required' })
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    // Verify ownership and get current edit_variants
    const query = `?id=eq.${id}&user_id=eq.${user_id}&select=id,edit_variants`
    const result = await supaSelect('generations', query)

    if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
      return res.status(403).json({ error: 'Generation not found or not owned by user' })
    }

    const gen = result.data[0]
    const editVariants = gen.edit_variants || []

    // Validate index is within bounds
    if (variantIndex >= editVariants.length) {
      return res.status(400).json({ error: 'Variant index out of bounds' })
    }

    // Remove the variant at the specified index
    const newVariants = [...editVariants]
    newVariants.splice(variantIndex, 1)

    // Update the generation with the new variants array
    const updateRes = await supaPatch('generations', `?id=eq.${id}`, {
      edit_variants: newVariants.length > 0 ? newVariants : null
    })

    if (!updateRes.ok) {
      return res.status(500).json({ error: 'Failed to delete variant' })
    }

    console.log(`[Delete] Edit variant ${variantIndex} deleted from generation ${id} by user ${user_id}`)
    return res.json({ ok: true, remaining_variants: newVariants })
  } catch (e) {
    console.error('deleteEditVariant error:', e)
    return res.status(500).json({ error: 'Failed to delete variant' })
  }
}

// Get count of pending generations for a user
export async function getPendingCount(req: Request, res: Response) {
  try {
    const user_id = req.query.user_id
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' })
    }

    const q = await supaSelect('generations', `?user_id=eq.${user_id}&status=eq.pending&select=id`)
    if (!q.ok || !Array.isArray(q.data)) {
      return res.json({ count: 0 })
    }

    return res.json({ count: q.data.length })
  } catch (e) {
    console.error('getPendingCount error:', e)
    return res.json({ count: 0 })
  }
}

// Toggle prompt privacy for a generation
export async function togglePromptPrivacy(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { is_prompt_private } = req.body
    const authUserId = Number((req as any).user?.id || 0)

    if (!id) {
      return res.status(400).json({ error: 'Generation ID required' })
    }

    if (!authUserId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (typeof is_prompt_private !== 'boolean') {
      return res.status(400).json({ error: 'is_prompt_private must be a boolean' })
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    // Verify ownership first
    const ownerCheck = await supaSelect('generations', `?id=eq.${id}&user_id=eq.${authUserId}&select=id`)
    if (!ownerCheck.ok || !Array.isArray(ownerCheck.data) || ownerCheck.data.length === 0) {
      return res.status(403).json({ error: 'Generation not found or not owned by user' })
    }

    // Update the privacy flag
    const updateRes = await supaPatch('generations', `?id=eq.${id}`, {
      is_prompt_private: is_prompt_private
    })

    if (!updateRes.ok) {
      console.error('[togglePromptPrivacy] Failed to update:', updateRes)
      return res.status(500).json({ error: 'Failed to update privacy setting' })
    }

    console.log(`[Privacy] Generation ${id} is_prompt_private set to ${is_prompt_private}`)
    return res.json({ ok: true, is_prompt_private })
  } catch (e) {
    console.error('togglePromptPrivacy error:', e)
    return res.status(500).json({ error: 'Failed to toggle privacy' })
  }
}

// Background Removal (editor)
export async function handleRemoveBackground(req: Request, res: Response) {
  console.log('[Editor] Remove background request received')
  try {
    const { user_id, images, source_generation_id } = req.body

    const userId = Number(user_id)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'No image provided' })
    }

    const price = 1

    // 1. Check balance
    const userRes = await supaSelect('users', `?user_id=eq.${userId}&select=balance`)
    const balance = userRes?.data?.[0]?.balance || 0

    if (balance < price) {
      return res.status(403).json({ error: 'insufficient_balance', required: price, current: balance })
    }

    // 2. Upload input image to R2 (temp)
    const imageData = images[0]
    let imageUrl = imageData

    if (imageData.startsWith('data:')) {
      // Process with sharp to ensure PNG
      const base64Match = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
      const base64Data = base64Match ? base64Match[2] : imageData
      const inputBuffer = Buffer.from(base64Data, 'base64')

      const pngBuffer = await sharp(inputBuffer).png().toBuffer()
      const base64Png = `data:image/png;base64,${pngBuffer.toString('base64')}`

      imageUrl = await uploadImageFromBase64(base64Png, 'editor-source')
    }

    // 3. Create Kie.ai task
    const kieApiKey = process.env.KIE_API_KEY
    if (!kieApiKey) {
      throw new Error('KIE_API_KEY not configured')
    }

    const createTaskRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kieApiKey}`
      },
      body: JSON.stringify({
        model: 'recraft/remove-background',
        input: { image: imageUrl }
      })
    })

    const createTaskData = await createTaskRes.json()

    if (createTaskData.code !== 200 || !createTaskData.data?.taskId) {
      throw new Error(createTaskData.msg || 'Failed to create task')
    }

    const taskId = createTaskData.data.taskId

    // 4. Poll for result
    const timeout = 60000
    const startTime = Date.now()
    let resultUrl = null

    while (Date.now() - startTime < timeout) {
      await new Promise(r => setTimeout(r, 2000))

      const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: { 'Authorization': `Bearer ${kieApiKey}` }
      })
      const statusData = await statusRes.json()

      if (statusData.data?.state === 'success' && statusData.data.resultJson) {
        const result = JSON.parse(statusData.data.resultJson)
        resultUrl = result.resultUrls?.[0]
        break
      } else if (statusData.data?.state === 'fail') {
        throw new Error(statusData.data.failMsg || 'Background removal failed')
      }
    }

    if (!resultUrl) {
      throw new Error('Timeout waiting for background removal')
    }

    // 5. Download and Process
    const resultRes = await fetch(resultUrl)
    const resultBuffer = Buffer.from(await resultRes.arrayBuffer())

    const processedBuffer = await sharp(resultBuffer)
      .ensureAlpha()
      .trim()
      .png()
      .toBuffer()

    const base64Result = `data:image/png;base64,${processedBuffer.toString('base64')}`

    // 6. Upload final result to R2
    const publicUrl = await uploadImageFromBase64(base64Result, 'editor-result')

    // 7. Deduct balance
    await supaPatch('users', `?user_id=eq.${userId}`, { balance: balance - price })
    logBalanceChange({ userId, oldBalance: balance, newBalance: balance - price, reason: 'editor', referenceId: source_generation_id, metadata: { action: 'remove-background' } })

    // 8. Record in generations table
    let newGenId = null
    if (source_generation_id) {
      // Append to existing variants
      const genRes = await supaSelect('generations', `?id=eq.${source_generation_id}&select=edit_variants`)
      const existingVariants = genRes?.data?.[0]?.edit_variants || []
      const newVariants = [...existingVariants, publicUrl]

      await supaPatch('generations', `?id=eq.${source_generation_id}`, {
        edit_variants: newVariants
      })
    } else {
      // Create new generation record (use existing function usage pattern or simple insert)
      const genBody = {
        user_id: userId,
        image_url: publicUrl,
        model: 'remove-background',
        prompt: 'Remove Background',
        is_edited: true,
        status: 'completed'
      }
      const insertRes = await supaPost('generations', genBody)
      newGenId = insertRes?.data?.[0]?.id
    }

    return res.json({
      image: publicUrl,
      generation_id: newGenId,
      source_generation_id: source_generation_id || null
    })

  } catch (error) {
    console.error('handleRemoveBackground error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Background removal failed'
    })
  }
}

// Upscale (crisp-upscale) - Улучшение качества
export async function handleUpscale(req: Request, res: Response) {
  console.log('[Editor] Upscale request received')
  try {
    const { user_id, images, source_generation_id } = req.body

    const userId = Number(user_id)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (!images || images.length === 0) {
      return res.status(400).json({ error: 'No image provided' })
    }

    const price = 1

    // 1. Check balance
    const userRes = await supaSelect('users', `?user_id=eq.${userId}&select=balance`)
    const balance = userRes?.data?.[0]?.balance || 0

    if (balance < price) {
      return res.status(403).json({ error: 'insufficient_balance', required: price, current: balance })
    }

    // 2. Prepare image URL
    const imageData = images[0]
    let imageUrl = imageData

    // If base64, upload temporarily to R2 for API consumption
    if (imageData.startsWith('data:')) {
      const base64Match = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
      const base64Data = base64Match ? base64Match[2] : imageData
      const inputBuffer = Buffer.from(base64Data, 'base64')

      const pngBuffer = await sharp(inputBuffer).png().toBuffer()
      const base64Png = `data:image/png;base64,${pngBuffer.toString('base64')}`

      imageUrl = await uploadImageFromBase64(base64Png, 'editor-source')
    }

    // 3. Create Kie.ai task
    const kieApiKey = process.env.KIE_API_KEY
    if (!kieApiKey) {
      throw new Error('KIE_API_KEY not configured')
    }

    console.log('[Upscale] Image URL for API:', imageUrl)

    const createTaskRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${kieApiKey}`
      },
      body: JSON.stringify({
        model: 'recraft/crisp-upscale',
        input: { image: imageUrl }
      })
    })

    const createTaskData = await createTaskRes.json()
    console.log('[Upscale] Create task response:', JSON.stringify(createTaskData))

    if (createTaskData.code !== 200 || !createTaskData.data?.taskId) {
      throw new Error(createTaskData.msg || 'Failed to create upscale task')
    }

    const taskId = createTaskData.data.taskId

    // 4. Poll for result
    const timeout = 120000 // 2 minutes for upscale
    const startTime = Date.now()
    let resultUrl = null

    while (Date.now() - startTime < timeout) {
      await new Promise(r => setTimeout(r, 2000))

      const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: { 'Authorization': `Bearer ${kieApiKey}` }
      })
      const statusData = await statusRes.json()

      if (statusData.data?.state === 'success' && statusData.data.resultJson) {
        const result = JSON.parse(statusData.data.resultJson)
        resultUrl = result.resultUrls?.[0]
        break
      } else if (statusData.data?.state === 'fail') {
        throw new Error(statusData.data.failMsg || 'Upscale failed')
      }
    }

    if (!resultUrl) {
      throw new Error('Timeout waiting for upscale')
    }

    // 5. Deduct balance
    await supaPatch('users', `?user_id=eq.${userId}`, { balance: balance - price })
    logBalanceChange({ userId, oldBalance: balance, newBalance: balance - price, reason: 'editor', referenceId: source_generation_id, metadata: { action: 'upscale' } })

    // 6. Record in generations table (store API result URL directly)
    let newGenId = null
    if (source_generation_id) {
      // Append to existing variants
      const genRes = await supaSelect('generations', `?id=eq.${source_generation_id}&select=edit_variants`)
      const existingVariants = genRes?.data?.[0]?.edit_variants || []
      const newVariants = [...existingVariants, resultUrl]

      await supaPatch('generations', `?id=eq.${source_generation_id}`, {
        edit_variants: newVariants
      })
    } else {
      // Create new generation record
      const genBody = {
        user_id: userId,
        image_url: resultUrl,
        model: 'upscale',
        prompt: 'Upscale',
        is_edited: true,
        status: 'completed'
      }
      const insertRes = await supaPost('generations', genBody)
      newGenId = insertRes?.data?.[0]?.id
    }

    return res.json({
      image: resultUrl,
      generation_id: newGenId,
      source_generation_id: source_generation_id || null
    })

  } catch (error) {
    console.error('handleUpscale error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Upscale failed'
    })
  }
}

// ============================================================================
// Multi-Model Generation - Генерация на нескольких моделях параллельно
// ============================================================================

interface MultiModelRequest {
  model: string
  aspect_ratio: string
  resolution?: '1K' | '2K' | '4K'
  gpt_image_quality?: 'medium' | 'high'
  google_search?: boolean
}

// Цены моделей для мульти-генерации
function getMultiModelPrice(model: string, gptQuality?: string, resolution?: string): number {
  if (model === 'gpt-image-1.5') {
    return GPT_IMAGE_PRICES[gptQuality || 'medium'] || 5
  }
  if (model === 'nanobanana-pro' && resolution === '2K') {
    return 10
  }
  return MODEL_PRICES[model] || 0
}

// Возврат токенов пользователю с защитой от двойного рефанда
async function refundTokens(userId: number, amount: number, generationId?: number, metadata?: Record<string, unknown>): Promise<void> {
  if (!userId || amount <= 0) return

  // Если есть generationId, используем защищённый рефанд
  if (generationId) {
    const result = await safeRefund({ generationId, userId, amount, metadata })
    if (result.alreadyRefunded) {
      console.log(`[Refund] Generation ${generationId} already refunded, skipping`)
    }
    return
  }

  // Fallback для случаев без generationId (legacy)
  try {
    const userResult = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(userId))}&select=balance`)
    if (userResult.ok && Array.isArray(userResult.data) && userResult.data.length > 0) {
      const currentBalance = userResult.data[0].balance || 0
      const newBalance = currentBalance + amount
      await supaPatch('users', `?user_id=eq.${encodeURIComponent(String(userId))}`, { balance: newBalance })
      logBalanceChange({ userId, oldBalance: currentBalance, newBalance, reason: 'refund', metadata })
      console.log(`[Refund] Returned ${amount} tokens to user ${userId}: ${currentBalance} -> ${newBalance}`)
    }
  } catch (e) {
    console.error('[Refund] Failed to refund tokens:', e)
  }
}

// Генерация одной модели (обёртка для параллельного вызова)
async function generateSingleModel(
  apiKey: string,
  modelRequest: MultiModelRequest,
  prompt: string,
  images: string[],
  userId: number,
  generationId: number
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const { model, aspect_ratio, resolution, gpt_image_quality, google_search } = modelRequest

    // Подготовить input images
    let imageUrls: string[] = []
    if (images && images.length > 0) {
      imageUrls = images.map(img => {
        if (typeof img === 'string') {
          if (img.startsWith('http')) return img
          const saved = saveBase64Image(img)
          return saved.publicUrl
        }
        return ''
      }).filter(Boolean)
    }

    // Prepare metadata
    const cost = getMultiModelPrice(model, gpt_image_quality, resolution)
    const metaPayload = prepareKieMeta({
      generationId,
      tokens: cost,
      userId
    })

    // Вызов API в зависимости от модели
    const result = await generateImageWithKieAI(apiKey, {
      model,
      prompt,
      aspect_ratio,
      images: imageUrls,
      resolution,
      gpt_image_quality,
      google_search,
      meta: { generationId, tokens: cost, userId }
    }, async (taskId) => {
      if (generationId) {
        await supaPatch('generations', `?id=eq.${generationId}`, { task_id: taskId })
      }
    })

    if (result.timeout) {
      // Оставляем pending — webhook обработает
      console.log(`[MultiGen] Model ${model} timed out, staying pending`)
      return { success: false, error: 'Generation pending - will complete later' }
    }

    if (result.error) {
      console.error(`[MultiGen] Model ${model} failed:`, result.error)
      return { success: false, error: result.error }
    }

    if (result.images && result.images.length > 0) {
      return { success: true, imageUrl: result.images[0] }
    }

    return { success: false, error: 'No image returned' }

  } catch (e) {
    console.error(`[MultiGen] Exception for model:`, e)
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * /api/generation/generate/multi
 * Мульти-генерация на 1-3 моделях параллельно
 */
export async function handleMultiGenerate(req: Request, res: Response) {
  console.log('[MultiGen] Request received:', {
    modelsCount: req.body.models?.length,
    userId: req.body.user_id,
    hasImages: req.body.images?.length > 0
  })

  try {
    const { prompt, models, images, user_id } = req.body as {
      prompt: string
      models: MultiModelRequest[]
      images?: string[]
      user_id?: number
    }

    // 1. Валидация
    if (!models || !Array.isArray(models) || models.length < 1 || models.length > 3) {
      return res.status(400).json({ error: 'Select 1-3 models' })
    }

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    // Исключить видео-модели
    const hasVideoModel = models.some(m => m.model === 'seedance-1.5-pro')
    if (hasVideoModel) {
      return res.status(400).json({ error: 'Video models not supported in multi-generation' })
    }

    // Проверить что все модели валидны
    for (const m of models) {
      if (!MODEL_CONFIGS[m.model as keyof typeof MODEL_CONFIGS]) {
        return res.status(400).json({ error: `Invalid model: ${m.model}` })
      }
    }

    // 2. Подсчёт общей стоимости
    const totalCost = models.reduce((acc, m) => {
      return acc + getMultiModelPrice(m.model, m.gpt_image_quality, m.resolution)
    }, 0)

    console.log(`[MultiGen] Total cost: ${totalCost} tokens for ${models.length} models`)

    // 3. Проверка баланса
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    const userResult = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(user_id))}&select=balance`)
    if (!userResult.ok || !Array.isArray(userResult.data) || userResult.data.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const currentBalance = userResult.data[0].balance || 0
    if (currentBalance < totalCost) {
      console.warn(`[MultiGen] Insufficient balance. Required: ${totalCost}, Available: ${currentBalance}`)
      return res.status(403).json({
        error: `Insufficient balance. Required: ${totalCost}, Available: ${currentBalance}`
      })
    }

    // 4. Списать токены сразу
    await supaPatch('users', `?user_id=eq.${encodeURIComponent(String(user_id))}`, {
      balance: currentBalance - totalCost
    })
    console.log(`[MultiGen] Balance debited: ${currentBalance} -> ${currentBalance - totalCost}`)

    // 5. Создать записи generations для каждой модели (status: pending)
    const generationIds: number[] = []
    const modelCosts: number[] = []

    for (const m of models) {
      const cost = getMultiModelPrice(m.model, m.gpt_image_quality, m.resolution)
      modelCosts.push(cost)

      // Для GPT Image 1.5 используем gptimage1.5 в БД
      const dbModel = m.model === 'gpt-image-1.5' ? 'gptimage1.5' : m.model

      const genBody: any = {
        user_id: Number(user_id),
        prompt: prompt + ` [multi-gen; model=${m.model}; ratio=${m.aspect_ratio}]`,
        model: dbModel,
        status: 'pending',
        cost: cost,
        resolution: m.resolution
      }

      const genRes = await supaPost('generations', genBody)
      if (genRes.ok && Array.isArray(genRes.data) && genRes.data.length > 0) {
        generationIds.push(genRes.data[0].id)
        console.log(`[MultiGen] Created pending generation ${genRes.data[0].id} for model ${m.model}`)
      } else {
        console.error(`[MultiGen] Failed to create generation for model ${m.model}`)
        generationIds.push(0)
      }
    }

    // 6. API Key
    const apiKey = process.env.KIE_API_KEY
    if (!apiKey) {
      // Вернуть токены за каждую генерацию
      for (let i = 0; i < generationIds.length; i++) {
        if (generationIds[i] > 0) {
          await refundTokens(user_id, modelCosts[i] || 0, generationIds[i])
        }
      }
      return res.status(500).json({ error: 'API key not configured' })
    }

    // 7. Ответить сразу с generation_ids (не ждём завершения)
    res.json({
      status: 'started',
      generation_ids: generationIds,
      total_cost: totalCost
    })

    // 8. Запустить генерации параллельно в фоне
    Promise.allSettled(
      models.map((m, i) =>
        generateSingleModel(apiKey, m, prompt, images || [], user_id, generationIds[i])
      )
    ).then(async (results) => {
      console.log(`[MultiGen] All generations completed`)

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const genId = generationIds[i]
        const modelCost = modelCosts[i]
        const model = models[i].model

        if (result.status === 'fulfilled' && result.value.success && result.value.imageUrl) {
          // Успех — обновить generation
          const mediaType = 'image'
          await supaPatch('generations', `?id=eq.${genId}`, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            image_url: result.value.imageUrl,
            media_type: mediaType
          })
          console.log(`[MultiGen] Model ${model} completed successfully, genId: ${genId}`)

          // Уведомление
          try {
            await createNotification(
              user_id,
              'generation_completed',
              'Генерация готова ✨',
              `${model} завершена`,
              { generation_id: genId, deep_link: `/profile?gen=${genId}` }
            )
          } catch (e) {
            console.error('[MultiGen] Notification error:', e)
          }

          // Telegram уведомление
          try {
            const settings = await getUserNotificationSettings(user_id)
            if (settings.telegram_generation) {
              await tg('sendDocument', {
                chat_id: user_id,
                document: result.value.imageUrl,
                caption: `✨ Multi-Gen: ${model}`
              })
            }
          } catch (e) {
            console.error('[MultiGen] Telegram notification error:', e)
          }

        } else {
          // Ошибка — вернуть токены за эту модель
          const errorMsg = result.status === 'rejected'
            ? (result.reason?.message || 'Generation failed')
            : (result.value?.error || 'Unknown error')

          // Обновить статус на failed
          await supaPatch('generations', `?id=eq.${genId}`, {
            status: 'failed',
            error_message: errorMsg
          })
          console.log(`[MultiGen] Model ${model} failed: ${errorMsg}, genId: ${genId}`)

          // Вернуть токены за эту модель (с защитой от двойного рефанда)
          await refundTokens(user_id, modelCost, genId)

          // Уведомление об ошибке
          try {
            await createNotification(
              user_id,
              'generation_failed',
              'Ошибка генерации ⚠️',
              `${model}: токены возвращены (+${modelCost})`,
              { generation_id: genId, refunded: modelCost }
            )
          } catch (e) {
            console.error('[MultiGen] Error notification failed:', e)
          }
        }
      }
    }).catch(err => {
      console.error('[MultiGen] Background processing error:', err)
    })

  } catch (error) {
    console.error('[MultiGen] Handler error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Multi-generation failed'
    })
  }
}

// ============ PiAPI Webhook Handler ============

/**
 * Handle webhook callbacks from PiAPI
 * Called when PiAPI completes or fails a NanoBanana Pro generation
 */
export async function handlePiapiWebhook(req: Request, res: Response) {
  try {
    const generationId = Number(req.query.generationId)
    const userId = Number(req.query.userId)
    const { data } = req.body

    console.log(`[PiAPI Webhook] Received for gen ${generationId}, status: ${data?.status}`)

    if (!generationId || !data) {
      return res.status(400).json({ error: 'Missing generationId or data' })
    }

    const status = data.status?.toLowerCase()

    if (status === 'completed' || status === 'success') {
      const imageUrl = data.output?.image_url ||
        data.output?.image_urls?.[0] ||
        data.result?.image_url ||
        data.result?.image_urls?.[0]

      if (imageUrl) {
        await supaPatch('generations', `?id=eq.${generationId}`, { api_provider: 'piapi' })

        const genData = await supaSelect('generations', `?id=eq.${generationId}&select=resolution`)
        let cost = 15
        if (genData.ok && Array.isArray(genData.data) && genData.data[0]?.resolution === '2K') {
          cost = 10
        }

        await completeGeneration(generationId, userId, imageUrl, 'nanobanana-pro', cost)
        console.log(`[PiAPI Webhook] Generation ${generationId} completed`)
      }
    } else if (status === 'failed' || status === 'error') {
      const errorMsg = data.error?.message || 'PiAPI generation failed'

      await supaPatch('generations', `?id=eq.${generationId}`, {
        status: 'failed',
        error_message: errorMsg,
        api_provider: 'piapi'
      })

      const genData = await supaSelect('generations', `?id=eq.${generationId}&select=cost`)
      const cost = genData.ok && Array.isArray(genData.data) ? (genData.data[0]?.cost || 15) : 15

      await safeRefund({ generationId, userId, amount: cost, metadata: { api_provider: 'piapi', error: errorMsg } })

      console.log(`[PiAPI Webhook] Generation ${generationId} failed, refunded ${cost}`)

    }

    res.json({ received: true })
  } catch (error) {
    console.error('[PiAPI Webhook] Error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}
