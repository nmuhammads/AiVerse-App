/**
 * Replicate API Service
 * For z-image-turbo-inpaint model
 */

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || ''
const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions'
const DEFAULT_TIMEOUT_MS = 300000 // 5 minutes

interface ReplicatePrediction {
    id: string
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
    output?: string | string[]
    error?: string
}

/**
 * Create an inpaint prediction using z-image-turbo-inpaint model
 */
export async function createInpaintPrediction(
    imageUrl: string,
    maskUrl: string,
    prompt: string
): Promise<string> {
    if (!REPLICATE_API_KEY) {
        throw new Error('REPLICATE_API_KEY is not configured')
    }

    console.log('[Replicate] Creating inpaint prediction...')
    console.log('[Replicate] Image:', imageUrl.slice(0, 80))
    console.log('[Replicate] Mask:', maskUrl.slice(0, 80))
    console.log('[Replicate] Prompt:', prompt.slice(0, 100))

    const response = await fetch(REPLICATE_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${REPLICATE_API_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait'  // Wait for result if possible
        },
        body: JSON.stringify({
            version: '047a6a8f0d229a60ade5171c9ebc7c593e927b3ab88d42f80a8f847732e09a06',
            input: {
                prompt,
                image: imageUrl,
                mask_image: maskUrl
            }
        })
    })

    if (!response.ok) {
        const error = await response.text()
        console.error('[Replicate] Create prediction failed:', error)
        throw new Error(`Replicate API error: ${response.status} - ${error}`)
    }

    const prediction = await response.json() as ReplicatePrediction
    console.log('[Replicate] Prediction created:', prediction.id, 'status:', prediction.status)

    // If already completed (with Prefer: wait header)
    if (prediction.status === 'succeeded' && prediction.output) {
        const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
        console.log('[Replicate] Prediction completed immediately:', output)
        return output
    }

    if (prediction.status === 'failed') {
        throw new Error(`Replicate prediction failed: ${prediction.error}`)
    }

    // Poll for completion
    return pollPrediction(prediction.id)
}

/**
 * Poll prediction until completion or timeout
 */
async function pollPrediction(predictionId: string): Promise<string> {
    const startTime = Date.now()
    const pollInterval = 2000 // 2 seconds

    console.log(`[Replicate] Polling prediction ${predictionId}...`)

    while (Date.now() - startTime < DEFAULT_TIMEOUT_MS) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const response = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
            headers: {
                'Authorization': `Bearer ${REPLICATE_API_KEY}`
            }
        })

        if (!response.ok) {
            console.error('[Replicate] Poll failed:', response.status)
            continue
        }

        const prediction = await response.json() as ReplicatePrediction
        console.log('[Replicate] Poll status:', prediction.status)

        if (prediction.status === 'succeeded' && prediction.output) {
            const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
            console.log('[Replicate] Prediction completed:', output)
            return output
        }

        if (prediction.status === 'failed') {
            throw new Error(`Replicate prediction failed: ${prediction.error}`)
        }

        if (prediction.status === 'canceled') {
            throw new Error('Replicate prediction was canceled')
        }
    }

    throw new Error('Replicate prediction timeout')
}
