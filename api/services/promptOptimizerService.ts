/**
 * Prompt Optimizer Service
 * Использует модели wavespeed-ai/molmo2 для:
 * 1. V1: image-captioner — простое описание изображения
 * 2. V2: prompt-optimizer — продвинутая оптимизация с инструкциями
 * 3. Улучшения текстовых промптов
 */

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || ''
const MOLMO2_OPTIMIZER_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/molmo2/prompt-optimizer'
const MOLMO2_CAPTIONER_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/molmo2/image-captioner'

export type PromptStyle = 'default' | 'artistic' | 'photographic' | 'technical' | 'anime' | 'realistic'
export type PromptMode = 'image' | 'video'

interface PromptOptimizerResponse {
    id: string
    status: string
    outputs?: string[]
    model?: string
    created_at?: string
}

/**
 * Улучшить текстовый промпт
 */
export async function optimizeTextPrompt(
    text: string,
    style: PromptStyle = 'realistic',
    mode: PromptMode = 'image'
): Promise<string> {
    if (!text?.trim()) {
        throw new Error('Text is required for prompt optimization')
    }

    console.log('[PromptOptimizer] Optimizing text prompt:', { text: text.slice(0, 50), style, mode })

    const resp = await fetch(MOLMO2_OPTIMIZER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WAVESPEED_API_KEY}`
        },
        body: JSON.stringify({
            text,
            style,
            mode,
            enable_sync_mode: true  // Синхронный режим - результат сразу
        })
    })

    const json = await resp.json()
    console.log('[PromptOptimizer] Response:', json)

    if (!resp.ok) {
        throw new Error(json.error || json.data?.error || 'Prompt optimization failed')
    }

    // Ответ в sync mode: { data: { outputs: ['...'] } }
    const data = json.data || json
    const outputs = data.outputs || []

    if (outputs.length === 0) {
        throw new Error('No optimized prompt returned')
    }

    return outputs[0]
}

/**
 * Сгенерировать промпт по изображению
 */
export async function describeImage(
    imageUrl: string,
    style: PromptStyle = 'realistic',
    mode: PromptMode = 'image'
): Promise<string> {
    if (!imageUrl?.trim()) {
        throw new Error('Image URL is required')
    }

    console.log('[PromptOptimizer] Describing image:', { imageUrl: imageUrl.slice(0, 50), style, mode })

    // Инструкция для оптимизации промпта под i2i генерации с фото-референсом
    const i2iInstruction = `Create a HYPERREALISTIC, PHOTOREALISTIC prompt for image-to-image generation with photo reference.
IMPORTANT REQUIREMENTS:
1. The result MUST look like a real photograph, NOT a painting or illustration
2. Use the uploaded photo as a reference image
3. Preserve the face identity from the reference photo exactly as it is
4. Keep facial features, skin tone, and likeness unchanged
5. Describe the pose, body position, and action from the photo accurately
6. Apply realistic lighting, textures, and details as in real photography
7. Avoid any artistic, painted, illustrated, or cartoon-like styles
8. The final image should be indistinguishable from a real photo`

    const resp = await fetch(MOLMO2_OPTIMIZER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WAVESPEED_API_KEY}`
        },
        body: JSON.stringify({
            image: imageUrl,
            text: i2iInstruction,
            style,
            mode,
            enable_sync_mode: true
        })
    })

    const json = await resp.json()
    console.log('[PromptOptimizer] Response:', json)

    if (!resp.ok) {
        throw new Error(json.error || json.data?.error || 'Image description failed')
    }

    const data = json.data || json
    const outputs = data.outputs || []

    if (outputs.length === 0) {
        throw new Error('No prompt generated from image')
    }

    return outputs[0]
}

export type DetailLevel = 'low' | 'medium' | 'high'

/**
 * V1: Простое описание изображения (image-captioner)
 * Генерирует caption без дополнительных инструкций
 */
export async function captionImage(
    imageUrl: string,
    detailLevel: DetailLevel = 'high'
): Promise<string> {
    if (!imageUrl?.trim()) {
        throw new Error('Image URL is required')
    }

    console.log('[ImageCaptioner] Captioning image:', { imageUrl: imageUrl.slice(0, 50), detailLevel })

    const resp = await fetch(MOLMO2_CAPTIONER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WAVESPEED_API_KEY}`
        },
        body: JSON.stringify({
            image: imageUrl,
            detail_level: detailLevel,
            enable_sync_mode: true
        })
    })

    const json = await resp.json()
    console.log('[ImageCaptioner] Response:', json)

    if (!resp.ok) {
        throw new Error(json.error || json.data?.error || 'Image captioning failed')
    }

    const data = json.data || json
    const outputs = data.outputs || []

    if (outputs.length === 0) {
        throw new Error('No caption generated from image')
    }

    return outputs[0]
}
