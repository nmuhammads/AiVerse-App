/**
 * Auth Store - manages authentication state
 * Supports both Telegram Mini App and Web/Mobile auth
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
    id: number
    auth_id?: string
    telegram_id?: number
    email?: string
    username?: string
    first_name?: string
    last_name?: string
    avatar_url?: string
    balance?: number
    telegram_linked?: boolean
}

interface AuthState {
    user: User | null
    accessToken: string | null
    refreshToken: string | null
    expiresAt: number | null
    isAuthenticated: boolean
    isLoading: boolean
    authMethod: 'telegram' | 'web' | null

    // Actions
    setUser: (user: User | null) => void
    setTokens: (accessToken: string, refreshToken: string | null, expiresAt: number) => void
    setLoading: (loading: boolean) => void
    setAuthMethod: (method: 'telegram' | 'web' | null) => void
    logout: () => void

    // Token helpers
    getAuthHeaders: () => Record<string, string>
    isTokenExpired: () => boolean
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isAuthenticated: false,
            isLoading: true,
            authMethod: null,

            setUser: (user) => set({
                user,
                isAuthenticated: !!user
            }),

            setTokens: (accessToken, refreshToken, expiresAt) => set({
                accessToken,
                refreshToken,
                expiresAt
            }),

            setLoading: (isLoading) => set({ isLoading }),

            setAuthMethod: (authMethod) => set({ authMethod }),

            logout: () => {
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    expiresAt: null,
                    isAuthenticated: false,
                    authMethod: null
                })
                // Call logout API
                fetch('/api/auth/logout', { method: 'POST' }).catch(() => { })
            },

            getAuthHeaders: () => {
                const { accessToken, authMethod } = get()

                // For Telegram Mini App, use WebApp.initData (handled by useTelegram)
                if (authMethod === 'telegram') {
                    return {}
                }

                // For web auth, use Bearer token
                if (accessToken) {
                    return { 'Authorization': `Bearer ${accessToken}` }
                }

                return {}
            },

            isTokenExpired: () => {
                const { expiresAt } = get()
                if (!expiresAt) return true
                return Date.now() > expiresAt * 1000
            }
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                expiresAt: state.expiresAt,
                isAuthenticated: state.isAuthenticated,
                authMethod: state.authMethod
            })
        }
    )
)

// API functions

export async function loginWithEmail(email: string, password: string) {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })

    const data = await response.json()

    if (data.ok) {
        useAuthStore.getState().setTokens(
            data.access_token,
            data.refresh_token,
            data.expires_at
        )
        useAuthStore.getState().setUser(data.user)
        useAuthStore.getState().setAuthMethod('web')
    }

    return data
}

export async function signupWithEmail(email: string, password: string, firstName?: string, lastName?: string) {
    const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName })
    })

    return await response.json()
}

export async function loginWithTelegram(telegramData: Record<string, string>) {
    const response = await fetch('/api/auth/telegram-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramData)
    })

    const data = await response.json()

    if (data.ok) {
        useAuthStore.getState().setTokens(
            data.access_token,
            null,
            data.expires_at
        )
        useAuthStore.getState().setUser(data.user)
        useAuthStore.getState().setAuthMethod('web')
    }

    return data
}

/**
 * Login with Google OAuth via Supabase Auth
 * Redirects to Google's consent screen
 */
export async function loginWithGoogle() {
    const { createClient } = await import('@supabase/supabase-js')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any).env || {}
    const supabaseUrl = env.VITE_SUPABASE_URL || 'https://coilacklqaljatlvhujl.supabase.co'
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

    if (!supabaseAnonKey) {
        console.error('[Auth] VITE_SUPABASE_ANON_KEY not configured')
        return { ok: false, error: 'Google login not configured' }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent'
            }
        }
    })

    if (error) {
        console.error('[Auth] Google login error:', error)
        return { ok: false, error: error.message }
    }

    return { ok: true, data }
}

export async function refreshTokens() {
    const { refreshToken } = useAuthStore.getState()

    if (!refreshToken) {
        return { ok: false, error: 'No refresh token' }
    }

    const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
    })

    const data = await response.json()

    if (data.ok) {
        useAuthStore.getState().setTokens(
            data.access_token,
            data.refresh_token,
            data.expires_at
        )
    } else {
        // Refresh failed, logout
        useAuthStore.getState().logout()
    }

    return data
}

export async function linkTelegramAccount(telegramData: Record<string, string>) {
    const { user, getAuthHeaders } = useAuthStore.getState()

    if (!user) {
        return { ok: false, error: 'Not authenticated' }
    }

    const response = await fetch('/api/auth/link-telegram', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
        },
        body: JSON.stringify({ user_id: user.id, telegram_data: telegramData })
    })

    const data = await response.json()

    if (data.ok) {
        useAuthStore.getState().setUser({
            ...user,
            telegram_id: data.telegram_id,
            telegram_linked: true
        })
    }

    return data
}
