/**
 * Staging Basic Auth Middleware
 * Protects staging environment with HTTP Basic Authentication
 * Only active when STAGING_PASSWORD env variable is set
 * 
 * Strategy: Only require auth for desktop browsers accessing directly.
 * Mobile devices and Telegram are always allowed.
 */

import { Request, Response, NextFunction } from 'express'

const STAGING_USERNAME = process.env.STAGING_USERNAME || 'admin'
const STAGING_PASSWORD = process.env.STAGING_PASSWORD

export function stagingAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip if no staging password configured (production)
    if (!STAGING_PASSWORD) {
        next()
        return
    }

    // Skip ALL API routes - they have their own auth (initData/JWT)
    if (req.path.startsWith('/api/')) {
        next()
        return
    }

    // Skip static assets
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.webp', '.webm', '.mp4', '.json', '.xml', '.txt']
    if (staticExtensions.some(ext => req.path.endsWith(ext))) {
        next()
        return
    }

    // Skip if has Telegram header
    if (req.headers['x-telegram-init-data']) {
        next()
        return
    }

    // Skip if URL contains any Telegram-related params
    const fullUrl = req.originalUrl || req.url
    if (fullUrl.includes('tgWebApp') || fullUrl.includes('startapp') || fullUrl.includes('start=')) {
        next()
        return
    }

    // Detect if this is a mobile device - always allow mobile (likely Telegram)
    const userAgent = (req.headers['user-agent'] || '').toLowerCase()
    const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent)
    if (isMobile) {
        next()
        return
    }

    // Skip if Referer indicates already authenticated session
    const referer = req.headers['referer'] || ''
    if (referer && (referer.includes('railway.app') || referer.includes('localhost'))) {
        next()
        return
    }

    // At this point, it's likely a desktop browser - require Basic Auth
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="Staging Environment"')
        res.status(401).send('Authentication required for staging environment')
        return
    }

    const base64Credentials = authHeader.split(' ')[1]
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8')
    const [username, password] = credentials.split(':')

    if (username === STAGING_USERNAME && password === STAGING_PASSWORD) {
        next()
        return
    }

    res.set('WWW-Authenticate', 'Basic realm="Staging Environment"')
    res.status(401).send('Invalid credentials')
}
