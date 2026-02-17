import crypto from 'crypto'

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

export interface TelegramSessionPayload {
    user_id: number
    telegram_id: number
    username?: string
    first_name?: string
    type: 'telegram'
    iat: number
    exp: number
}

function getSessionSecret(): string {
    return process.env.AUTH_SESSION_SECRET || process.env.TELEGRAM_BOT_TOKEN || ''
}

function signPayload(payloadB64: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payloadB64).digest('hex')
}

function decodePayload(payloadB64: string): TelegramSessionPayload | null {
    try {
        const json = Buffer.from(payloadB64, 'base64url').toString('utf8')
        const data = JSON.parse(json) as TelegramSessionPayload
        return data
    } catch {
        return null
    }
}

export function createTelegramSessionToken(data: {
    user_id: number
    telegram_id: number
    username?: string
    first_name?: string
    ttlSeconds?: number
}): { token: string; expiresAt: number } {
    const secret = getSessionSecret()
    if (!secret) {
        throw new Error('AUTH_SESSION_SECRET (or TELEGRAM_BOT_TOKEN) is required')
    }

    const now = Math.floor(Date.now() / 1000)
    const ttl = Number(data.ttlSeconds || SESSION_TTL_SECONDS)
    const exp = now + ttl

    const payload: TelegramSessionPayload = {
        user_id: data.user_id,
        telegram_id: data.telegram_id,
        username: data.username,
        first_name: data.first_name,
        type: 'telegram',
        iat: now,
        exp,
    }

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = signPayload(payloadB64, secret)
    return {
        token: `${payloadB64}.${signature}`,
        expiresAt: exp,
    }
}

export function verifyTelegramSessionToken(token: string): TelegramSessionPayload | null {
    const secret = getSessionSecret()
    if (!secret || !token) return null

    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [payloadB64, signature] = parts
    const expected = signPayload(payloadB64, secret)

    try {
        const sigBuf = Buffer.from(signature, 'hex')
        const expectedBuf = Buffer.from(expected, 'hex')
        if (sigBuf.length !== expectedBuf.length) return null
        if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null
    } catch {
        return null
    }

    const payload = decodePayload(payloadB64)
    if (!payload) return null
    if (payload.type !== 'telegram') return null
    if (!payload.user_id || !payload.telegram_id) return null
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null

    return payload
}
