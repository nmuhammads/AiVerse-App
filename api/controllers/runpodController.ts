import { Request, Response } from 'express'
import { uploadToEditedBucket, uploadImageFromBase64 } from '../services/r2Service.js'
import { supaSelect, supaPatch, supaPost } from '../services/supabaseService.js'

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || ''
const RUNPOD_BASE_URL = 'https://api.runpod.ai/v2'
const EDITOR_PRICE = 2
const DEFAULT_TIMEOUT_MS = Number(process.env.RUNPOD_TIMEOUT_MS) || 300000

// Создание задачи Runpod
async function createRunpodTask(modelId: string, input: Record<string, unknown>): Promise<string> {
    const url = `${RUNPOD_BASE_URL}/${modelId}/run`

    console.log(`[Runpod] Creating task for ${modelId}:`, JSON.stringify(input).slice(0, 1000))

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RUNPOD_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input })
    })

    const json = await resp.json()

    if (!resp.ok || !json.id) {
        console.error(`[Runpod] Task create failed:`, json)
        throw new Error(json.error || 'Runpod task create failed')
    }

    console.log(`[Runpod] Task created, ID:`, json.id)
    return json.id
}

// Проверка статуса задачи
async function checkRunpodTask(modelId: string, jobId: string) {
    const url = `${RUNPOD_BASE_URL}/${modelId}/status/${jobId}`

    const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
    })

    const json = await resp.json()

    // Логирование для отладки
    if (json.status !== 'IN_QUEUE' && json.status !== 'IN_PROGRESS') {
        console.log('[Runpod] Status response:', JSON.stringify(json).slice(0, 500))
    }

    if (json.status === 'COMPLETED' && (json.output?.image_url || json.output?.result)) {
        const imageUrl = json.output.image_url || json.output.result
        return { status: 'success' as const, imageUrl }
    }
    if (json.status === 'FAILED') {
        return { status: 'failed' as const, error: json.error || 'Task failed' }
    }

    return { status: 'pending' as const }
}

// Polling до завершения
async function pollRunpodTask(modelId: string, jobId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
    const start = Date.now()
    console.log(`[Runpod] Polling task ${jobId} (timeout: ${timeoutMs}ms)`)

    while (Date.now() - start < timeoutMs) {
        const result = await checkRunpodTask(modelId, jobId)

        if (result.status === 'success') {
            console.log(`[Runpod] Task ${jobId} completed`)
            return result.imageUrl
        }
        if (result.status === 'failed') {
            console.error(`[Runpod] Task ${jobId} failed:`, result.error)
            throw new Error(result.error)
        }

        await new Promise(r => setTimeout(r, 2000))
    }

    console.log(`[Runpod] Task ${jobId} timed out`)
    return 'TIMEOUT'
}

// Главный обработчик редактирования
export async function handleImageEdit(req: Request, res: Response) {
    const { prompt, images, user_id, source_generation_id, mode } = req.body

    console.log('[Editor] Request received:', {
        userId: user_id,
        hasImages: images?.length > 0,
        imagesCount: images?.length,
        sourceGenerationId: source_generation_id,
        mode: mode || 'edit'
    })

    // Валидация
    if (!images?.length) {
        return res.status(400).json({ error: 'Image required' })
    }
    if (!prompt?.trim()) {
        return res.status(400).json({ error: 'Prompt required' })
    }

    // Проверка API ключа
    if (!RUNPOD_API_KEY) {
        console.error('[Editor] RUNPOD_API_KEY not configured')
        return res.status(500).json({ error: 'Editor not configured' })
    }

    let generationId: number | null = null

    try {
        // Проверка и списание баланса
        if (user_id) {
            const userRes = await supaSelect('users', `?user_id=eq.${user_id}&select=balance`)
            console.log('[Editor] User balance response:', userRes)
            const balance = userRes?.data?.[0]?.balance || 0
            console.log(`[Editor] User ${user_id} balance: ${balance}, required: ${EDITOR_PRICE}`)

            if (balance < EDITOR_PRICE) {
                console.log('[Editor] Insufficient balance, returning 403')
                return res.status(403).json({ error: 'Insufficient balance', required: EDITOR_PRICE, current: balance })
            }

            // Списание токенов
            await supaPatch('users', `?user_id=eq.${user_id}`, { balance: balance - EDITOR_PRICE })
            console.log(`[Editor] Deducted ${EDITOR_PRICE} tokens from user ${user_id}`)
        }

        // Создание задачи в Runpod
        // Модифицируем промпт для inpaint режима
        let finalPrompt = prompt
        let finalImages = [...images]

        // Upload any base64 images to R2 (API requires URLs)
        for (let i = 0; i < finalImages.length; i++) {
            if (finalImages[i]?.startsWith('data:')) {
                const folder = i === 0 ? 'editor-source' : 'masks'
                console.log(`[Editor] Uploading image ${i} to R2 (${folder})...`)
                const imageUrl = await uploadImageFromBase64(finalImages[i], folder)
                finalImages[i] = imageUrl
                console.log(`[Editor] Image ${i} uploaded:`, imageUrl)
            }
        }

        if (mode === 'inpaint' && images.length >= 2) {
            finalPrompt = `Edit only the masked area (white region in second image). ${prompt}`
            console.log('[Editor] Inpaint mode, modified prompt:', finalPrompt.slice(0, 100))
        }

        const input = {
            prompt: finalPrompt,
            images: finalImages,
            aspect_ratio: 'match_input_image',
            disable_safety_checker: false
        }

        const jobId = await createRunpodTask('p-image-edit', input)

        // Polling результата
        const runpodImageUrl = await pollRunpodTask('p-image-edit', jobId)

        if (runpodImageUrl === 'TIMEOUT') {
            // Возврат токенов при таймауте
            if (user_id) {
                const userRes = await supaSelect('users', `?user_id=eq.${user_id}&select=balance`)
                const balance = userRes?.data?.[0]?.balance || 0
                await supaPatch('users', `?user_id=eq.${user_id}`, { balance: balance + EDITOR_PRICE })
                console.log(`[Editor] Refunded ${EDITOR_PRICE} tokens to user ${user_id}`)
            }
            return res.json({ status: 'pending', message: 'Processing, please check later' })
        }

        // Загрузка в R2 бакет edited
        const r2Url = await uploadToEditedBucket(runpodImageUrl)
        console.log(`[Editor] Uploaded to R2:`, r2Url)

        // Сохранение результата в БД
        if (user_id) {
            if (source_generation_id) {
                // Сценарий 2: Привязка к исходной генерации
                const genRes = await supaSelect('generations', `?id=eq.${source_generation_id}&select=edit_variants`)
                const existingVariants = genRes?.data?.[0]?.edit_variants || []
                const newVariants = [...existingVariants, r2Url]

                await supaPatch('generations', `?id=eq.${source_generation_id}`, {
                    edit_variants: newVariants
                })
                console.log(`[Editor] Added variant to generation ${source_generation_id}`)
            } else {
                // Сценарий 1: Новая генерация (загрузка с телефона)
                const genBody = {
                    user_id,
                    image_url: r2Url,
                    model: 'p-image-edit',
                    prompt,
                    is_edited: true,
                    status: 'completed'
                }
                const insertRes = await supaPost('generations', genBody)
                generationId = insertRes?.data?.[0]?.id
                console.log(`[Editor] Created new generation ${generationId}`)
            }
        }

        return res.json({
            image: r2Url,
            generation_id: generationId,
            source_generation_id: source_generation_id || null
        })

    } catch (error) {
        console.error('[Editor] Error:', error)

        // Возврат токенов при ошибке
        if (user_id) {
            try {
                const userRes = await supaSelect('users', `?user_id=eq.${user_id}&select=balance`)
                const balance = userRes?.data?.[0]?.balance || 0
                await supaPatch('users', `?user_id=eq.${user_id}`, { balance: balance + EDITOR_PRICE })
                console.log(`[Editor] Refunded ${EDITOR_PRICE} tokens due to error`)
            } catch (refundError) {
                console.error('[Editor] Refund failed:', refundError)
            }
        }

        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Editor failed'
        })
    }
}
