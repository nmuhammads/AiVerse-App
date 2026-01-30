/**
 * PiAPI Service - Backup API provider for NanoBanana Pro
 * Documentation: /docs/Pia/NanoBanana.md
 */

const PIAPI_BASE_URL = 'https://api.piapi.ai';

export interface PiapiInput {
    prompt: string;
    image_urls?: string[];  // PiAPI uses image_urls (not image_input like Kie)
    output_format?: 'png' | 'jpeg';
    aspect_ratio?: string;  // Don't send if Auto
    resolution: '2K' | '4K';
    safety_level: 'low';    // Always 'low'
}

export interface PiapiTaskResponse {
    code: number;
    data: {
        task_id: string;
        status: string;
    };
    message?: string;
}

export interface PiapiTaskStatus {
    code: number;
    data: {
        task_id: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        output?: {
            image_url?: string;
            image_urls?: string[];
        };
        error?: {
            code: string;
            message: string;
        };
    };
    message?: string;
}

/**
 * Get public base URL for webhooks
 */
function getPublicBaseUrl(): string {
    const url = process.env.WEBAPP_URL || process.env.RAILWAY_PUBLIC_DOMAIN || ''
    return url.startsWith('http') ? url : (url ? `https://${url}` : '')
}

/**
 * Create a NanoBanana Pro task via PiAPI
 */
export async function createPiapiTask(
    input: PiapiInput,
    meta: { generationId: number; userId: number }
): Promise<{ taskId: string }> {
    const apiKey = process.env.PIAPI_API_KEY;
    if (!apiKey) {
        throw new Error('PIAPI_API_KEY is not configured');
    }

    const baseUrl = getPublicBaseUrl();
    const callBackUrl = baseUrl
        ? `${baseUrl}/api/webhook/piapi?generationId=${meta.generationId}&userId=${meta.userId}`
        : undefined;

    const body = {
        model: 'gemini',
        task_type: 'nano-banana-pro',
        input: {
            prompt: input.prompt,
            output_format: input.output_format || 'png',
            resolution: input.resolution,
            safety_level: 'low',  // Always low
            ...(input.image_urls && input.image_urls.length > 0 && { image_urls: input.image_urls }),
            ...(input.aspect_ratio && input.aspect_ratio !== 'Auto' && { aspect_ratio: input.aspect_ratio })
        },
        config: callBackUrl ? {
            webhook_config: { endpoint: callBackUrl }
        } : undefined
    };

    console.log(`[PiAPI] Creating task for generation ${meta.generationId}:`, JSON.stringify(body));

    const resp = await fetch(`${PIAPI_BASE_URL}/api/v1/task`, {
        method: 'POST',
        headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const json = await resp.json() as PiapiTaskResponse;

    if (!resp.ok || json.code !== 200) {
        console.error(`[PiAPI] Task create failed:`, json);
        throw new Error(json.message || 'PiAPI task create failed');
    }

    console.log(`[PiAPI] Task created, ID: ${json.data.task_id}`);
    return { taskId: json.data.task_id };
}

/**
 * Check task status via PiAPI
 */
export async function checkPiapiTask(taskId: string): Promise<PiapiTaskStatus> {
    const apiKey = process.env.PIAPI_API_KEY;
    if (!apiKey) {
        throw new Error('PIAPI_API_KEY is not configured');
    }

    const resp = await fetch(`${PIAPI_BASE_URL}/api/v1/task/${taskId}`, {
        headers: { 'X-API-Key': apiKey }
    });

    return await resp.json() as PiapiTaskStatus;
}

/**
 * Poll PiAPI task until completion or timeout
 */
export async function pollPiapiTask(taskId: string, timeoutMs = 600000): Promise<string> {
    const start = Date.now();
    console.log(`[PiAPI] Polling task ${taskId} (timeout: ${timeoutMs}ms)`);

    while (Date.now() - start < timeoutMs) {
        const result = await checkPiapiTask(taskId);

        if (result.code === 200 && result.data) {
            const status = result.data.status;

            if (status === 'completed') {
                const imageUrl = result.data.output?.image_url || result.data.output?.image_urls?.[0];
                if (imageUrl) {
                    console.log(`[PiAPI] Task ${taskId} completed`);
                    return imageUrl;
                }
            }

            if (status === 'failed') {
                const errorMessage = result.data.error?.message || 'PiAPI task failed';
                console.error(`[PiAPI] Task ${taskId} failed:`, result.data.error);

                // Special handling for Gemini content policy error
                if (errorMessage.toLowerCase().includes('gemini could not generate') ||
                    errorMessage.toLowerCase().includes('could not generate an image')) {
                    throw new Error('Gemini не смог сгенерировать изображение с этим промптом. Попробуйте другой промпт или используйте Seedream.');
                }

                throw new Error(errorMessage);
            }
        }

        // Wait 30 seconds before next poll
        await new Promise(r => setTimeout(r, 30000));
    }

    console.log(`[PiAPI] Task ${taskId} timed out`);
    return 'TIMEOUT';
}
