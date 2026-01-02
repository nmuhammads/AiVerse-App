const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || ''
const WAVESPEED_API_URL = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/qwen-image/edit-plus-lora'

// Обязательные LoRA для функции изменения ракурса
const ANGLES_LORAS = [
    {
        path: "https://huggingface.co/nmuhammads/angel/resolve/main/Qwen%20Image%20Edit%20Camera%20Control.safetensors",
        scale: 1.25  // Как в оригинальном HuggingFace Space
    }
]

export async function createAnglesPrediction(
    imageUrl: string,
    rotation: number,
    tilt: number,
    zoom: number
): Promise<string> {
    const prompt = buildAnglePrompt(rotation, tilt, zoom)

    console.log('[WaveSpeed] Creating angles prediction:', { rotation, tilt, zoom, prompt })

    const resp = await fetch(WAVESPEED_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WAVESPEED_API_KEY}`
        },
        body: JSON.stringify({
            enable_base64_output: false,
            enable_sync_mode: false,
            images: [imageUrl],
            loras: ANGLES_LORAS,
            output_format: 'jpeg',
            prompt,
            seed: -1,
            // Настройки для 4-step inference (если API поддерживает)
            num_inference_steps: 4,
            guidance_scale: 1.0
        })
    })

    const json = await resp.json()
    console.log('[WaveSpeed] Task creation response:', json)

    // WaveSpeed API возвращает { code: 200, message: 'success', data: { id: '...' } }
    const requestId = json.data?.id || json.id
    if (!resp.ok || !requestId) {
        throw new Error(json.error || json.data?.error || 'WaveSpeed task create failed')
    }

    // Polling для получения результата
    return pollWavespeedTask(requestId)
}

function buildAnglePrompt(rotation: number, tilt: number, zoom: number): string {
    const promptParts: string[] = []

    // Rotation: horizontal camera rotation left/right
    // rotation: -90 to 90, positive = right, negative = left (opposite to Python)
    if (rotation !== 0) {
        // В Python: positive = left, negative = right
        // У нас: positive = right, negative = left (инвертировано для UI)
        const direction = rotation > 0 ? 'right' : 'left'
        const absRotation = Math.abs(rotation)

        if (direction === 'left') {
            promptParts.push(`将镜头向左旋转${absRotation}度 Rotate the camera ${absRotation} degrees to the left.`)
        } else {
            promptParts.push(`将镜头向右旋转${absRotation}度 Rotate the camera ${absRotation} degrees to the right.`)
        }
    }

    // Move forward / close-up (zoom: 0 to 10)
    if (zoom > 5) {
        promptParts.push('将镜头转为特写镜头 Turn the camera to a close-up.')
    } else if (zoom >= 1) {
        promptParts.push('将镜头向前移动 Move the camera forward.')
    }

    // Vertical tilt: -45 to 45
    // В UI: +45 = куб показывает вид сверху вниз = bird's-eye view
    //       -45 = куб показывает вид снизу вверх = worm's-eye view
    if (tilt >= 30) {
        promptParts.push('将相机转向鸟瞰视角 Turn the camera to a bird\'s-eye view.')
    } else if (tilt <= -30) {
        promptParts.push('将相机切换到仰视视角 Turn the camera to a worm\'s-eye view.')
    }

    const finalPrompt = promptParts.join(' ').trim()
    return finalPrompt || 'no camera movement'
}

async function pollWavespeedTask(requestId: string, timeoutMs = 300000): Promise<string> {
    const start = Date.now()
    const resultUrl = `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`

    console.log(`[WaveSpeed] Polling task ${requestId}`)

    while (Date.now() - start < timeoutMs) {
        const resp = await fetch(resultUrl, {
            headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` }
        })

        const json = await resp.json()

        // WaveSpeed API возвращает { code: 200, data: { status: '...', outputs: [...] } }
        const data = json.data || json
        const status = data.status

        console.log(`[WaveSpeed] Poll status: ${status}`)

        if (status === 'completed' && (data.outputs?.length > 0 || data.output)) {
            console.log(`[WaveSpeed] Task ${requestId} completed`)
            // Output может быть в outputs или output
            const outputs = data.outputs || data.output
            const output = Array.isArray(outputs) ? outputs[0] : outputs
            return output
        }

        if (status === 'failed') {
            console.error(`[WaveSpeed] Task ${requestId} failed:`, data.error)
            throw new Error(data.error || 'WaveSpeed task failed')
        }

        await new Promise(r => setTimeout(r, 2000))
    }

    console.log(`[WaveSpeed] Task ${requestId} timed out`)
    return 'TIMEOUT'
}
