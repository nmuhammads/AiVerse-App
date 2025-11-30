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
  'nanobanana-pro': 15,
  seedream4: 3,
  flux: 4,
  'qwen-edit': 3,
}

async function recordSuccessAndDeduct(userId: number, imageUrl: string, prompt: string, model: string, parentId?: number, metadata?: { ratio?: string; imagesCount?: number }, inputImages?: string[]) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !userId) return
  const cost = MODEL_PRICES[model] ?? 0
  try {
    // 1. Construct Metadata String
    const type = (metadata?.imagesCount && metadata.imagesCount > 0) ? 'text_photo' : 'text'
    const ratio = metadata?.ratio || '1:1'
    const photos = metadata?.imagesCount || 0
    const metaString = ` [type=${type}; ratio=${ratio}; photos=${photos}; avatars=0]`

    // Append to prompt
    const promptWithMeta = prompt + metaString

    // 2. Save generation
    const genBody: any = { user_id: userId, image_url: imageUrl, prompt: promptWithMeta, model }
    if (parentId) genBody.parent_id = parentId
    if (inputImages && inputImages.length > 0) genBody.input_images = inputImages
    const genRes = await supaPost('generations', genBody)
    const newGenId = (genRes.ok && Array.isArray(genRes.data) && genRes.data.length > 0) ? genRes.data[0].id : null

    // 3. Deduct balance
    const q = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(userId))}&select=balance`)
    const curr = Array.isArray(q.data) && q.data[0]?.balance != null ? Number(q.data[0].balance) : null
    if (typeof curr === 'number') {
      const next = curr - cost
      await supaPatch('users', `?user_id=eq.${encodeURIComponent(String(userId))}`, { balance: next })
    }

    // 4. Handle Remix Logic
    if (parentId && newGenId) {
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

            const rewardAmount = model === 'nanobanana-pro' ? 3 : 1
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
              remix_generation_id: newGenId,
              amount: rewardAmount
            })
          }
        }
      }
    }
  } catch (e) {
    console.error('recordSuccessAndDeduct error:', e)
  }
}

// Типы для запросов к Kie.ai
interface KieAIRequest {
  model: string
  prompt: string
  aspect_ratio?: string
  images?: string[] // Changed from image?: string to images?: string[]
  negative_prompt?: string
}

interface KieAIResponse {
  images?: string[]
  inputImages?: string[]
  error?: string
}

// Функция для генерации изображения через Kie.ai
async function generateImageWithKieAI(
  apiKey: string,
  requestData: KieAIRequest
): Promise<KieAIResponse> {
  try {
    const { model, prompt, aspect_ratio, images, negative_prompt } = requestData
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

    if (cfg.kind === 'flux-kontext') {
      // Flux supports single image
      const taskId = await createFluxTask(apiKey, prompt, aspect_ratio, imageUrls[0])
      const url = await pollFluxTask(apiKey, taskId)
      return { images: [url], inputImages: imageUrls }
    }

    if (model === 'seedream4') {
      const image_size = mapSeedreamImageSize(aspect_ratio)
      const input: Record<string, unknown> = { prompt }
      if (image_size) input.image_size = image_size
      input.image_resolution = '2K'
      if (imageUrls.length > 0) {
        // Seedream supports multiple images
        const taskId = await createJobsTask(apiKey, 'bytedance/seedream-v4-edit', { ...input, image_urls: imageUrls })
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url], inputImages: imageUrls }
      } else {
        const taskId = await createJobsTask(apiKey, 'bytedance/seedream-v4-text-to-image', input)
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url], inputImages: [] }
      }
    }

    if (model === 'nanobanana' || model === 'nanobanana-pro') {
      const isPro = model === 'nanobanana-pro'
      const modelId = isPro ? 'nano-banana-pro' : (imageUrls.length > 0 ? 'google/nano-banana-edit' : 'google/nano-banana')

      const resolution = isPro ? '4K' : undefined

      let image_size: string | undefined
      if (aspect_ratio !== 'Auto') {
        image_size = mapNanoBananaImageSize(aspect_ratio)
      }

      const input: Record<string, unknown> = {
        prompt,
        output_format: 'png'
      }

      if (imageUrls.length > 0) {
        input.image_urls = imageUrls
      }

      if (image_size) input.image_size = image_size
      if (aspect_ratio && aspect_ratio !== 'Auto') input.aspect_ratio = aspect_ratio

      if (isPro) {
        if (aspect_ratio && aspect_ratio !== 'Auto') {
          input.aspect_ratio = aspect_ratio
          delete input.image_size
        }
        if (resolution) input.resolution = resolution

        const taskId = await createJobsTask(apiKey, 'nano-banana-pro', input)
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url], inputImages: imageUrls }
      } else {
        if (image_size) input.image_size = image_size
        const taskId = await createJobsTask(apiKey, modelId, input)
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url], inputImages: imageUrls }
      }
    }

    if (model === 'qwen-edit') {
      if (imageUrls.length > 0) {
        // Qwen Edit supports single image
        const input: Record<string, unknown> = {
          prompt,
          image_url: imageUrls[0],
          strength: 0.8,
          output_format: 'png',
          acceleration: 'none',
          enable_safety_checker: false
        }
        if (negative_prompt) input.negative_prompt = negative_prompt

        const taskId = await createJobsTask(apiKey, 'qwen/image-to-image', input)
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url], inputImages: imageUrls }
      } else {
        const image_size = mapQwenImageSize(aspect_ratio)
        const input: Record<string, unknown> = {
          prompt,
          output_format: 'png',
          enable_safety_checker: false
        }
        if (negative_prompt) input.negative_prompt = negative_prompt
        if (image_size) input.image_size = image_size

        const taskId = await createJobsTask(apiKey, 'qwen/text-to-image', input)
        const url = await pollJobsTask(apiKey, taskId)
        return { images: [url], inputImages: [] }
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
    const { prompt, model, aspect_ratio, images, negative_prompt, user_id } = req.body

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

    // SIMULATION MODE
    if (prompt.trim().toLowerCase() === 'test') {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate delay
      return res.json({
        image: 'https://placehold.co/1024x1024/png?text=Test+Generation',
        prompt: prompt,
        model: model
      })
    }

    // Upload input images to R2 (for DB) and Kie (for Generation) if present
    let kieImages: string[] = []
    let r2Images: string[] = []

    if (images && images.length > 0) {
      const { uploadImageFromUrl } = await import('../services/r2Service.js')
      const { uploadImageToKie } = await import('../services/kieService.js')

      // Process images in parallel
      const results = await Promise.all(images.map(async (img: string) => {
        // Skip if not http
        if (!img.startsWith('http')) return { r2: img, kie: img }

        // Run uploads in parallel
        const [r2Url, kieUrl] = await Promise.all([
          uploadImageFromUrl(img).catch(e => {
            console.error('R2 upload failed:', e)
            return img // Fallback to original
          }),
          uploadImageToKie(img).catch(e => {
            console.error('Kie upload failed:', e)
            return img // Fallback to original
          })
        ])

        return { r2: r2Url, kie: kieUrl }
      }))

      r2Images = results.map(r => r.r2)
      kieImages = results.map(r => r.kie)

      // Use Kie URLs for generation request
      req.body.images = kieImages
    }

    // Проверка API ключа
    const apiKey = process.env.KIE_API_KEY
    if (!apiKey) {
      return res.status(500).json({
        error: 'KIE_API_KEY is not configured'
      })
    }

    // Проверка баланса пользователя
    if (user_id) {
      const cost = MODEL_PRICES[model] ?? 0
      const q = await supaSelect('users', `?user_id=eq.${encodeURIComponent(String(user_id))}&select=balance`)
      const balance = Array.isArray(q.data) && q.data[0]?.balance != null ? Number(q.data[0].balance) : 0

      if (balance < cost) {
        return res.status(403).json({
          error: `Insufficient balance. Required: ${cost}, Available: ${balance}`
        })
      }
    }

    // Вызов Kie.ai API
    const result = await generateImageWithKieAI(apiKey, {
      model,
      prompt,
      aspect_ratio,
      images,
      negative_prompt
    })

    if (result.error) {
      return res.status(500).json({ error: result.error })
    }

    if (result.images && result.images.length > 0) {
      const imageUrl = result.images[0]
      if (user_id && Number(user_id)) {
        // Extract parent_id from request body (it was missed in destructuring above)
        const parent_id = req.body.parent_id

        // Prepare metadata
        const metadata = {
          ratio: aspect_ratio,
          imagesCount: images ? images.length : 0
        }

        // Pass r2Images (permanent URLs) to DB
        recordSuccessAndDeduct(Number(user_id), imageUrl, prompt, model, parent_id, metadata, r2Images).catch(() => { })
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
