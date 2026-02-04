/**
 * Authentication Routes
 * Handles email/password auth, Telegram login, and session management
 */
import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import {
  signUpWithEmail,
  signInWithEmail,
  refreshSession,
  verifySupabaseToken,
  getSupabaseAdmin
} from '../services/authService.js'
import { supaSelect, supaPost, supaPatch } from '../services/supabaseService.js'

const router = Router()

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

/**
 * Validate Telegram Login Widget data
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
function validateTelegramLoginData(data: Record<string, string>): boolean {
  if (!BOT_TOKEN || !data.hash) return false

  const { hash, ...rest } = data

  // Create data-check-string
  const checkString = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('\n')

  // Create secret key from bot token
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest()

  // Calculate hash
  const calculatedHash = crypto.createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex')

  return calculatedHash === hash
}

/**
 * Find user by telegram_id or user_id (backward compatible)
 */
async function findUserByTelegramId(telegramId: number) {
  // First try telegram_id
  let result = await supaSelect('users', `?telegram_id=eq.${telegramId}&select=*`)
  if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
    return result.data[0]
  }

  // Fallback: check user_id if it's <= 10 digits (legacy TG users)
  if (telegramId <= 9999999999) {
    result = await supaSelect('users', `?user_id=eq.${telegramId}&select=*`)
    if (result.ok && Array.isArray(result.data) && result.data.length > 0) {
      const user = result.data[0]
      // Migrate: set telegram_id for future lookups
      await supaPatch('users', `?user_id=eq.${telegramId}`, { telegram_id: telegramId })
      return { ...user, telegram_id: telegramId }
    }
  }

  return null
}

/**
 * Sign up with email and password
 * POST /api/auth/signup
 */
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, first_name, last_name } = req.body

    if (!email || !password) {
      res.status(400).json({ ok: false, error: 'Email and password are required' })
      return
    }

    if (password.length < 8) {
      res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' })
      return
    }

    // Check if email already exists in public.users
    const existing = await supaSelect('users', `?email=eq.${encodeURIComponent(email)}&select=user_id`)
    if (existing.ok && Array.isArray(existing.data) && existing.data.length > 0) {
      res.status(409).json({ ok: false, error: 'Email already registered' })
      return
    }

    // Create user in auth.users
    const authResult = await signUpWithEmail(email, password, { first_name, last_name })
    if (!authResult.ok || !authResult.data) {
      res.status(400).json({ ok: false, error: authResult.error || 'Failed to create user' })
      return
    }

    const authUser = authResult.data

    // Generate user_id from sequence for web users
    const seqResult = await supaSelect('', `rpc/nextval?name=eq.web_user_id_seq`)
    // Fallback: use timestamp-based ID if sequence fails
    const userId = Date.now()

    // Create user in public.users
    const userResult = await supaPost('users', {
      user_id: userId,
      auth_id: authUser.id,
      email: email,
      first_name: first_name || null,
      last_name: last_name || null,
      balance: 6, // Default balance
      created_at: new Date().toISOString()
    })

    if (!userResult.ok) {
      console.error('[Auth] Failed to create public.users record:', userResult.data)
      // Don't fail - auth user is created, public user creation can be retried
    }

    res.status(201).json({
      ok: true,
      message: 'Please check your email to confirm your account',
      user_id: userId
    })
  } catch (error) {
    console.error('[Auth] Signup error:', error)
    res.status(500).json({ ok: false, error: 'Internal server error' })
  }
})

/**
 * Sign in with email and password
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ ok: false, error: 'Email and password are required' })
      return
    }

    const result = await signInWithEmail(email, password)

    if (!result.ok || !result.data) {
      res.status(401).json({ ok: false, error: result.error || 'Invalid credentials' })
      return
    }

    const { user, session } = result.data

    // Get public.users data
    const publicUser = await supaSelect('users', `?auth_id=eq.${user.id}&select=user_id,username,first_name,balance,avatar_url,telegram_id`)
    const userData = (publicUser.ok && Array.isArray(publicUser.data) && publicUser.data[0]) || {}

    res.json({
      ok: true,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: {
        id: userData.user_id,
        auth_id: user.id,
        email: user.email,
        first_name: userData.first_name || user.user_metadata?.first_name,
        username: userData.username,
        balance: userData.balance,
        avatar_url: userData.avatar_url,
        telegram_linked: !!userData.telegram_id
      }
    })
  } catch (error) {
    console.error('[Auth] Login error:', error)
    res.status(500).json({ ok: false, error: 'Internal server error' })
  }
})

/**
 * Telegram Login Widget authentication
 * POST /api/auth/telegram-login
 */
router.post('/telegram-login', async (req: Request, res: Response): Promise<void> => {
  try {
    const telegramData = req.body

    if (!telegramData || !telegramData.id || !telegramData.hash) {
      res.status(400).json({ ok: false, error: 'Invalid Telegram data' })
      return
    }

    // Validate Telegram data
    if (!validateTelegramLoginData(telegramData)) {
      res.status(401).json({ ok: false, error: 'Invalid Telegram authentication' })
      return
    }

    // Check auth_date is not too old (24 hours)
    const authDate = parseInt(telegramData.auth_date, 10) * 1000
    if (Date.now() - authDate > 24 * 60 * 60 * 1000) {
      res.status(401).json({ ok: false, error: 'Telegram authentication expired' })
      return
    }

    const telegramId = parseInt(telegramData.id, 10)

    // Find existing user
    let publicUser = await findUserByTelegramId(telegramId)

    if (!publicUser) {
      // Create new user
      const userId = telegramId // Use Telegram ID as user_id for TG users

      const createResult = await supaPost('users', {
        user_id: userId,
        telegram_id: telegramId,
        username: telegramData.username || null,
        first_name: telegramData.first_name || null,
        last_name: telegramData.last_name || null,
        avatar_url: telegramData.photo_url || null,
        balance: 6,
        created_at: new Date().toISOString()
      })

      if (!createResult.ok) {
        res.status(500).json({ ok: false, error: 'Failed to create user' })
        return
      }

      publicUser = {
        user_id: userId,
        telegram_id: telegramId,
        username: telegramData.username,
        first_name: telegramData.first_name,
        last_name: telegramData.last_name,
        avatar_url: telegramData.photo_url,
        balance: 6
      }
    }

    // For Telegram login, we create a simple session token
    // (Full Supabase Auth integration for TG users is optional and more complex)
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days

    // Store session (you might want to store this in a sessions table)
    // For now, we'll return a signed token
    const tokenPayload = {
      user_id: publicUser.user_id,
      telegram_id: telegramId,
      type: 'telegram',
      exp: Math.floor(expiresAt / 1000)
    }

    // Simple base64 encoding (in production, use proper JWT)
    const accessToken = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url')

    res.json({
      ok: true,
      access_token: accessToken,
      expires_at: expiresAt,
      user: {
        id: publicUser.user_id,
        telegram_id: telegramId,
        first_name: publicUser.first_name,
        username: publicUser.username,
        balance: publicUser.balance,
        avatar_url: publicUser.avatar_url
      }
    })
  } catch (error) {
    console.error('[Auth] Telegram login error:', error)
    res.status(500).json({ ok: false, error: 'Internal server error' })
  }
})

/**
 * Link Telegram account to existing user
 * POST /api/auth/link-telegram
 */
router.post('/link-telegram', async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, telegram_data } = req.body

    if (!user_id || !telegram_data) {
      res.status(400).json({ ok: false, error: 'user_id and telegram_data are required' })
      return
    }

    // Validate Telegram data
    if (!validateTelegramLoginData(telegram_data)) {
      res.status(401).json({ ok: false, error: 'Invalid Telegram authentication' })
      return
    }

    const telegramId = parseInt(telegram_data.id, 10)

    // Check if telegram_id is already linked to another account
    const existing = await supaSelect('users', `?telegram_id=eq.${telegramId}&select=user_id`)
    if (existing.ok && Array.isArray(existing.data) && existing.data.length > 0) {
      if (existing.data[0].user_id !== user_id) {
        res.status(409).json({ ok: false, error: 'This Telegram account is already linked to another user' })
        return
      }
    }

    // Link Telegram to user
    const updateResult = await supaPatch('users', `?user_id=eq.${user_id}`, {
      telegram_id: telegramId,
      username: telegram_data.username || undefined,
      avatar_url: telegram_data.photo_url || undefined
    })

    if (!updateResult.ok) {
      res.status(500).json({ ok: false, error: 'Failed to link Telegram account' })
      return
    }

    res.json({ ok: true, telegram_id: telegramId })
  } catch (error) {
    console.error('[Auth] Link Telegram error:', error)
    res.status(500).json({ ok: false, error: 'Internal server error' })
  }
})

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      res.status(400).json({ ok: false, error: 'refresh_token is required' })
      return
    }

    const result = await refreshSession(refresh_token)

    if (!result.ok || !result.data) {
      res.status(401).json({ ok: false, error: result.error || 'Invalid refresh token' })
      return
    }

    const { session, user } = result.data

    res.json({
      ok: true,
      access_token: session?.access_token,
      refresh_token: session?.refresh_token,
      expires_at: session?.expires_at
    })
  } catch (error) {
    console.error('[Auth] Refresh error:', error)
    res.status(500).json({ ok: false, error: 'Internal server error' })
  }
})

/**
 * Logout
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  // Client should discard tokens
  res.json({ ok: true })
})

/**
 * Get current user (verify token)
 * GET /api/auth/me
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.header('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ ok: false, error: 'Authorization required' })
      return
    }

    const token = authHeader.slice(7)

    // Try to verify as Supabase token first
    const result = await verifySupabaseToken(token)

    if (result.ok && result.data) {
      const user = result.data
      const publicUser = await supaSelect('users', `?auth_id=eq.${user.id}&select=*`)
      const userData = (publicUser.ok && Array.isArray(publicUser.data) && publicUser.data[0]) || {}

      res.json({
        ok: true,
        user: {
          id: userData.user_id,
          auth_id: user.id,
          email: user.email,
          first_name: userData.first_name,
          username: userData.username,
          balance: userData.balance,
          avatar_url: userData.avatar_url,
          telegram_linked: !!userData.telegram_id
        }
      })
      return
    }

    // Try to decode as simple Telegram token
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64url').toString())
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        res.status(401).json({ ok: false, error: 'Token expired' })
        return
      }

      if (payload.user_id) {
        const publicUser = await supaSelect('users', `?user_id=eq.${payload.user_id}&select=*`)
        const userData = (publicUser.ok && Array.isArray(publicUser.data) && publicUser.data[0]) || null

        if (userData) {
          res.json({
            ok: true,
            user: {
              id: userData.user_id,
              telegram_id: userData.telegram_id,
              first_name: userData.first_name,
              username: userData.username,
              balance: userData.balance,
              avatar_url: userData.avatar_url
            }
          })
          return
        }
      }
    } catch {
      // Not a valid token format
    }

    res.status(401).json({ ok: false, error: 'Invalid token' })
  } catch (error) {
    console.error('[Auth] Get me error:', error)
    res.status(500).json({ ok: false, error: 'Internal server error' })
  }
})

export default router
