/**
 * AI Chat Controller
 * Обрабатывает запросы к AI чату
 */

import { Request, Response } from 'express'
import { streamChatCompletion, getChatCompletion, type ChatMessage, type ChatModel } from '../services/chatService'
import { generateNanoGPTImage, isValidNanoImageModel, getNanoImagePrice, NANO_IMAGE_MODELS, type NanoImageModel } from '../services/nanoImageService'
import { uploadImageFromBase64 } from '../services/r2Service'

const AVAILABLE_MODELS: ChatModel[] = [
    'deepseek/deepseek-v3.2',
    'zai-org/glm-4.7',
    'minimax/minimax-m2.1',
    'Qwen/Qwen3-235B-A22B',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b'
]

/**
 * POST /api/chat
 * Обработка сообщений чата с AI
 */
export async function handleChat(req: Request, res: Response) {
    try {
        const { messages, model = 'Qwen/Qwen3-235B-A22B', stream = true } = req.body

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Messages array is required' })
        }

        // Валидация модели
        if (!AVAILABLE_MODELS.includes(model)) {
            return res.status(400).json({
                error: 'Invalid model',
                available: AVAILABLE_MODELS
            })
        }

        // Валидация формата сообщений
        const validMessages: ChatMessage[] = messages.map((m: any) => ({
            role: m.role === 'user' || m.role === 'assistant' ? m.role : 'user',
            content: m.content // Allow string or array
        }))

        console.log('[ChatController] Request:', {
            model,
            stream,
            messageCount: validMessages.length,
            // Log full content of the last message to see if image_url is there
            lastMessageContent: JSON.stringify(validMessages[validMessages.length - 1]?.content)
        })

        if (stream) {
            // Streaming response
            res.setHeader('Content-Type', 'text/event-stream')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')
            res.flushHeaders()

            try {
                for await (const chunk of streamChatCompletion(validMessages, model)) {
                    res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
                }
                res.write('data: [DONE]\n\n')
            } catch (streamError) {
                console.error('[ChatController] Stream error:', streamError)
                res.write(`data: ${JSON.stringify({ error: streamError instanceof Error ? streamError.message : 'Stream error' })}\n\n`)
            }

            res.end()
        } else {
            // Non-streaming response
            const content = await getChatCompletion(validMessages, model)
            res.json({ content })
        }

    } catch (error) {
        console.error('[ChatController] Error:', error)
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        })
    }
}

/**
 * GET /api/chat/models
 * Получить список доступных моделей чата
 */
export function getAvailableModels(_req: Request, res: Response) {
    res.json({
        models: [
            { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek v3.2' },
            { id: 'zai-org/glm-4.7', name: 'GLM-4.7' },
            { id: 'minimax/minimax-m2.1', name: 'MiniMax M2.1' },
            { id: 'Qwen/Qwen3-235B-A22B', name: 'Qwen3 235B', default: true },
            { id: 'openai/gpt-oss-20b', name: 'GPT 4 mini' },
            { id: 'openai/gpt-oss-120b', name: 'GPT 4' }
        ]
    })
}

/**
 * GET /api/chat/image-models
 * Получить список доступных моделей для генерации изображений
 */
export function getImageModels(_req: Request, res: Response) {
    res.json({
        models: NANO_IMAGE_MODELS
    })
}

// --- Supabase helpers ---
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''

function supaHeaders() {
    return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } as Record<string, string>
}

async function supaSelect(table: string, query: string) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${query}`
    const r = await fetch(url, { headers: { ...supaHeaders(), 'Content-Type': 'application/json' } })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, data }
}

async function supaPost(table: string, body: unknown) {
    const url = `${SUPABASE_URL}/rest/v1/${table}`
    const r = await fetch(url, {
        method: 'POST',
        headers: { ...supaHeaders(), 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(body)
    })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, data }
}

async function supaPatch(table: string, filter: string, body: unknown) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`
    const r = await fetch(url, {
        method: 'PATCH',
        headers: { ...supaHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, data }
}

/**
 * POST /api/chat/generate-image
 * Генерация изображения через AI-агент
 */
export async function handleGenerateImage(req: Request, res: Response) {
    try {
        const { prompt, model, size = '1024x1024', user_id, image } = req.body

        // Валидация
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Prompt is required' })
        }

        if (!model || !isValidNanoImageModel(model)) {
            return res.status(400).json({
                error: 'Invalid model',
                available: NANO_IMAGE_MODELS.map(m => m.id)
            })
        }

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' })
        }

        const price = getNanoImagePrice(model as NanoImageModel)

        console.log('[ChatController] Generating image:', {
            model,
            prompt: prompt.slice(0, 50),
            size,
            price,
            user_id,
            hasImage: !!image
        })

        // Проверка баланса пользователя
        const userQuery = await supaSelect('users', `?user_id=eq.${user_id}&select=balance`)
        if (!userQuery.ok || !Array.isArray(userQuery.data) || userQuery.data.length === 0) {
            return res.status(400).json({ error: 'User not found' })
        }

        const currentBalance = userQuery.data[0].balance || 0
        if (currentBalance < price) {
            return res.status(400).json({
                error: 'Insufficient balance',
                required: price,
                current: currentBalance
            })
        }

        // Создаём запись generation со статусом pending
        const genBody = {
            user_id: Number(user_id),
            prompt: prompt,
            model: model, // Просто модель без префикса
            status: 'pending',
            cost: price,
            media_type: 'image',
            image_url: image || undefined // Store source image if i2i
        }

        const genRes = await supaPost('generations', genBody)
        let generationId: number | null = null
        if (genRes.ok && Array.isArray(genRes.data) && genRes.data.length > 0) {
            generationId = genRes.data[0].id
            console.log('[ChatController] Generation record created, ID:', generationId)
        }

        // Списание токенов
        const newBalance = currentBalance - price
        await supaPatch('users', `?user_id=eq.${user_id}`, { balance: newBalance })
        console.log(`[ChatController] Balance debited: ${currentBalance} -> ${newBalance}`)

        // Генерация изображения
        const result = await generateNanoGPTImage({
            prompt,
            model: model as NanoImageModel,
            size,
            image
        })

        // Обновляем запись generation со статусом completed
        if (generationId && result.url) {
            await supaPatch('generations', `?id=eq.${generationId}`, {
                status: 'completed',
                image_url: result.url,
                completed_at: new Date().toISOString()
            })
            console.log('[ChatController] Generation completed, ID:', generationId)
        }

        res.json({
            success: true,
            imageUrl: result.url,
            imageBase64: result.b64_json,
            cost: result.cost || price,
            remainingBalance: newBalance,
            generationId
        })

    } catch (error) {
        console.error('[ChatController] Image generation error:', error)
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Image generation failed'
        })
    }
}


/**
 * POST /api/chat/upload
 * Загрузка изображения в R2 для чата
 */
export async function handleUploadImage(req: Request, res: Response) {
    try {
        const { image } = req.body

        if (!image || typeof image !== 'string') {
            return res.status(400).json({ error: 'Image data is required' })
        }

        // Простая валидация base64
        if (!image.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL.' })
        }

        // Загрузка в R2 (папка chat-uploads)
        const publicUrl = await uploadImageFromBase64(image, 'chat-uploads')

        // If upload fails, r2Service returns the original base64. 
        // We should NOT return this to the client as a "url", because it will break the chat generation flow.
        if (publicUrl.startsWith('data:')) {
            throw new Error('Failed to upload image to storage server')
        }

        res.json({
            success: true,
            url: publicUrl
        })

    } catch (error) {
        console.error('[ChatController] Upload error:', error)
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Upload failed'
        })
    }
}
