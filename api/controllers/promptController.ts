import { Request, Response } from 'express'
import { optimizeTextPrompt, describeImage, captionImage } from '../services/promptOptimizerService.js'

/**
 * POST /api/prompt/optimize
 * Body: { text: string }
 * Response: { prompt: string }
 */
export async function handleOptimizePrompt(req: Request, res: Response) {
    try {
        const { text } = req.body || {}

        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ error: 'Text is required' })
        }

        console.log('[PromptController] Optimize request:', { text: text.slice(0, 50) })

        const optimizedPrompt = await optimizeTextPrompt(text, 'realistic', 'image')

        console.log('[PromptController] Optimized prompt:', optimizedPrompt.slice(0, 100))

        return res.json({ prompt: optimizedPrompt })
    } catch (error) {
        console.error('[PromptController] Optimize error:', error)
        const message = error instanceof Error ? error.message : 'Optimization failed'
        return res.status(500).json({ error: message })
    }
}

/**
 * POST /api/prompt/describe
 * Body: { image: string (base64 or URL), version?: 'v1' | 'v2' }
 * Response: { prompt: string }
 * 
 * v1 = image-captioner (простое описание)
 * v2 = prompt-optimizer (с инструкциями для i2i)
 */
export async function handleDescribeImage(req: Request, res: Response) {
    try {
        const { image, version = 'v1' } = req.body || {}

        if (!image || typeof image !== 'string' || !image.trim()) {
            return res.status(400).json({ error: 'Image is required' })
        }

        console.log('[PromptController] Describe request:', {
            imageType: image.startsWith('data:') ? 'base64' : 'url',
            length: image.length,
            version
        })

        let generatedPrompt: string

        if (version === 'v2') {
            // V2: prompt-optimizer с инструкциями для сохранения лица
            generatedPrompt = await describeImage(image, 'realistic', 'image')
        } else {
            // V1: image-captioner — простое описание
            generatedPrompt = await captionImage(image, 'high')
        }

        console.log('[PromptController] Generated prompt:', generatedPrompt.slice(0, 100))

        return res.json({ prompt: generatedPrompt })
    } catch (error) {
        console.error('[PromptController] Describe error:', error)
        const message = error instanceof Error ? error.message : 'Description failed'
        return res.status(500).json({ error: message })
    }
}
