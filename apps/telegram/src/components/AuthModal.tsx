import { useState, useEffect, useRef } from 'react'
import { X, Mail, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { signupWithEmail, loginWithEmail, loginWithTelegram, loginWithGoogle } from '@aiverse/shared/stores/authStore'

// Extend window for Telegram callback
declare global {
    interface Window {
        onTelegramAuthModal?: (user: Record<string, string>) => void
    }
}

type AuthModalProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const [isSignup, setIsSignup] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [firstName, setFirstName] = useState('')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const telegramContainerRef = useRef<HTMLDivElement>(null)

    // Load Telegram Login Widget
    useEffect(() => {
        if (!isOpen) return
        const container = telegramContainerRef.current
        if (!container) return

        // Small delay to ensure DOM is ready
        const timer = setTimeout(() => {
            container.innerHTML = ''

            const script = document.createElement('script')
            script.src = 'https://telegram.org/js/telegram-widget.js?22'
            const isDevMode = import.meta.env.VITE_DEV_MODE === 'true'
            const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME ||
                (isDevMode ? 'TestingAIstuff_bot' : 'AiVerseAppBot')
            script.setAttribute('data-telegram-login', botName)
            script.setAttribute('data-size', 'large')
            script.setAttribute('data-radius', '12')
            script.setAttribute('data-onauth', 'onTelegramAuthModal(user)')
            script.setAttribute('data-request-access', 'write')
            script.setAttribute('data-userpic', 'false')
            script.setAttribute('data-lang', i18n.language === 'ru' ? 'ru' : 'en')
            script.async = true

            container.appendChild(script)
        }, 100)

        // Telegram callback
        window.onTelegramAuthModal = async (user: Record<string, string>) => {
            setLoading(true)
            setError('')
            try {
                const ref = localStorage.getItem('aiverse_ref') || undefined
                const result = await loginWithTelegram(user, ref)
                if (result.ok) {
                    localStorage.removeItem('aiverse_ref')
                    onSuccess?.()
                    onClose()
                } else {
                    setError(result.error || t('login.error.telegramFailed', 'Ошибка Telegram авторизации'))
                }
            } catch {
                setError(t('login.error.connection', 'Ошибка соединения'))
            } finally {
                setLoading(false)
            }
        }

        return () => {
            clearTimeout(timer)
            delete window.onTelegramAuthModal
        }
    }, [isOpen, i18n.language, onClose, onSuccess, t])

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)

        try {
            if (isSignup) {
                const ref = localStorage.getItem('aiverse_ref') || undefined
                const result = await signupWithEmail(email, password, firstName, undefined, ref)
                if (result.ok) {
                    localStorage.removeItem('aiverse_ref')
                    setSuccess(t('login.success.checkEmail', 'Проверьте email для подтверждения'))
                    setIsSignup(false)
                } else {
                    setError(result.error || t('login.error.signupFailed', 'Ошибка регистрации'))
                }
            } else {
                const result = await loginWithEmail(email, password)
                if (result.ok) {
                    onSuccess?.()
                    onClose()
                } else {
                    setError(result.error || t('login.error.invalidCredentials', 'Неверные данные'))
                }
            }
        } catch {
            setError(t('login.error.connection', 'Ошибка соединения'))
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
                setError(result.error || t('login.error.googleFailed', 'Ошибка Google авторизации'))
                setGoogleLoading(false)
            }
            // Will redirect to Google
        } catch {
            setError(t('login.error.connection', 'Ошибка соединения'))
            setGoogleLoading(false)
        }
    }

    const handleGoToLogin = () => {
        onClose()
        navigate('/login')
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full relative shadow-2xl animate-in slide-in-from-bottom-4">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
                    <X size={20} />
                </button>

                <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-4 mx-auto">
                    <User size={24} className="text-violet-400" />
                </div>

                <h3 className="text-xl font-bold text-white text-center mb-2">
                    {isSignup ? t('login.signupTitle', 'Создать аккаунт') : t('login.title', 'Войти в AiVerse')}
                </h3>
                <p className="text-zinc-400 text-center text-sm mb-6">
                    {t('login.authModal.subtitle', 'Войдите, чтобы сохранить ваши генерации')}
                </p>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-3 text-sm mb-4">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl p-3 text-sm mb-4">
                        {success}
                    </div>
                )}

                {/* Social Login Buttons */}
                <div className="space-y-3 mb-4">
                    {/* Telegram Login Widget */}
                    <div ref={telegramContainerRef} className="min-h-[40px] flex items-center justify-center [&>iframe]:mx-auto" />

                    {/* Google Login */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={googleLoading}
                        className="w-full py-3 rounded-xl bg-white text-black font-bold flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {googleLoading ? '...' : 'Google'}
                    </button>
                </div>

                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-700"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-zinc-900 px-2 text-zinc-500">{t('login.or', 'или')}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 mb-4">
                    {isSignup && (
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder={t('login.firstName', 'Имя')}
                            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                        />
                    )}
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('login.email', 'Email')}
                        required
                        className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('login.password', 'Пароль')}
                        required
                        minLength={6}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Mail size={18} />
                        {loading ? '...' : (isSignup ? t('login.signup', 'Зарегистрироваться') : t('login.submit', 'Войти'))}
                    </button>
                </form>

                <div className="text-center">
                    <button
                        onClick={() => setIsSignup(!isSignup)}
                        className="text-violet-400 text-sm hover:underline"
                    >
                        {isSignup ? t('login.haveAccount', 'Уже есть аккаунт? Войти') : t('login.noAccount', 'Нет аккаунта? Создать')}
                    </button>
                </div>

                <div className="text-center mt-3">
                    <button
                        onClick={handleGoToLogin}
                        className="text-zinc-500 text-xs hover:text-zinc-300"
                    >
                        {t('login.authModal.goToLoginPage', 'Открыть полную страницу входа')}
                    </button>
                </div>
            </div>
        </div>
    )
}
