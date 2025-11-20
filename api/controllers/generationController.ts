import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

// Типы для запросов к Kie.ai
interface KieAIRequest {
  model: string
  prompt: string
  aspect_ratio?: string
  image?: string
}

interface KieAIResponse {
  images?: string[]
  error?: string
}

// Конфигурация моделей
const MODEL_CONFIGS = {
  flux: { kind: 'flux-kontext' as const, model: 'flux-kontext-pro' },
  seedream4: { kind: 'jobs' as const, model: 'bytedance/seedream-v4-text-to-image' },
  nanobanana: { kind: 'jobs' as const, model: 'google/nano-banana-edit' },
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

async function createFluxTask(apiKey: string, prompt: string, aspectRatio?: string, inputImageUrl?: string) {
  const body: Record<string, unknown> = {
    prompt,
    aspectRatio: aspectRatio || '1:1',
    model: 'flux-kontext-pro',
  }
  if (inputImageUrl) body.inputImage = inputImageUrl
  const resp = await fetch('https://api.kie.ai/api/v1/flux/kontext/generate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const json = await resp.json()
  if (!resp.ok || json?.code !== 200) throw new Error(json?.msg || 'Flux task create failed')
  return String(json.data?.taskId || '')
}

const DEFAULT_TIMEOUT_MS = (() => { const v = Number(process.env.KIE_TASK_TIMEOUT_MS || 0); return Number.isFinite(v) && v > 0 ? v : 180000 })()

async function pollFluxTask(apiKey: string, taskId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const url = `https://api.kie.ai/api/v1/flux/kontext/record-info?taskId=${encodeURIComponent(taskId)}`
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } })
    const json = await resp.json().catch(() => null)
    if (json && json.code === 200 && json.data) {
      const s = json.data.successFlag
      if (s === 1 && json.data.response?.resultImageUrl) {
        return String(json.data.response.resultImageUrl)
      }
      if (s === 2 || s === 3) {
        throw new Error(json.data.errorMessage || 'Flux task failed')
      }
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error('Flux task timeout')
}

async function createJobsTask(apiKey: string, modelId: string, input: Record<string, unknown>) {
  const resp = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId, input })
  })
  const json = await resp.json()
  if (!resp.ok || json?.code !== 200) throw new Error(json?.msg || 'Jobs task create failed')
  return String(json.data?.taskId || '')
}

async function pollJobsTask(apiKey: string, taskId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const start = Date.now()
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
          if (first) return String(first)
        } catch { /* ignore */ }
      }
      if (state === 'fail') {
        throw new Error(json.data.failMsg || 'Jobs task failed')
      }
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error('Jobs task timeout')
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
  seedream4: 3,
  flux: 4,
  'qwen-edit': 3,
}

async function recordSuccessAndDeduct(userId: number, imageUrl: string, prompt: string, model: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !userId) return
  const cost = MODEL_PRICES[model] ?? 0
  try {
    await supaPost('generations', { user_id: userId, image_url: imageUrl, prompt })
    const q = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(userId))}&select=balance`)
    const curr = Array.isArray(q.data) && q.data[0]?.balance != null ? Number(q.data[0].balance) : null
    if (typeof curr === 'number') {
      const next = curr - cost
      await supaPatch('users', `?user_id=eq.${encodeURIComponent(String(userId))}`, { balance: next })
    }
  } catch {
    /* silent */
  }
}

// Функция для генерации изображения через Kie.ai
async function generateImageWithKieAI(
  apiKey: string,
  requestData: KieAIRequest
): Promise<KieAIResponse> {
  try {
    const { model, prompt, aspect_ratio, image } = requestData
    const cfg = MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS]

    const hasImage = Boolean(image)
    let imageUrl: string | undefined
    if (hasImage && typeof image === 'string') {
      const saved = saveBase64Image(image)
      imageUrl = saved.publicUrl
    }

    if (cfg.kind === 'flux-kontext') {
      const taskId = await createFluxTask(apiKey, prompt, aspect_ratio, imageUrl)
      const url = await pollFluxTask(apiKey, taskId)
      return { images: [url] }
    }

    if (model === 'seedream4') {
      const image_size = mapSeedreamImageSize(aspect_ratio)
      const input: Record<string, unknown> = { prompt }
      if (image_size) input.image_size = image_size
      input.image_resolution = '2K'
      if (hasImage && imageUrl) {
        const taskId = await createJobsTask(apiKey, 'bytedance/seedream-v4-edit', { ...input, image_urls: [imageUrl] })
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url] }
      } else {
        const taskId = await createJobsTask(apiKey, 'bytedance/seedream-v4-text-to-image', input)
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url] }
      }
    }

    if (model === 'nanobanana') {
      const image_size = mapNanoBananaImageSize(aspect_ratio)
      if (imageUrl) {
        const input: Record<string, unknown> = {
          prompt,
          image_urls: [imageUrl],
          output_format: 'png',
          image_size
        }
        const taskId = await createJobsTask(apiKey, 'google/nano-banana-edit', input)
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url] }
      } else {
        const input: Record<string, unknown> = { prompt, output_format: 'png' }
        if (image_size) input.image_size = image_size
        const taskId = await createJobsTask(apiKey, 'google/nano-banana', input)
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url] }
      }
    }

    if (model === 'qwen-edit') {
      if (imageUrl) {
        const input: Record<string, unknown> = { prompt, image_url: imageUrl, strength: 0.8, output_format: 'png', acceleration: 'none' }
        const taskId = await createJobsTask(apiKey, 'qwen/image-to-image', input)
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url] }
      } else {
        const image_size = mapQwenImageSize(aspect_ratio)
        const input: Record<string, unknown> = { prompt, output_format: 'png', enable_safety_checker: true }
        if (image_size) input.image_size = image_size
        const taskId = await createJobsTask(apiKey, 'qwen/text-to-image', input)
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url] }
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
  try {
    const { prompt, model, aspect_ratio, image, user_id } = req.body

    // Валидация входных данных
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ 
        error: 'Prompt is required and must be a string' 
      })
    }

    if (!model || !MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS]) {
      return res.status(400).json({ 
        error: 'Valid model is required. Available models: flux, seedream4, nanobanana, qwen-edit' 
      })
    }

    // Проверка API ключа
    const apiKey = process.env.KIE_API_KEY
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'KIE_API_KEY is not configured' 
      })
    }

    

    // Вызов Kie.ai API
    const result = await generateImageWithKieAI(apiKey, {
      model,
      prompt,
      aspect_ratio,
      image
    })

    if (result.error) {
      return res.status(500).json({ error: result.error })
    }

    if (result.images && result.images.length > 0) {
      const imageUrl = result.images[0]
      if (user_id && Number(user_id)) {
        recordSuccessAndDeduct(Number(user_id), imageUrl, prompt, model).catch(() => {})
      }
      return res.json({ 
        image: imageUrl,
        prompt: prompt,
        model: model
      })
    } else {
      return res.status(500).json({ 
        error: 'No images generated' 
      })
    }

  } catch (error) {
    console.error('Generation error:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    })
  }
}
