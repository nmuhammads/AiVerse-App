import { Request, Response } from 'express'
import { supaSelect, supaPost, supaPatch, supaDelete } from '../services/supabaseService.js'
import sharp from 'sharp'
import { uploadImageFromBase64 } from '../services/r2Service.js'
import { logBalanceChange } from '../services/balanceAuditService.js'

// Simple Kie.ai interfaces
interface KieJobsResponse {
    code: number
    msg: string
    data?: {
        taskId: string
        state?: string
        resultJson?: string
        failMsg?: string
    }
}

const WATERMARK_PRICES = {
    'nanobanana': 3,
    'gpt-image-1.5': 5,
    'remove-background': 1
}


/**
 * Get user's watermark settings
 * GET /api/watermarks
 */
export async function getWatermark(req: Request, res: Response) {
    try {
        const userId = Number(req.headers['x-user-id'] || (req as any).userId || 0)
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const { data } = await supaSelect('user_watermarks', `?user_id=eq.${userId}&is_active=eq.true&limit=1`)

        if (data && data.length > 0) {
            return res.json(data[0])
        }

        return res.json(null)
    } catch (e) {
        console.error('getWatermark error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

/**
 * Create or update watermark
 * POST /api/watermarks
 */
export async function saveWatermark(req: Request, res: Response) {
    try {
        const userId = Number(req.headers['x-user-id'] || (req as any).userId || 0)
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const { type, text_content, image_url, font_size, font_color, opacity, position } = req.body

        // Check if user already has a watermark
        const { data: existing } = await supaSelect('user_watermarks', `?user_id=eq.${userId}&limit=1`)

        if (existing && existing.length > 0) {
            // Update existing
            const updateData: Record<string, any> = {
                type: type || 'text',
                is_active: true
            }
            if (text_content !== undefined) updateData.text_content = text_content
            if (image_url !== undefined) updateData.image_url = image_url
            if (font_size !== undefined) updateData.font_size = font_size
            if (font_color !== undefined) updateData.font_color = font_color
            if (opacity !== undefined) updateData.opacity = opacity
            if (position !== undefined) updateData.position = position

            await supaPatch('user_watermarks', `?id=eq.${existing[0].id}`, updateData)
            return res.json({ ok: true, id: existing[0].id })
        } else {
            // Create new
            const insertData = {
                user_id: userId,
                type: type || 'text',
                text_content: text_content || null,
                image_url: image_url || null,
                font_size: font_size || 48,
                font_color: font_color || '#FFFFFF',
                opacity: opacity ?? 0.5,
                position: position || 'bottom-right',
                is_active: true
            }

            const { data: created } = await supaPost('user_watermarks', insertData)
            return res.json({ ok: true, id: created?.[0]?.id })
        }
    } catch (e) {
        console.error('saveWatermark error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

/**
 * Delete watermark
 * DELETE /api/watermarks
 */
export async function deleteWatermark(req: Request, res: Response) {
    try {
        const userId = Number(req.headers['x-user-id'] || (req as any).userId || 0)
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        await supaDelete('user_watermarks', `?user_id=eq.${userId}`)
        return res.json({ ok: true })
    } catch (e) {
        console.error('deleteWatermark error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}


/**
 * Remove white background from image
 */
async function removeWhiteBackground(buffer: Buffer): Promise<Buffer> {
    const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // If close to white, make transparent
        if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0; // Alpha 0
        }
    }

    return sharp(data, {
        raw: {
            width: info.width,
            height: info.height,
            channels: 4
        }
    })
        .png()
        .toBuffer();
}


/**
 * Generate AI watermark
 * POST /api/watermarks/generate
 */
export async function generateWatermark(req: Request, res: Response) {
    console.log('[Watermark] Generate request started')
    try {
        const userId = Number(req.headers['x-user-id'] || (req as any).userId || 0)
        console.log(`[Watermark] UserId: ${userId}`)

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const { model } = req.body
        console.log(`[Watermark] Model: ${model}`)

        if (model !== 'nanobanana' && model !== 'gpt-image-1.5') {
            return res.status(400).json({ error: 'Invalid model' })
        }

        const price = WATERMARK_PRICES[model]

        // 1. Check balance
        const { data: userData, ok: userOk } = await supaSelect('users', `?user_id=eq.${userId}&select=balance,username`)
        if (!userOk || !userData || userData.length === 0) {
            console.error('[Watermark] User lookup failed:', userData)
            return res.status(404).json({ error: 'User not found', details: userData })
        }
        const user = userData[0]
        if ((user.balance || 0) < price) {
            return res.status(403).json({ error: 'insufficient_balance' })
        }

        // 2. Prepare prompt
        const textToUse = req.body.text || user.username || `user_${userId}`
        // Improved prompt for creativity + readability + easier bg removal
        // NOTE: Our removeWhiteBackground function removes WHITE pixels. 
        // So we need a WHITE background and NON-WHITE text/logo.
        const prompt = `professional logo design for brand "${textToUse}", creative artistic typography, bold colorful letters, high quality vector graphics, isolated on solid white background, no shadow, flat design`
        console.log(`[Watermark] Prompt: ${prompt}`)

        // 3. Call Kie.ai API
        const apiKey = process.env.KIE_API_KEY
        if (!apiKey) {
            console.error('[Watermark] API Key missing')
            return res.status(500).json({ error: 'API key missing' })
        }

        let modelId = 'gpt-image/1.5-text-to-image'
        let input: any = {
            prompt,
            aspect_ratio: '1:1',
            quality: 'medium'
        }

        if (model === 'nanobanana') {
            modelId = 'google/nano-banana'
            input = {
                prompt,
                aspect_ratio: '1:1',
                output_format: 'png',
                image_size: '1:1'
            }
        }

        console.log(`[Watermark] Sending to Kie.ai (${modelId})...`)

        // Create Task
        const createResp = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelId, input })
        })

        if (!createResp.ok) {
            const errText = await createResp.text()
            console.error('[Watermark] Kie.ai create failed:', createResp.status, errText)
            return res.status(500).json({ error: 'Generation failed to start', details: errText })
        }

        const createJson = await createResp.json() as KieJobsResponse
        console.log('[Watermark] Task created:', createJson)

        if (createJson.code !== 200 || !createJson.data?.taskId) {
            return res.status(500).json({ error: 'Generation failed to start', details: createJson })
        }

        const taskId = createJson.data.taskId

        // Poll Task (Simple polling with timeout)
        let imageUrl = ''
        const startTime = Date.now()
        // Reduced timeout for better UX, but sufficient for these models
        const TIMEOUT_MS = 60000

        while (Date.now() - startTime < TIMEOUT_MS) {
            await new Promise(r => setTimeout(r, 2000))

            const pollResp = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            const pollJson = await pollResp.json() as KieJobsResponse

            if (pollJson.code === 200 && pollJson.data) {
                if (pollJson.data.state === 'success') {
                    try {
                        const r = JSON.parse(pollJson.data.resultJson || '{}')
                        const first = (r.resultUrls && r.resultUrls[0]) || (Array.isArray(r.result_urls) && r.result_urls[0])
                        if (first) {
                            imageUrl = first
                            console.log('[Watermark] Generation success:', imageUrl)
                            break
                        }
                    } catch (e) {
                        console.error('[Watermark] JSON parse error:', e)
                    }
                } else if (pollJson.data.state === 'fail') {
                    console.error('[Watermark] Task failed:', pollJson.data.failMsg)
                    return res.status(500).json({ error: 'Generation failed', msg: pollJson.data.failMsg })
                }
            }
        }

        if (!imageUrl) {
            console.error('[Watermark] Timeout')
            return res.status(504).json({ error: 'Timeout' })
        }

        // 4. Download and Remove Background
        console.log('[Watermark] Downloading image...')
        const imgResp = await fetch(imageUrl)
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer())

        let processedBuffer: any = imgBuffer
        try {
            console.log('[Watermark] Removing background...')
            processedBuffer = await removeWhiteBackground(imgBuffer)

            // Trim transparent edges to ensures the image is "tight"
            processedBuffer = await sharp(processedBuffer).trim().toBuffer()
        } catch (e) {
            console.error('[Watermark] Background removal/trim failed, using original:', e)
            // Fallback to original
        }

        // 5. Upload to R2 with fixed filename per user (overwrites previous watermark)
        console.log('[Watermark] Uploading to R2...')
        const base64 = `data:image/png;base64,${processedBuffer.toString('base64')}`

        // Use dedicated watermarks bucket if available
        const customBucket = process.env.R2_BUCKET_WATERMARKS
        const customUrl = process.env.R2_PUBLIC_URL_WATERMARKS

        // Use fixed filename per user to ensure only one AI watermark is stored
        // This overwrites the previous watermark when a new one is generated
        const fixedFileName = `user_${userId}.png`

        const publicUrl = await uploadImageFromBase64(
            base64,
            'watermarks',
            { bucket: customBucket, publicUrl: customUrl, customFileName: fixedFileName }
        )
        console.log('[Watermark] R2 URL:', publicUrl)

        // 6. Deduct balance
        const newBalance = (user.balance || 0) - price
        await supaPatch('users', `?user_id=eq.${userId}`, { balance: newBalance })
        logBalanceChange({ userId, oldBalance: user.balance || 0, newBalance, reason: 'watermark', metadata: { model, action: 'generate' } })

        // 7. Update/Create watermark record
        const { data: existing } = await supaSelect('user_watermarks', `?user_id=eq.${userId}&limit=1`)
        if (existing && existing.length > 0) {
            await supaPatch('user_watermarks', `?id=eq.${existing[0].id}`, {
                image_url: publicUrl,
                type: 'ai_generated'
            })
        } else {
            await supaPost('user_watermarks', {
                user_id: userId,
                type: 'ai_generated',
                image_url: publicUrl,
                text_content: null,
                is_active: true
            })
        }

        console.log('[Watermark] Success!')
        return res.json({ ok: true, imageUrl: publicUrl, balance: newBalance })

    } catch (e: any) {
        console.error('generateWatermark error:', e)
        return res.status(500).json({ error: 'Internal server error', details: e.message || String(e) })
    }
}


/**
 * Upload custom watermark image
 * POST /api/watermarks/upload
 */
export async function uploadWatermark(req: Request, res: Response) {
    console.log('[Watermark] Upload request started')
    try {
        const userId = Number(req.headers['x-user-id'] || (req as any).userId || 0)
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const { imageData } = req.body // Base64 image data

        if (!imageData) {
            return res.status(400).json({ error: 'No image data provided' })
        }

        console.log('[Watermark] Processing upload for user:', userId)

        // 1. Process image (trim, ensure PNG with transparency)
        let processedBuffer: Buffer
        try {
            // Parse base64 if it has data URL prefix
            const base64Match = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
            const base64Data = base64Match ? base64Match[2] : imageData
            const inputBuffer = Buffer.from(base64Data, 'base64')

            // Process with sharp: ensure alpha channel and remove extra whitespace
            processedBuffer = await sharp(inputBuffer)
                .ensureAlpha()
                .trim()
                .png()
                .toBuffer()
        } catch (e) {
            console.error('[Watermark] Image processing error:', e)
            return res.status(400).json({ error: 'Invalid image data' })
        }

        // 2. Upload to R2 with fixed filename (overwrites old watermark)
        const base64 = `data:image/png;base64,${processedBuffer.toString('base64')}`

        const customBucket = process.env.R2_BUCKET_WATERMARKS
        const customUrl = process.env.R2_PUBLIC_URL_WATERMARKS
        const fixedFileName = `user_${userId}.png`

        const publicUrl = await uploadImageFromBase64(
            base64,
            'watermarks',
            { bucket: customBucket, publicUrl: customUrl, customFileName: fixedFileName }
        )
        console.log('[Watermark] R2 URL:', publicUrl)

        // 3. Update/Create watermark record in DB
        const { data: existing } = await supaSelect('user_watermarks', `?user_id=eq.${userId}&limit=1`)
        if (existing && existing.length > 0) {
            await supaPatch('user_watermarks', `?id=eq.${existing[0].id}`, {
                image_url: publicUrl,
                type: 'custom',
                is_active: true
            })
        } else {
            await supaPost('user_watermarks', {
                user_id: userId,
                type: 'custom',
                image_url: publicUrl,
                text_content: null,
                is_active: true
            })
        }

        console.log('[Watermark] Upload Success!')
        return res.json({ ok: true, imageUrl: publicUrl })

    } catch (e: any) {
        console.error('uploadWatermark error:', e)
        return res.status(500).json({ error: 'Internal server error', details: e.message || String(e) })
    }
}


/**
 * Remove background from uploaded image
 * POST /api/watermarks/remove-background
 * Cost: 1 token
 */
export async function removeBackground(req: Request, res: Response) {
    console.log('[Watermark] Remove background request started')
    try {
        const userId = Number(req.headers['x-user-id'] || (req as any).userId || 0)
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const { imageData } = req.body // Base64 image data

        if (!imageData) {
            return res.status(400).json({ error: 'No image data provided' })
        }

        // 1. Check balance
        const { data: userData } = await supaSelect('users', `?user_id=eq.${userId}&select=balance`)
        const balance = userData?.[0]?.balance ?? 0
        const price = WATERMARK_PRICES['remove-background']

        if (balance < price) {
            return res.json({ ok: false, error: 'insufficient_balance' })
        }

        console.log('[Watermark] Removing background for user:', userId)

        // 2. First upload the image to R2 so we have a URL for Kie.ai
        let imageUrl: string
        try {
            const base64Match = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
            const base64Data = base64Match ? base64Match[2] : imageData
            const inputBuffer = Buffer.from(base64Data, 'base64')

            // Convert to PNG
            const pngBuffer = await sharp(inputBuffer).png().toBuffer()
            const base64Png = `data:image/png;base64,${pngBuffer.toString('base64')}`

            const customBucket = process.env.R2_BUCKET_WATERMARKS
            const customUrl = process.env.R2_PUBLIC_URL_WATERMARKS
            const tempFileName = `temp_${userId}_${Date.now()}.png`

            imageUrl = await uploadImageFromBase64(
                base64Png,
                'watermarks',
                { bucket: customBucket, publicUrl: customUrl, customFileName: tempFileName }
            )
            console.log('[Watermark] Temp image URL:', imageUrl)
        } catch (e) {
            console.error('[Watermark] Image processing error:', e)
            return res.status(400).json({ error: 'Invalid image data' })
        }

        // 3. Create Kie.ai task
        const kieApiKey = process.env.KIE_API_KEY
        if (!kieApiKey) {
            return res.status(500).json({ error: 'KIE_API_KEY not configured' })
        }

        const createTaskRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${kieApiKey}`
            },
            body: JSON.stringify({
                model: 'recraft/remove-background',
                input: { image: imageUrl }
            })
        })

        const createTaskData: KieJobsResponse = await createTaskRes.json()
        console.log('[Watermark] Kie.ai create task response:', createTaskData)

        if (createTaskData.code !== 200 || !createTaskData.data?.taskId) {
            return res.status(500).json({ error: 'Failed to create background removal task', details: createTaskData.msg })
        }

        const taskId = createTaskData.data.taskId

        // 4. Poll for result
        const timeout = Number(process.env.KIE_TASK_TIMEOUT_MS) || 60000
        const pollInterval = 2000
        const startTime = Date.now()

        let resultUrl: string | null = null

        while (Date.now() - startTime < timeout) {
            await new Promise(r => setTimeout(r, pollInterval))

            const statusRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
                headers: { 'Authorization': `Bearer ${kieApiKey}` }
            })
            const statusData: KieJobsResponse = await statusRes.json()
            console.log('[Watermark] Kie.ai status:', statusData.data?.state)

            if (statusData.data?.state === 'success' && statusData.data.resultJson) {
                const result = JSON.parse(statusData.data.resultJson)
                resultUrl = result.resultUrls?.[0]
                break
            } else if (statusData.data?.state === 'fail') {
                return res.status(500).json({ error: 'Background removal failed', details: statusData.data.failMsg })
            }
        }

        if (!resultUrl) {
            return res.status(500).json({ error: 'Background removal timed out' })
        }

        console.log('[Watermark] Background removed, result URL:', resultUrl)

        // 5. Download result and save to R2 with fixed filename
        const resultRes = await fetch(resultUrl)
        if (!resultRes.ok) {
            return res.status(500).json({ error: 'Failed to fetch result image' })
        }
        const resultBuffer = Buffer.from(await resultRes.arrayBuffer())

        // Process with sharp (trim transparent edges)
        const processedBuffer = await sharp(resultBuffer)
            .ensureAlpha()
            .trim()
            .png()
            .toBuffer()

        const base64Result = `data:image/png;base64,${processedBuffer.toString('base64')}`

        const customBucket = process.env.R2_BUCKET_WATERMARKS
        const customUrl = process.env.R2_PUBLIC_URL_WATERMARKS
        const fixedFileName = `user_${userId}.png`

        const publicUrl = await uploadImageFromBase64(
            base64Result,
            'watermarks',
            { bucket: customBucket, publicUrl: customUrl, customFileName: fixedFileName }
        )
        console.log('[Watermark] Final R2 URL:', publicUrl)

        // 6. Deduct balance
        const newBalance = balance - price
        await supaPatch('users', `?user_id=eq.${userId}`, { balance: newBalance })
        logBalanceChange({ userId, oldBalance: balance, newBalance, reason: 'watermark', metadata: { action: 'remove-background' } })

        // 7. Update/Create watermark record in DB
        const { data: existing } = await supaSelect('user_watermarks', `?user_id=eq.${userId}&limit=1`)
        if (existing && existing.length > 0) {
            await supaPatch('user_watermarks', `?id=eq.${existing[0].id}`, {
                image_url: publicUrl,
                type: 'custom',
                is_active: true
            })
        } else {
            await supaPost('user_watermarks', {
                user_id: userId,
                type: 'custom',
                image_url: publicUrl,
                text_content: null,
                is_active: true
            })
        }

        console.log('[Watermark] Remove background success!')
        return res.json({ ok: true, imageUrl: publicUrl, balance: newBalance })

    } catch (e: any) {
        console.error('removeBackground error:', e)
        return res.status(500).json({ error: 'Internal server error', details: e.message || String(e) })
    }
}
