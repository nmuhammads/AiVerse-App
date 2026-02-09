/**
 * Login Page
 * Supports email/password login and Telegram Login Widget
 * Uses app's dark theme and includes language switcher
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Lock, Eye, EyeOff, ArrowRight, MessageCircle, Globe } from 'lucide-react'
import { loginWithEmail, signupWithEmail, loginWithTelegram, loginWithGoogle, useAuthStore } from '../store/authStore'

declare global {
    interface Window {
        onTelegramAuth?: (user: Record<string, string>) => void
    }
}

const LANGUAGES = [
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'en', label: 'English', flag: '🇺🇸' }
]

export default function Login() {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const { isAuthenticated } = useAuthStore()

    const [isSignup, setIsSignup] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [firstName, setFirstName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [showLanguages, setShowLanguages] = useState(false)

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/')
        }
    }, [isAuthenticated, navigate])

    // Load Telegram Login Widget
    useEffect(() => {
        const container = document.getElementById('telegram-login-container')
        if (!container) return

        // Clear previous widget
        container.innerHTML = ''

        const script = document.createElement('script')
        script.src = 'https://telegram.org/js/telegram-widget.js?22'
        // Use staging bot in dev mode, production bot otherwise
        const isDevMode = import.meta.env.VITE_DEV_MODE === 'true'
        const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME ||
            (isDevMode ? 'TestingAIstuff_bot' : 'AiVerseAppBot')
        script.setAttribute('data-telegram-login', botName)
        script.setAttribute('data-size', 'large')
        script.setAttribute('data-radius', '12')
        script.setAttribute('data-onauth', 'onTelegramAuth(user)')
        script.setAttribute('data-request-access', 'write')
        script.setAttribute('data-userpic', 'false')
        // Set widget language based on current i18n language
        script.setAttribute('data-lang', i18n.language === 'ru' ? 'ru' : 'en')
        script.async = true

        container.appendChild(script)

        // Telegram callback
        window.onTelegramAuth = async (user: Record<string, string>) => {
            setLoading(true)
            setError('')

            try {
                const result = await loginWithTelegram(user)
                if (result.ok) {
                    navigate('/')
                } else {
                    setError(result.error || t('login.error.telegramFailed'))
                }
            } catch {
                setError(t('login.error.connection'))
            } finally {
                setLoading(false)
            }
        }

        return () => {
            delete window.onTelegramAuth
        }
    }, [navigate, t, i18n.language])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)

        try {
            if (isSignup) {
                const result = await signupWithEmail(email, password, firstName)
                if (result.ok) {
                    setSuccess(result.message || t('login.success.checkEmail'))
                    setIsSignup(false)
                } else {
                    setError(result.error || t('login.error.signupFailed'))
                }
            } else {
                const result = await loginWithEmail(email, password)
                if (result.ok) {
                    navigate('/')
                } else {
                    setError(result.error || t('login.error.invalidCredentials'))
                }
            }
        } catch {
            setError(t('login.error.connection'))
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setGoogleLoading(true)
        setError('')
        try {
            const result = await loginWithGoogle()
            if (!result.ok) {
                setError(result.error || t('login.error.googleFailed'))
            }
            // If successful, user is redirected to Google
        } catch {
            setError(t('login.error.connection'))
        } finally {
            setGoogleLoading(false)
        }
    }

    const changeLanguage = (code: string) => {
        i18n.changeLanguage(code)
        setShowLanguages(false)
    }

    const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Language Switcher */}
                <div className="absolute top-4 right-4">
                    <div className="relative">
                        <button
                            onClick={() => setShowLanguages(!showLanguages)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
                        >
                            <Globe className="w-4 h-4" />
                            <span className="text-sm">{currentLang.flag} {currentLang.code.toUpperCase()}</span>
                        </button>

                        {showLanguages && (
                            <div className="absolute top-full right-0 mt-2 py-2 bg-zinc-900 border border-white/10 rounded-xl shadow-xl min-w-[140px] z-50">
                                {LANGUAGES.map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => changeLanguage(lang.code)}
                                        className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/10 transition-colors ${lang.code === i18n.language ? 'text-violet-400' : 'text-white/70'
                                            }`}
                                    >
                                        <span>{lang.flag}</span>
                                        <span>{lang.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Logo */}
                <div className="text-center mb-10">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                        AiVerse
                    </h1>
                    <p className="text-white/50 mt-3 text-lg">
                        {isSignup ? t('login.subtitle.signup') : t('login.subtitle.welcome')}
                    </p>
                </div>

                {/* Card */}
                <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10">

                    {/* Error/Success messages */}
                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                            {success}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignup && (
                            <div>
                                <label className="block text-sm text-white/50 mb-1.5">{t('login.field.name')}</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
                                    placeholder={t('login.placeholder.name')}
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm text-white/50 mb-1.5">{t('login.field.email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
                                    placeholder={t('login.placeholder.email')}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-white/50 mb-1.5">{t('login.field.password')}</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50 transition-colors"
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-medium hover:from-violet-500 hover:to-fuchsia-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {isSignup ? t('login.button.signup') : t('login.button.signin')}
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-zinc-900 text-white/40">{t('login.divider')}</span>
                        </div>
                    </div>

                    {/* Social Login Buttons - matching Telegram widget size (~240px × 40px) */}
                    <div className="flex flex-col gap-3 items-center">
                        {/* Google Login */}
                        <button
                            onClick={handleGoogleLogin}
                            disabled={googleLoading || loading}
                            className="w-[240px] h-[40px] px-4 rounded-full bg-white text-gray-800 font-medium hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                            {googleLoading ? (
                                <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
                            ) : (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    <span>Google</span>
                                </>
                            )}
                        </button>

                        {/* Telegram Login Widget - centered */}
                        <div id="telegram-login-container" className="h-[40px] flex justify-center" />
                    </div>
                </div>

                {/* Toggle signup/login */}
                <div className="mt-6 text-center">
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignup(!isSignup)
                            setError('')
                            setSuccess('')
                        }}
                        className="text-white/40 hover:text-white/70 transition-colors text-sm"
                    >
                        {isSignup ? t('login.toggle.hasAccount') : t('login.toggle.noAccount')}
                    </button>
                </div>

                {/* Footer */}
                <p className="text-center text-white/20 text-xs mt-6">
                    {t('login.terms')}
                </p>
            </div>
        </div>
    )
}
