/**
 * Image Proxy Route
 * Proxies images from Cloudflare R2 for users with blocked access
 */
import { Router, type Request, type Response } from 'express'

const router = Router()

// Allowed domains for proxying (security)
const ALLOWED_DOMAINS = [
    'r2.cloudflarestorage.com',
    'pub-',  // R2 public buckets start with pub-
    'r2.dev',
    'aiquickdraw.com',  // Temporary image URLs
    'tempfile.aiquickdraw.com',
]

/**
 * Check if URL is from allowed domain
 */
function isAllowedUrl(url: string): boolean {
    try {
        const urlObj = new URL(url)
        // Check R2_PUBLIC_URL from env
        const r2PublicUrl = process.env.R2_PUBLIC_URL
        const r2ThumbsUrl = process.env.R2_PUBLIC_URL_THUMBNAILS
        const r2EditedUrl = process.env.R2_PUBLIC_URL_EDITED

        if (r2PublicUrl && url.startsWith(r2PublicUrl)) return true
        if (r2ThumbsUrl && url.startsWith(r2ThumbsUrl)) return true
        if (r2EditedUrl && url.startsWith(r2EditedUrl)) return true

        // Check general allowed domains
        return ALLOWED_DOMAINS.some(domain => urlObj.hostname.includes(domain))
    } catch {
        return false
    }
}

/**
 * Proxy image from Cloudflare R2
 * GET /api/proxy/image?url=https://...
 */
router.get('/image', async (req: Request, res: Response): Promise<void> => {
    try {
        const { url } = req.query

        if (!url || typeof url !== 'string') {
            res.status(400).json({ error: 'URL parameter is required' })
            return
        }

        // Security check
        if (!isAllowedUrl(url)) {
            res.status(403).json({ error: 'Domain not allowed' })
            return
        }

        // Fetch image from Cloudflare
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'AiVerse-Proxy/1.0',
            },
        })

        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to fetch image' })
            return
        }

        // Get content info
        const contentType = response.headers.get('content-type') || 'image/jpeg'
        const contentLength = response.headers.get('content-length')

        // Set response headers
        res.set('Content-Type', contentType)
        if (contentLength) res.set('Content-Length', contentLength)

        // Cache for 1 year (images are immutable)
        res.set('Cache-Control', 'public, max-age=31536000, immutable')
        res.set('Access-Control-Allow-Origin', '*')

        // Stream the response
        const buffer = await response.arrayBuffer()
        res.send(Buffer.from(buffer))

    } catch (error) {
        console.error('Proxy error:', error)
        res.status(500).json({ error: 'Proxy failed' })
    }
})

/**
 * Health check for proxy
 * GET /api/proxy/health
 */
router.get('/health', (req: Request, res: Response): void => {
    res.status(200).json({ ok: true })
})

export default router
