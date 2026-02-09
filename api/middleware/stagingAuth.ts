/**
 * Staging Basic Auth Middleware
 * Protects staging environment with HTTP Basic Authentication
 * Only active when STAGING_PASSWORD env variable is set
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

    // Skip health check endpoint
    if (req.path === '/api/health') {
        next()
        return
    }

    // Skip webhook endpoints (they have their own auth)
    if (req.path.includes('/webhook')) {
        next()
        return
    }

    // Skip API routes - they have their own auth mechanism
    if (req.path.startsWith('/api/')) {
        next()
        return
    }

    // Skip static assets (JS, CSS, images, fonts)
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.webp', '.webm', '.mp4']
    if (staticExtensions.some(ext => req.path.endsWith(ext))) {
        next()
        return
    }

    // Skip Telegram Mini App requests (they authenticate via initData header)
    const telegramInitData = req.headers['x-telegram-init-data']
    if (telegramInitData) {
        next()
        return
    }

    // Skip initial page load from Telegram WebApp (check URL params in query or hash)
    const hasTelegramParams = req.query.tgWebAppData ||
        req.query.tgWebAppStartParam ||
        req.query.tgWebAppVersion ||
        req.query.start ||
        req.url.includes('tgWebApp') ||
        req.url.includes('startapp')
    if (hasTelegramParams) {
        next()
        return
    }

    // Skip requests from Telegram WebView (check User-Agent - various Telegram client signatures)
    const userAgent = (req.headers['user-agent'] || '').toLowerCase()
    const isTelegramUA = userAgent.includes('telegram') ||
        userAgent.includes('tgweb') ||
        userAgent.includes('webview') ||
        (userAgent.includes('mobile') && userAgent.includes('safari') && !userAgent.includes('chrome'))  // iOS in-app browser
    if (isTelegramUA) {
        next()
        return
    }

    // Skip if Referer is from the same staging domain (subsequent page loads)
    const referer = req.headers['referer'] || ''
    if (referer.includes('railway.app') || referer.includes('localhost')) {
        next()
        return
    }

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
