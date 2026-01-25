/**
 * NanoGPT Image Generation Service
 * Интеграция с NanoGPT API для генерации изображений через AI-агент
 */

const NANOGPT_API_KEY = process.env.NANOGPT_API_KEY || ''
const NANOGPT_IMAGE_URL = 'https://nano-gpt.com/v1/images/generations'

export type NanoImageModel = 'z-image-turbo' | 'qwen-image'

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
    'qwen-image': 2
}

// Доступные модели для AI-агента
export const NANO_IMAGE_MODELS: { id: NanoImageModel; name: string; price: number }[] = [
    { id: 'z-image-turbo', name: 'Z-Image Turbo', price: 2 },
    { id: 'qwen-image', name: 'Qwen Image', price: 2 }
]

/**
 * Генерация изображения через NanoGPT API
 */
export async function generateNanoGPTImage(params: NanoImageParams): Promise<NanoImageResult> {
    const { prompt, model, size = '1024x1024', n = 1, image } = params

    console.log('[NanoImageService] Generating image:', { model, prompt: prompt.slice(0, 50), size, hasImage: !!image })

    const body: any = {
        model,
        prompt,
        n,
        size,
        response_format: 'url'
    }

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

    const data = await response.json()

    if (!response.ok) {
        console.error('[NanoImageService] Error:', data)
        throw new Error(data.error?.message || 'Image generation failed')
    }

    console.log('[NanoImageService] Generation successful:', {
        hasUrl: !!data.data?.[0]?.url,
        cost: data.cost,
        remainingBalance: data.remainingBalance
    })

    const imageData = data.data?.[0]
    if (!imageData) {
        throw new Error('No image data in response')
    }

    return {
        url: imageData.url,
        b64_json: imageData.b64_json,
        cost: data.cost,
        remainingBalance: data.remainingBalance
    }
}

/**
 * Валидация модели
 */
export function isValidNanoImageModel(model: string): model is NanoImageModel {
    return ['z-image-turbo', 'qwen-image'].includes(model)
}

/**
 * Получить цену модели
 */
export function getNanoImagePrice(model: NanoImageModel): number {
    return NANO_IMAGE_PRICES[model] || 1
}
