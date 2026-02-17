/**
 * Auth Middleware for AiVerse API
 * Supports multiple authentication methods:
 * - Telegram Mini App (initData validation)
 * - JWT Bearer token (Supabase or simple Telegram token)
 */

import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { verifyTelegramSessionToken } from '../utils/telegramSessionToken.js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

// Extended Request type with authenticated user
export interface AuthenticatedRequest extends Request {
    user?: {
        id: number
        telegram_id?: number
        username?: string
        first_name?: string
        last_name?: string
        language_code?: string
        is_premium?: boolean
        auth_method: 'telegram' | 'jwt'
    }
}

function toNumericId(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : null
}

function enforceAuthenticatedIdentity(req: AuthenticatedRequest, userId: number): { ok: boolean; message?: string } {
    // Header checks (legacy flows may still send x-user-id)
    const headerUserId = toNumericId(req.headers['x-user-id'])
    if (headerUserId && headerUserId !== userId) {
        return { ok: false, message: 'User identity mismatch in header' }
    }

    // Body checks
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : null
    if (body) {
        const bodyUserId = toNumericId(body.user_id)
        const bodyUserIdCamel = toNumericId(body.userId)
        const followerId = toNumericId(body.followerId)

        if (bodyUserId && bodyUserId !== userId) {
            return { ok: false, message: 'User identity mismatch in body.user_id' }
        }
        if (bodyUserIdCamel && bodyUserIdCamel !== userId) {
            return { ok: false, message: 'User identity mismatch in body.userId' }
        }
        if (followerId && followerId !== userId) {
            return { ok: false, message: 'User identity mismatch in body.followerId' }
        }

        // Backward-compatible defaulting for controllers that still expect user_id/userId.
        if (!bodyUserId) body.user_id = userId
        if (!bodyUserIdCamel) body.userId = userId
        if (Object.prototype.hasOwnProperty.call(body, 'followerId') && !followerId) body.followerId = userId
    }

    // Query checks for protected GET endpoints
    const query = req.query as Record<string, unknown>
    const queryUserId = toNumericId(query.user_id)
    const queryFollowerId = toNumericId(query.follower_id)
    if (queryUserId && queryUserId !== userId) {
        return { ok: false, message: 'User identity mismatch in query.user_id' }
    }
    if (queryFollowerId && queryFollowerId !== userId) {
        return { ok: false, message: 'User identity mismatch in query.follower_id' }
    }
    if (!queryUserId) query.user_id = String(userId)

    return { ok: true }
}

/**
 * Validate Telegram Web App initData
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(initData: string): AuthenticatedRequest['user'] | null {
    if (!initData || !BOT_TOKEN) {
        return null
    }

    try {
        // Parse the initData string into key-value pairs
        const params = new URLSearchParams(initData)
        const hash = params.get('hash')

        if (!hash) {
            console.warn('[Auth] Missing hash in initData')
            return null
        }

        // Remove hash from params for verification
        params.delete('hash')

        // Sort params alphabetically and create data-check-string
        const dataCheckArr: string[] = []
        const sortedKeys = Array.from(params.keys()).sort()
        for (const key of sortedKeys) {
            dataCheckArr.push(`${key}=${params.get(key)}`)
        }
        const dataCheckString = dataCheckArr.join('\n')

        // Create secret key: HMAC-SHA256 of bot token with "WebAppData" as key
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()

        // Calculate hash
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

        // Compare hashes
        if (calculatedHash !== hash) {
            console.warn('[Auth] Invalid hash in initData')
            return null
        }

        // Check auth_date (prevent replay attacks - allow up to 24 hours)
        const authDate = params.get('auth_date')
        if (authDate) {
            const authTimestamp = parseInt(authDate, 10) * 1000
            const now = Date.now()
            const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

            if (now - authTimestamp > maxAge) {
                console.warn('[Auth] initData expired (auth_date too old)')
                return null
            }
        }

        // Extract user data
        const userJson = params.get('user')
        if (!userJson) {
            console.warn('[Auth] Missing user in initData')
            return null
        }

        const user = JSON.parse(userJson)

        return {
            id: user.id,
            telegram_id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            language_code: user.language_code,
            is_premium: user.is_premium,
            auth_method: 'telegram'
        }
    } catch (error) {
        console.error('[Auth] Error validating initData:', error)
        return null
    }
}

/**
 * Validate signed Telegram session token (Bearer token)
 */
function validateTelegramSessionToken(token: string): AuthenticatedRequest['user'] | null {
    const payload = verifyTelegramSessionToken(token)
    if (!payload) {
        return null
    }

    return {
        id: payload.user_id,
        telegram_id: payload.telegram_id,
        username: payload.username,
        first_name: payload.first_name,
        auth_method: 'jwt',
    }
}

/**
 * Validate Supabase JWT token
 */
async function validateSupabaseToken(token: string): Promise<AuthenticatedRequest['user'] | null> {
    try {
        // Dynamic import to avoid circular dependency
        const { verifySupabaseToken } = await import('../services/authService.js')
        const result = await verifySupabaseToken(token)

        if (!result.ok || !result.data) {
            return null
        }

        const authUser = result.data

        // Get user_id from public.users via auth_id
        const { supaSelect } = await import('../services/supabaseService.js')
        const publicUser = await supaSelect('users', `?auth_id=eq.${authUser.id}&select=user_id,username,first_name,last_name`)
        const userData = (publicUser.ok && Array.isArray(publicUser.data) && publicUser.data[0]) || {}
        const userId = Number(userData.user_id || 0)
        if (!userId) {
            console.warn('[Auth] Supabase user has no linked public.users row')
            return null
        }

        return {
            id: userId,
            username: userData.username,
            first_name: userData.first_name || authUser.user_metadata?.first_name,
            last_name: userData.last_name || authUser.user_metadata?.last_name,
            auth_method: 'jwt'
        }
    } catch (error) {
        console.error('[Auth] Supabase token validation error:', error)
        return null
    }
}

/**
 * Middleware that requires authentication
 * Checks for Telegram initData or JWT Bearer token
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    // Check for Telegram initData header
    const telegramInitData = req.header('X-Telegram-Init-Data')

    if (telegramInitData) {
        const user = validateTelegramInitData(telegramInitData)
        if (user) {
            req.user = user
            const identityCheck = enforceAuthenticatedIdentity(req, user.id)
            if (!identityCheck.ok) {
                res.status(403).json({ error: 'Forbidden', message: identityCheck.message })
                return
            }
            return next()
        }
    }

    // Check for JWT Bearer token
    const authHeader = req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)

        // Try signed Telegram token first (no network call)
        const simpleUser = validateTelegramSessionToken(token)
        if (simpleUser) {
            req.user = simpleUser
            const identityCheck = enforceAuthenticatedIdentity(req, simpleUser.id)
            if (!identityCheck.ok) {
                res.status(403).json({ error: 'Forbidden', message: identityCheck.message })
                return
            }
            return next()
        }

        // Try Supabase JWT token
        const supabaseUser = await validateSupabaseToken(token)
        if (supabaseUser) {
            req.user = supabaseUser
            const identityCheck = enforceAuthenticatedIdentity(req, supabaseUser.id)
            if (!identityCheck.ok) {
                res.status(403).json({ error: 'Forbidden', message: identityCheck.message })
                return
            }
            return next()
        }
    }

    // No valid authentication found
    res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication required'
    })
}

/**
 * Optional auth middleware - sets req.user if authenticated, but doesn't block
 * Useful for public endpoints that behave differently for authenticated users
 */
export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const telegramInitData = req.header('X-Telegram-Init-Data')

    if (telegramInitData) {
        const user = validateTelegramInitData(telegramInitData)
        if (user) {
            req.user = user
            return next()
        }
    }

    // Check for JWT Bearer token
    const authHeader = req.header('Authorization')
    if (!req.user && authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7)

        const simpleUser = validateTelegramSessionToken(token)
        if (simpleUser) {
            req.user = simpleUser
        } else {
            const supabaseUser = await validateSupabaseToken(token)
            if (supabaseUser) {
                req.user = supabaseUser
            }
        }
    }

    next()
}
