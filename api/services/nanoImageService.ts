/**
 * NanoGPT Image Generation Service
 * Интеграция с NanoGPT API для генерации изображений через AI-агент
 */

const NANOGPT_API_KEY = process.env.NANOGPT_API_KEY || ''
const NANOGPT_IMAGE_URL = 'https://nano-gpt.com/v1/images/generations'
const NANOGPT_NSFW_URL = 'https://nano-gpt.com/api/nsfw/image'

export type NanoImageModel = 'z-image-turbo' | 'qwen-image' | 'qwen-image-plus'

export interface NanoImageParams {
    prompt: string
    model: NanoImageModel
    size?: string
    n?: number
    image?: string
}

export interface NanoImageResult {
    url?: string
    b64_json?: string
    cost?: number
    remainingBalance?: number
}

// Цены моделей (токены)
export const NANO_IMAGE_PRICES: Record<NanoImageModel, number> = {
    'z-image-turbo': 2,
    'qwen-image': 2,
    'qwen-image-plus': 3
}

// Доступные модели для AI-агента
export const NANO_IMAGE_MODELS: { id: NanoImageModel; name: string; price: number }[] = [
    { id: 'z-image-turbo', name: 'Z-Image Turbo', price: 2 },
    { id: 'qwen-image', name: 'Qwen Image', price: 2 },
    { id: 'qwen-image-plus', name: 'Qwen Image +', price: 3 }
]

/**
 * Генерация изображения через NanoGPT API
 */
export async function generateNanoGPTImage(params: NanoImageParams): Promise<NanoImageResult> {
    const { prompt, model, size = '1024x1024', n = 1, image } = params

    console.log('[NanoImageService] Generating image:', { model, prompt: prompt.slice(0, 50), size, hasImage: !!image })

    // Map internal 'plus' model to actual provider model
    const providerModel = model === 'qwen-image-plus' ? 'qwen-image' : model

    const body: any = {
        model: providerModel,
        prompt,
        n,
        response_format: 'url'
    }

    if (model === 'qwen-image' || model === 'qwen-image-plus') {
        // Qwen uses 'resolution' instead of 'size' for BOTH t2i and i2i
        // For i2i (with image), default to 'auto' to preserve aspect ratio
        // For t2i, use the provided size (e.g. '1024x1024')
        body.resolution = (image && size === '1024x1024') ? 'auto' : size
    } else {
        body.size = size
    }

    console.log('[NanoImageService] Request payload params:', {
        model,
        resolution: body.resolution,
        size: body.size,
        hasImage: !!image
    })

    if (image) {
        // Если передан URL, нужно скачать и конвертировать в base64 data url
        if (image.startsWith('http')) {
            try {
                console.log('[NanoImageService] Downloading image for i2i:', image)
                const imgRes = await fetch(image)
                if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`)

                const arrayBuffer = await imgRes.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                const base64 = buffer.toString('base64')
                const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'

                body.imageDataUrl = `data:${mimeType};base64,${base64}`
                console.log('[NanoImageService] Converted image to base64, size:', base64.length)
            } catch (e) {
                console.error('[NanoImageService] Failed to convert image to base64:', e)
                // Fallback: try sending URL directly as a last resort (though likely to fail based on docs)
                body.imageDataUrl = image
            }
        } else {
            // Already a data url or something else
            body.imageDataUrl = image
        }
    }

    const response = await fetch(NANOGPT_IMAGE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NANOGPT_API_KEY}`
        },
        body: JSON.stringify(body)
    })

    if (!response.ok) {
        if (response.status === 413) {
            throw new Error('Image is too large for AI processing. Please use a smaller image (under 4MB).')
        }

        const text = await response.text()
        let errorMsg = `Image generation failed with status ${response.status}`
        try {
            const json = JSON.parse(text)
            if (json.error) {
                // Handle both object with message and simple string cases
                errorMsg = typeof json.error === 'string' ? json.error : (json.error.message || JSON.stringify(json.error))
            }
        } catch {
            // If not JSON, use the text body or status text
            if (text.length < 200) errorMsg += `: ${text}`
        }

        console.error('[NanoImageService] Error:', { status: response.status, text: text.slice(0, 200) })
        throw new Error(errorMsg)
    }

    const data = await response.json()

    console.log('[NanoImageService] API Response:', JSON.stringify(data, null, 2))

    const imageData = data.data?.[0]
    if (!imageData) {
        throw new Error('No image data in response')
    }

    const resultUrl = imageData.url
    const resultB64 = imageData.b64_json
    let totalCost = data.cost || 0

    // --- NSFW CHECK ---
    // Skip NSFW check for qwen models and Z-Image (unrestricted)
    if (model !== 'qwen-image-plus' && model !== 'qwen-image' && model !== 'z-image-turbo') {
        try {
            const checkImage = resultUrl || (resultB64 ? `data:image/jpeg;base64,${resultB64}` : null)
            if (checkImage) {
                console.log('[NanoImageService] Checking NSFW...')
                const nsfwRes = await fetch(NANOGPT_NSFW_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': NANOGPT_API_KEY
                    },
                    body: JSON.stringify({
                        imageUrl: checkImage,
                        model: 'nsfw-classifier'
                    })
                })

                if (nsfwRes.ok) {
                    const nsfwData = await nsfwRes.json()
                    if (nsfwData.cost) totalCost += nsfwData.cost
                    console.log('[NanoImageService] NSFW Check Result:', nsfwData)

                    if (nsfwData.is_nsfw) {
                        throw new Error('Generated image contains explicit content (NSFW) and cannot be shown.')
                    }
                } else {
                    console.warn('[NanoImageService] NSFW check failed (status):', nsfwRes.status)
                }
            }
        } catch (e: any) {
            if (e.message?.includes('explicit content')) throw e
            console.error('[NanoImageService] NSFW check error:', e)
            // Optionally decide if we fail open or closed. For now fail open (allow image if check fails technically)
        }
    }

    console.log('[NanoImageService] Generation successful:', {
        hasUrl: !!resultUrl,
        cost: totalCost,
        remainingBalance: data.remainingBalance
    })

    return {
        url: resultUrl,
        b64_json: resultB64,
        cost: totalCost,
        remainingBalance: data.remainingBalance
    }
}

/**
 * Валидация модели
 */
export function isValidNanoImageModel(model: string): model is NanoImageModel {
    return ['z-image-turbo', 'qwen-image', 'qwen-image-plus'].includes(model)
}

/**
 * Получить цену модели
 */
export function getNanoImagePrice(model: NanoImageModel): number {
    return NANO_IMAGE_PRICES[model] || 1
}
