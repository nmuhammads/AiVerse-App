const DEFAULT_MY_API_BASE_URL = 'https://gemini-auto-manager-production.up.railway.app'
const DEFAULT_TIMEOUT_MS = (() => {
  const value = Number(process.env.MY_API_TIMEOUT_MS || 0)
  return Number.isFinite(value) && value > 0 ? value : 45000
})()

export type MyApiModel = 'nanobanana-pro' | 'nanobanana-2'
export type MyApiResolution = '1K' | '2K'

export interface AvailabilityResponse {
  has_available_accounts: boolean
  available_accounts_count: number
  total_remaining_generations: number
  free_accounts_count: number
  busy_accounts_count: number
  queue_length: number
  queue_capacity: number
  queue_slots_left: number
  has_free_account_now: boolean
  estimated_wait_seconds: number
}

export interface GenerateWithMyApiPayload {
  prompt: string
  model: MyApiModel
  resolution: MyApiResolution
  aspectRatio?: string
  imageInput?: string[]
}

export interface GenerateWithMyApiResult {
  imageUrl: string
  generatedModel?: string
  actualResolution?: string
}

function getMyApiBaseUrl(): string {
  const raw = (process.env.MY_API_BASE_URL || DEFAULT_MY_API_BASE_URL).trim()
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

function getMyApiKey(): string {
  return (process.env.MY_API_KEY || '').trim()
}

export function isMyApiConfigured(): boolean {
  return Boolean(getMyApiKey())
}

function mapModel(model: MyApiModel): string {
  return model === 'nanobanana-pro'
    ? 'gemini-3-pro-image-preview'
    : 'gemini-3.1-flash-image-preview'
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new Error(`MyAPI request timeout after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function checkMyApiAvailability(): Promise<AvailabilityResponse> {
  const apiKey = getMyApiKey()
  if (!apiKey) {
    throw new Error('MY_API_KEY is not configured')
  }

  const response = await fetchWithTimeout(
    `${getMyApiBaseUrl()}/api/v1/accounts/availability`,
    {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey
      }
    }
  )

  const json = await response.json().catch(() => null) as AvailabilityResponse | null
  if (!response.ok || !json) {
    throw new Error(`MyAPI availability failed with status ${response.status}`)
  }

  return json
}

export async function generateWithMyApi(payload: GenerateWithMyApiPayload): Promise<GenerateWithMyApiResult> {
  const apiKey = getMyApiKey()
  if (!apiKey) {
    throw new Error('MY_API_KEY is not configured')
  }

  const imageInput = Array.isArray(payload.imageInput) ? payload.imageInput.filter(Boolean) : []
  if (imageInput.length > 5) {
    throw new Error('MyAPI supports up to 5 image_input URLs')
  }

  const body: Record<string, unknown> = {
    prompt: payload.prompt,
    model: mapModel(payload.model),
    resolution: payload.resolution
  }

  if (payload.aspectRatio && payload.aspectRatio !== 'Auto') {
    body.aspect_ratio = payload.aspectRatio
  }
  if (imageInput.length > 0) {
    body.image_input = imageInput
  }

  const response = await fetchWithTimeout(
    `${getMyApiBaseUrl()}/api/v1/generate`,
    {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  )

  const json = await response.json().catch(() => null) as {
    image_url?: string | null
    generated_model?: string | null
    actual_resolution?: string | null
    message?: string
  } | null

  if (!response.ok || !json) {
    throw new Error(`MyAPI generate failed with status ${response.status}`)
  }

  const imageUrl = typeof json.image_url === 'string' ? json.image_url : ''
  if (!imageUrl.startsWith('http')) {
    throw new Error(json.message || 'MyAPI did not return a valid image_url')
  }

  return {
    imageUrl,
    generatedModel: json.generated_model || undefined,
    actualResolution: json.actual_resolution || undefined
  }
}
