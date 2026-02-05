/**
 * Auth Callback Page
 * Handles email confirmation and OAuth callbacks from Supabase
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function AuthCallback() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { setUser, setTokens, setAuthMethod } = useAuthStore()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState('')

    useEffect(() => {
        const handleCallback = async () => {
            // Get tokens from URL hash (Supabase puts them in fragment)
            const hashParams = new URLSearchParams(window.location.hash.substring(1))
            const accessToken = hashParams.get('access_token')
            const refreshToken = hashParams.get('refresh_token')
            const type = hashParams.get('type') // signup, recovery, etc.

            // Also check query params for errors
            const error = searchParams.get('error')
            const errorDescription = searchParams.get('error_description')

            if (error) {
                setStatus('error')
                setMessage(errorDescription || error)
                return
            }

            if (accessToken) {
                try {
                    // Verify token and get user info
                    const response = await fetch('/api/auth/me', {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    })

                    if (response.ok) {
                        const data = await response.json()

                        // Store tokens and user
                        const expiresIn = parseInt(hashParams.get('expires_in') || '3600')
                        const expiresAt = Date.now() + expiresIn * 1000

                        setTokens(accessToken, refreshToken, expiresAt)
                        setUser(data.user)
                        setAuthMethod('web')

                        setStatus('success')
                        setMessage(type === 'signup' ? 'Email подтверждён!' : 'Вход выполнен!')

                        // Redirect after short delay
                        setTimeout(() => navigate('/'), 1500)
                    } else {
                        throw new Error('Failed to verify token')
                    }
                } catch (err) {
                    setStatus('error')
                    setMessage(err instanceof Error ? err.message : 'Ошибка авторизации')
                }
            } else {
                // No token - might be a confirmation without auto-login
                // Try to extract confirmation token
                const token = searchParams.get('token')
                const tokenHash = searchParams.get('token_hash')

                if (token || tokenHash) {
                    // Email was confirmed, redirect to login
                    setStatus('success')
                    setMessage('Email подтверждён! Войдите в аккаунт.')
                    setTimeout(() => navigate('/login'), 2000)
                } else {
                    setStatus('error')
                    setMessage('Недействительная ссылка')
                }
            }
        }

        handleCallback()
    }, [navigate, searchParams, setUser, setTokens, setAuthMethod])

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="text-center">
                {status === 'loading' && (
                    <>
                        <Loader2 className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
                        <p className="text-white/70">Обработка...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                        <p className="text-white text-lg font-medium">{message}</p>
                        <p className="text-white/50 text-sm mt-2">Перенаправление...</p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <p className="text-white text-lg font-medium">Ошибка</p>
                        <p className="text-red-400 text-sm mt-2">{message}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="mt-6 px-6 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                        >
                            Перейти к входу
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
