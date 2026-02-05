/**
 * Supabase Auth Service
 * Handles authentication operations using Supabase Auth
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Admin client with service role key (for server-side operations)
let adminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
    if (!adminClient) {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
        }
        adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        })
    }
    return adminClient
}

/**
 * Sign up a new user with email and password
 * Uses auth.signUp to trigger confirmation email
 */
export async function signUpWithEmail(email: string, password: string, metadata?: Record<string, unknown>) {
    const admin = getSupabaseAdmin()

    // Use signUp (not admin.createUser) to send confirmation email
    const { data, error } = await admin.auth.signUp({
        email,
        password,
        options: {
            data: metadata,
            emailRedirectTo: process.env.VITE_SITE_URL || 'https://aiverse-telegram-app-stage.up.railway.app'
        }
    })

    if (error) {
        return { ok: false, error: error.message, data: null }
    }

    return { ok: true, error: null, data: data.user }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
    const admin = getSupabaseAdmin()

    // Use signInWithPassword for login
    const { data, error } = await admin.auth.signInWithPassword({
        email,
        password
    })

    if (error) {
        return { ok: false, error: error.message, data: null }
    }

    return {
        ok: true,
        error: null,
        data: {
            user: data.user,
            session: data.session
        }
    }
}

/**
 * Get user by auth ID
 */
export async function getAuthUser(authId: string) {
    const admin = getSupabaseAdmin()

    const { data, error } = await admin.auth.admin.getUserById(authId)

    if (error) {
        return { ok: false, error: error.message, data: null }
    }

    return { ok: true, error: null, data: data.user }
}

/**
 * Verify Supabase JWT token
 */
export async function verifySupabaseToken(token: string) {
    const admin = getSupabaseAdmin()

    const { data, error } = await admin.auth.getUser(token)

    if (error) {
        return { ok: false, error: error.message, data: null }
    }

    return { ok: true, error: null, data: data.user }
}

/**
 * Create user in auth.users for Telegram login (without password)
 * This creates a user that can only log in via Telegram
 */
export async function createTelegramAuthUser(telegramId: number, metadata?: Record<string, unknown>) {
    const admin = getSupabaseAdmin()

    // Generate a unique fake email for Telegram users (won't be used for login)
    const fakeEmail = `tg_${telegramId}@telegram.aiverse.local`

    const { data, error } = await admin.auth.admin.createUser({
        email: fakeEmail,
        email_confirm: true, // No confirmation needed
        user_metadata: {
            telegram_id: telegramId,
            auth_provider: 'telegram',
            ...metadata
        }
    })

    if (error) {
        return { ok: false, error: error.message, data: null }
    }

    return { ok: true, error: null, data: data.user }
}

/**
 * Generate session tokens for a user (for Telegram login)
 */
export async function generateSession(userId: string) {
    const admin = getSupabaseAdmin()

    // Generate a link that we can use to create a session
    const { data, error } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: `tg_${userId}@telegram.aiverse.local`
    })

    if (error) {
        return { ok: false, error: error.message, data: null }
    }

    return { ok: true, error: null, data }
}

/**
 * Refresh session
 */
export async function refreshSession(refreshToken: string) {
    const admin = getSupabaseAdmin()

    const { data, error } = await admin.auth.refreshSession({ refresh_token: refreshToken })

    if (error) {
        return { ok: false, error: error.message, data: null }
    }

    return {
        ok: true,
        error: null,
        data: {
            session: data.session,
            user: data.user
        }
    }
}

/**
 * Sign out (revoke session)
 */
export async function signOut(userId: string) {
    const admin = getSupabaseAdmin()

    const { error } = await admin.auth.admin.signOut(userId)

    if (error) {
        return { ok: false, error: error.message }
    }

    return { ok: true, error: null }
}
