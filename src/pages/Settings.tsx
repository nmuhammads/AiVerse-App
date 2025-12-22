import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Globe, Bell, Info, Shield, ChevronRight, Moon, Zap, Users, MessageCircle, Clock, ChevronDown, ArrowLeft } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface NotificationSettings {
    telegram_news: boolean
    telegram_remix: boolean
    telegram_generation: boolean
    telegram_likes: boolean
}

const defaultSettings: NotificationSettings = {
    telegram_news: false,
    telegram_remix: true,
    telegram_generation: true,
    telegram_likes: true
}

export default function Settings() {
    const navigate = useNavigate()
    const { impact } = useHaptics()
    const { addToHomeScreen, checkHomeScreenStatus, platform, tg } = useTelegram()
    const [canAddToHome, setCanAddToHome] = useState(false)
    const [notifExpanded, setNotifExpanded] = useState(false)
    const [notifSettings, setNotifSettings] = useState<NotificationSettings>(defaultSettings)
    const [showArrow, setShowArrow] = useState(false)
    const [searchParams] = useSearchParams()

    const isMobile = platform === 'ios' || platform === 'android'

    const location = useLocation()

    // Авто-открытие секции уведомлений при переходе из попапа
    useEffect(() => {
        if (searchParams.get('notif') === 'open') {
            setNotifExpanded(true)
            setShowArrow(true)
            // Убираем стрелку через 3 секунды
            const timer = setTimeout(() => setShowArrow(false), 3000)
            return () => clearTimeout(timer)
        }
    }, [searchParams])

    useEffect(() => {
        if (isMobile) {
            tg.BackButton.show()
            const handleBack = () => {
                impact('light')
                if (location.state?.fromDeepLink) {
                    navigate('/', { replace: true })
                } else {
                    navigate(-1)
                }
            }
            tg.BackButton.onClick(handleBack)
            return () => {
                tg.BackButton.hide()
                tg.BackButton.offClick(handleBack)
            }
        }
    }, [isMobile, navigate, tg, location])

    useEffect(() => {
        checkHomeScreenStatus((status) => {
            if (status === 'missed' || status === 'unknown') {
                setCanAddToHome(true)
            }
        })
    }, [])

    const [remixCount, setRemixCount] = useState(0)
    const { user } = useTelegram()

    useEffect(() => {
        if (user?.id) {
            fetch(`/api/user/info/${user.id}`).then(async r => {
                const j = await r.json().catch(() => null)
                if (r.ok && j && typeof j.remix_count === 'number') {
                    setRemixCount(j.remix_count)
                }
                // Load notification settings
                if (r.ok && j && j.notification_settings) {
                    setNotifSettings({ ...defaultSettings, ...j.notification_settings })
                }
            })
        }
    }, [user?.id])

    const updateNotifSetting = async (key: keyof NotificationSettings, value: boolean) => {
        if (!user?.id) return
        impact('light')
        const newSettings = { ...notifSettings, [key]: value }
        setNotifSettings(newSettings)

        try {
            await fetch('/api/user/notification-settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, settings: newSettings })
            })
        } catch (e) {
            console.error('Failed to save notification settings', e)
        }
    }

    const sections = [
        {
            title: 'Основные',
            items: [
                { icon: Globe, label: 'Язык', value: 'Русский', onClick: () => { } },
                { icon: Moon, label: 'Тема', value: 'Темная', onClick: () => toast.error('Упс пока доступна только темная тема') },
                ...(canAddToHome ? [{ icon: Zap, label: 'Добавить на главный экран', onClick: addToHomeScreen }] : [])
            ]
        },
        {
            title: 'Ремиксы',
            items: [
                { icon: Users, label: 'Накопления', value: String(remixCount), onClick: () => navigate('/accumulations') },
            ]
        },
        {
            title: 'Социальные',
            items: [
                { icon: Users, label: 'Подписки и подписчики', onClick: () => navigate('/subscriptions') },
            ]
        },
        {
            title: 'О приложении',
            items: [
                { icon: MessageCircle, label: 'Поддержка', onClick: () => platform === 'ios' ? window.open('https://t.me/aiversebots', '_blank') : tg.openTelegramLink('https://t.me/aiversebots') },
                { icon: Clock, label: 'Хранение данных', value: '60 дней', onClick: () => toast.info('Изображения хранятся 60 дней. Оригиналы в максимальном качестве отправляются в чат с ботом и хранятся там бессрочно 💾', { duration: 5000 }) },
                { icon: Info, label: 'Версия', value: 'v2.8.3', onClick: () => { } },
            ]
        }
    ]

    // Custom padding for different platforms
    const getPaddingTop = () => {
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 10px)'
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 50px)'
        return '50px' // Desktop/Web
    }

    const notifOptions = [
        { key: 'telegram_news' as const, label: 'Новости' },
        { key: 'telegram_remix' as const, label: 'Ремиксы' },
        { key: 'telegram_generation' as const, label: 'Генерации' },
        { key: 'telegram_likes' as const, label: 'Лайки' },
    ]

    return (
        <div className="min-h-dvh bg-black text-white pb-32" style={{ paddingTop: getPaddingTop() }}>
            {/* Header */}
            <div className="px-4 py-4 flex items-center gap-4 relative">
                {!isMobile && (
                    <button
                        onClick={() => { impact('light'); navigate(-1) }}
                        className="w-10 h-10 rounded-xl bg-zinc-900/50 border border-white/10 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}
                <h1 className={`text-xl font-bold ${isMobile ? 'ml-1' : ''}`}>Настройки</h1>
            </div>

            {/* Content */}
            <div className="px-4 space-y-6 mt-4">
                {sections.map((section, idx) => (
                    <div key={idx} className="space-y-3">
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">{section.title}</h2>
                        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                            {section.items.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => { impact('light'); item.onClick() }}
                                    className={`w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors ${i !== section.items.length - 1 ? 'border-b border-white/5' : ''}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                                        <item.icon size={16} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-medium text-white">{item.label}</div>
                                    </div>
                                    {item.value && <div className="text-xs font-medium text-zinc-500">{item.value}</div>}
                                    <ChevronRight size={16} className="text-zinc-600" />
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Notification Settings - Collapsible */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">Уведомления</h2>
                        {showArrow && (
                            <div className="flex items-center gap-1 animate-pulse">
                                <ArrowLeft size={14} className="text-violet-400" />
                                <span className="text-xs text-violet-400">Настройте здесь</span>
                            </div>
                        )}
                    </div>
                    <div className={`bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm ${showArrow ? 'ring-2 ring-violet-500/50' : ''}`}>
                        <button
                            onClick={() => { impact('light'); setNotifExpanded(!notifExpanded) }}
                            className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                                <Bell size={16} />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-sm font-medium text-white">Уведомления в Telegram</div>
                            </div>
                            <ChevronDown size={16} className={`text-zinc-600 transition-transform ${notifExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        {notifExpanded && (
                            <div className="border-t border-white/5">
                                {notifOptions.map((opt, i) => (
                                    <div
                                        key={opt.key}
                                        className={`flex items-center justify-between px-4 py-3 ${i !== notifOptions.length - 1 ? 'border-b border-white/5' : ''}`}
                                    >
                                        <span className="text-sm text-zinc-400 pl-12">{opt.label}</span>
                                        <button
                                            onClick={() => updateNotifSetting(opt.key, !notifSettings[opt.key])}
                                            className={`w-11 h-6 rounded-full transition-colors ${notifSettings[opt.key] ? 'bg-violet-600' : 'bg-zinc-700'}`}
                                        >
                                            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notifSettings[opt.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
