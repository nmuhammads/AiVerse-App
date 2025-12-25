import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

// Типы для запросов к Kie.ai
import { uploadImageFromBase64, uploadImageFromUrl, createThumbnail } from '../services/r2Service.js'
import { tg } from './telegramController.js'
import { createNotification, getUserNotificationSettings } from './notificationController.js'

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
  'qwen-edit': { kind: 'jobs' as const, model: 'qwen/text-or-image' },
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
  const url = process.env.WEBAPP_URL || process.env.VERCEL_URL || process.env.RAILWAY_PUBLIC_DOMAIN || null
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
        console.error(`[Jobs] Task ${taskId} failed:`, json.data.failMsg)
        throw new Error(json.data.failMsg || 'Jobs task failed')
      }
    }
    await new Promise(r => setTimeout(r, 2000))
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

const MODEL_PRICES: Record<string, number> = {
  nanobanana: 3,
  'nanobanana-pro': 15,
  seedream4: 4,
  'seedream4-5': 7,
  flux: 4,
}

async function completeGeneration(generationId: number, userId: number, imageUrl: string, model: string, cost: number, parentId?: number, contestEntryId?: number) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !userId || !generationId) return

  // 0. Check if already completed to prevent double charge
  const check = await supaSelect('generations', `?id=eq.${generationId}&select=status`)
  if (check.ok && Array.isArray(check.data) && check.data[0]?.status === 'completed') {
    console.log(`[DB] Generation ${generationId} already completed, skipping.`)
    return
  }

  console.log(`[DB] Completing generation ${generationId} for user ${userId}`)
  try {
    // 1. Update generation status
    const updateRes = await supaPatch('generations', `?id=eq.${generationId}`, {
      image_url: imageUrl,
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    console.log(`[DB] Generation ${generationId} status updated:`, updateRes.ok)

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
            if (model === 'nanobanana-pro') {
              rewardAmount = cost === 10 ? 2 : 3
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
          const caption = `✨ Генерация завершена!`
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
    if (imageUrl) {
      createThumbnail(imageUrl, imageUrl, `gen_${generationId}_thumb.jpg`).catch(err => {
        console.error(`[Thumbnail] Failed to generate thumbnail for ${generationId}:`, err)
      })
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
    const { model, prompt, aspect_ratio, images, negative_prompt, resolution } = requestData
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

    if (model === 'nanobanana' || model === 'nanobanana-pro') {
      const isPro = model === 'nanobanana-pro'
      const modelId = isPro ? 'nano-banana-pro' : (imageUrls.length > 0 ? 'google/nano-banana-edit' : 'google/nano-banana')

      const res = isPro ? (resolution || '4K') : undefined

      let image_size: string | undefined
      if (aspect_ratio !== 'Auto') {
        image_size = mapNanoBananaImageSize(aspect_ratio)
      }

      const input: Record<string, unknown> = {
        prompt,
        output_format: 'png'
      }

      // Old manual meta insertion removed, handled by metaPayload in createJobsTask

      if (imageUrls.length > 0) {
        if (isPro) {
          input.image_input = imageUrls
        } else {
          input.image_urls = imageUrls
        }
      }

      if (image_size) input.image_size = image_size
      if (aspect_ratio && aspect_ratio !== 'Auto') input.aspect_ratio = aspect_ratio

      if (isPro) {
        if (aspect_ratio && aspect_ratio !== 'Auto') {
          input.aspect_ratio = aspect_ratio
          delete input.image_size
        }
        if (res) input.resolution = res

        const taskId = await createJobsTask(apiKey, 'nano-banana-pro', input, onTaskCreated, metaPayload)
        const url = await pollJobsTask(apiKey, taskId)
        if (url === 'TIMEOUT') return { timeout: true, inputImages: imageUrls }
        return { images: [url], inputImages: imageUrls }
      } else {
        if (image_size) input.image_size = image_size
        const taskId = await createJobsTask(apiKey, modelId, input, onTaskCreated, metaPayload)
        const url = await pollJobsTask(apiKey, taskId)
        if (url === 'TIMEOUT') return { timeout: true, inputImages: imageUrls }
        return { images: [url], inputImages: imageUrls }
      }
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
    const { prompt, model, aspect_ratio, images, negative_prompt, user_id, resolution, contest_entry_id } = req.body

    // Валидация входных данных
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Prompt is required and must be a string'
      })
    }

    if (!model || !MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS]) {
      return res.status(400).json({
        error: 'Valid model is required. Available models: flux, seedream4, seedream4-5, nanobanana'
      })
    }

    // SIMULATION MODE
    if (prompt.trim().toLowerCase() === 'test') {
      await new Promise(resolve => setTimeout(resolve, 10000)) // Simulate delay

      const mockImage = 'https://placehold.co/1024x1024/png?text=Test+Generation'

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
        prompt: prompt,
        model: model
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
    let cost = 0
    if (user_id) {
      cost = MODEL_PRICES[model] ?? 0
      // Dynamic pricing for NanoBanana Pro
      if (model === 'nanobanana-pro' && resolution === '2K') {
        cost = 10
      }
      const q = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(user_id))}&select=balance`)
      const balance = Array.isArray(q.data) && q.data[0]?.balance != null ? Number(q.data[0].balance) : 0

      if (balance < cost) {
        console.warn(`Insufficient balance for user ${user_id}. Required: ${cost}, Available: ${balance}`)
        return res.status(403).json({
          error: `Insufficient balance. Required: ${cost}, Available: ${balance}`
        })
      }
    }

    // Create Pending Generation Record
    let generationId = 0
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
      const promptWithMeta = prompt + metaString

      // Insert pending record
      const genBody: any = {
        user_id: Number(user_id),
        prompt: promptWithMeta,
        model,
        status: 'pending',
        input_images: r2Images.length > 0 ? r2Images : undefined,
        parent_id: parent_id,

        cost: cost,
        resolution: resolution
      }

      console.log('[DB] Creating pending generation record...')
      const genRes = await supaPost('generations', genBody)
      if (genRes.ok && Array.isArray(genRes.data) && genRes.data.length > 0) {
        generationId = genRes.data[0].id
        console.log('[DB] Pending generation created, ID:', generationId)

        // Списать токены СРАЗУ при создании генерации
        if (cost > 0) {
          const balQ = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(user_id))}&select=balance`)
          const currBal = Array.isArray(balQ.data) && balQ.data[0]?.balance != null ? Number(balQ.data[0].balance) : null
          if (typeof currBal === 'number') {
            const nextBal = Math.max(0, currBal - cost)
            await supaPatch('users', `?user_id=eq.${encodeURIComponent(String(user_id))}`, { balance: nextBal })
            console.log(`[DB] Balance debited at start for user ${user_id}: ${currBal} -> ${nextBal}`)
          }
        }
      } else {
        console.error('Failed to create pending generation record', genRes)
        // We continue, but generationId will be 0, so meta won't be sent
      }
    }


    // Вызов Kie.ai API с таймаутом
    // Set a hard timeout for the entire generation process (e.g. 5 min) to avoid platform timeouts
    const GENERATION_TIMEOUT_MS = 300000

    const generationPromise = generateImageWithKieAI(apiKey, {
      model,
      prompt,
      aspect_ratio,
      images,
      negative_prompt,
      meta: generationId ? {
        generationId,
        tokens: cost,
        userId: Number(user_id)
      } : undefined,
      resolution
    }, async (taskId) => {
      if (generationId) {
        console.log(`[API] Task ID received: ${taskId} for generation ${generationId}`)
        await supaPatch('generations', `?id=eq.${generationId}`, { task_id: taskId })
      }
    })

    const timeoutPromise = new Promise<KieAIResponse>((_, reject) => {
      setTimeout(() => reject(new Error('Generation process timed out')), GENERATION_TIMEOUT_MS)
    })

    console.log('[API] Starting generation with timeout protection...')
    const result = await Promise.race([generationPromise, timeoutPromise])

    // Обработка таймаута — оставляем pending, не помечаем как failed
    if (result.timeout) {
      console.log('[API] Generation timed out but staying pending, generationId:', generationId)
      return res.json({
        status: 'pending',
        generationId: generationId,
        message: 'Генерация занимает больше времени. Результат будет в профиле или токены вернутся.'
      })
    }

    if (result.error) {
      console.error('[API] Generation failed with error:', result.error)

      // Localization (Backup for frontend)
      let finalError = result.error
      if (finalError.toLowerCase().includes('text length') || finalError.toLowerCase().includes('limit')) {
        finalError = 'Длина текста превышает максимально допустимый лимит'
      } else if (finalError.toLowerCase().includes('nsfw') || finalError.toLowerCase().includes('flagged as sensitive')) {
        finalError = 'Из-за политик разработчика нейросети модель вернула ошибку. Попробуйте сгенерировать, выбрав модель Seedream (рекомендуем Seedream 4.5 для лучшего качества).'
      }

      // Mark as failed and REFUND tokens if we created a record
      if (generationId) {
        await supaPatch('generations', `?id=eq.${generationId}`, {
          status: 'failed',
          error_message: finalError
        })
        console.log(`[DB] Generation ${generationId} marked as failed`)

        // Возврат токенов при ошибке
        if (cost > 0 && user_id) {
          const balQ = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(user_id))}&select=balance`)
          const currBal = Array.isArray(balQ.data) && balQ.data[0]?.balance != null ? Number(balQ.data[0].balance) : 0
          const nextBal = currBal + cost
          await supaPatch('users', `?user_id=eq.${encodeURIComponent(String(user_id))}`, { balance: nextBal })
          console.log(`[DB] Refunded ${cost} tokens to user ${user_id}: ${currBal} -> ${nextBal}`)

          // Уведомление об ошибке и возврате токенов
          try {
            await createNotification(
              Number(user_id),
              'generation_failed',
              'Ошибка генерации ⚠️',
              `Токены возвращены: +${cost}`,
              { refunded: cost }
            )
          } catch (e) {
            console.error('[Notification] Failed to create in-app notification:', e)
          }

          // Telegram уведомление об ошибке (if enabled in settings)
          try {
            const settings = await getUserNotificationSettings(Number(user_id))
            if (settings.telegram_generation) {
              await tg('sendMessage', {
                chat_id: user_id,
                text: `⚠️ <b>Ошибка генерации</b>\n\nГенерация не удалась. Токены возвращены: <b>+${cost}</b>\n\n<i>Попробуйте другой промпт или модель.</i>`,
                parse_mode: 'HTML'
              })
              console.log(`[Notification] Sent error telegram to user ${user_id}`)
            } else {
              console.log(`[Notification] Telegram generation disabled for user ${user_id}`)
            }
          } catch (e) {
            console.error('[Notification] Failed to send error telegram:', e)
          }
        }
      }
      return res.status(500).json({ error: finalError })
    }

    if (result.images && result.images.length > 0) {
      const imageUrl = result.images[0]
      if (generationId) {
        // Complete generation (update DB, rewards)
        // IMPORTANT: Await this to ensure DB is updated before response
        await completeGeneration(generationId, Number(user_id), imageUrl, model, cost, req.body.parent_id, req.body.contest_entry_id)
      }
      console.log('[API] Generation successful, sending response')
      return res.json({
        image: imageUrl,
        prompt: prompt,
        model: model
      })
    } else {
      console.error('[API] No images generated in result')
      if (generationId) {
        await supaPatch('generations', `?id=eq.${generationId}`, {
          status: 'failed',
          error_message: 'No images generated'
        })

        // Возврат токенов при ошибке "No images"
        if (cost > 0 && user_id) {
          const balQ = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(user_id))}&select=balance`)
          const currBal = Array.isArray(balQ.data) && balQ.data[0]?.balance != null ? Number(balQ.data[0].balance) : 0
          const nextBal = currBal + cost
          await supaPatch('users', `?user_id=eq.${encodeURIComponent(String(user_id))}`, { balance: nextBal })
          console.log(`[DB] Refunded ${cost} tokens to user ${user_id}: ${currBal} -> ${nextBal}`)
        }
      }
      return res.status(500).json({
        error: 'No images generated'
      })
    }

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

  // Get pending generations (all of them, to handle missing task_id too)
  const q = await supaSelect('generations', `?user_id=eq.${user_id}&status=eq.pending`)
  if (!q.ok || !Array.isArray(q.data)) {
    return res.json({ checked: 0, updated: 0 })
  }

  const pending = q.data
  let updated = 0
  const apiKey = process.env.KIE_API_KEY || ''

  for (const gen of pending) {
    if (!gen.model) continue

    // Handle missing task_id
    if (!gen.task_id) {
      console.log(`[CheckStatus] Gen ${gen.id} missing task_id, marking failed`)

      // Возврат токенов при missing task_id
      const cost = gen.cost || MODEL_PRICES[gen.model] || 0
      if (cost > 0) {
        const balQ = await supaSelect('users', `?user_id=eq.${gen.user_id}&select=balance`)
        const currBal = Array.isArray(balQ.data) && balQ.data[0]?.balance != null ? Number(balQ.data[0].balance) : 0
        const nextBal = currBal + cost
        await supaPatch('users', `?user_id=eq.${gen.user_id}`, { balance: nextBal })
        console.log(`[CheckStatus] Refunded ${cost} tokens to user ${gen.user_id}: ${currBal} -> ${nextBal}`)
      }

      await supaPatch('generations', `?id=eq.${gen.id}`, {
        status: 'failed',
        error_message: 'Missing task ID'
      })
      updated++
      continue
    }

    let result = { status: 'pending', imageUrl: '', error: '' }

    try {
      if (gen.model === 'flux') {
        result = await checkFluxTask(apiKey, gen.task_id)
      } else {
        result = await checkJobsTask(apiKey, gen.task_id)
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

        await completeGeneration(gen.id, gen.user_id, result.imageUrl, gen.model, cost, gen.parent_id)
        updated++
      } else if (result.status === 'failed') {
        // Возврат токенов при fail от провайдера
        const cost = gen.cost || MODEL_PRICES[gen.model] || 0
        if (cost > 0) {
          const balQ = await supaSelect('users', `?user_id=eq.${gen.user_id}&select=balance`)
          const currBal = Array.isArray(balQ.data) && balQ.data[0]?.balance != null ? Number(balQ.data[0].balance) : 0
          const nextBal = currBal + cost
          await supaPatch('users', `?user_id=eq.${gen.user_id}`, { balance: nextBal })
          console.log(`[CheckStatus] Refunded ${cost} tokens to user ${gen.user_id}: ${currBal} -> ${nextBal}`)
        }

        await supaPatch('generations', `?id=eq.${gen.id}`, {
          status: 'failed',
          error_message: result.error
        })
        updated++
      }
    } catch (e) {
      console.error(`[CheckStatus] Error checking gen ${gen.id}:`, e)
    }
  }

  return res.json({ checked: pending.length, updated })
}

// Get generation by ID for remix functionality
export async function getGenerationById(req: Request, res: Response) {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(400).json({ error: 'Generation ID required' })
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    // Fetch generation with user info
    const query = `?id=eq.${id}&select=id,prompt,model,input_images,image_url,user_id,status,users(username,first_name)`
    const result = await supaSelect('generations', query)

    if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
      return res.status(404).json({ error: 'Generation not found' })
    }

    const gen = result.data[0]

    // Check if generation is deleted
    if (gen.status === 'deleted') {
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

    return res.json({
      id: gen.id,
      prompt: cleanPrompt,
      model: gen.model,
      input_images: gen.input_images || [],
      image_url: gen.image_url,
      aspect_ratio: ratio,
      generation_type: type,
      users: gen.users
    })
  } catch (e) {
    console.error('getGenerationById error:', e)
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

// Delete a specific edit variant by index from edit_variants array
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
