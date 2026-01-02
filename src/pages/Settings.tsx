import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Globe, Bell, Info, Shield, ChevronRight, Moon, Zap, Users, MessageCircle, Clock, ChevronDown, ArrowLeft, Check } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { DevModeBanner } from '@/components/DevModeBanner'

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
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const { impact } = useHaptics()
    const { addToHomeScreen, checkHomeScreenStatus, platform, tg } = useTelegram()
    const [canAddToHome, setCanAddToHome] = useState(false)
    const [notifExpanded, setNotifExpanded] = useState(false)
    const [langExpanded, setLangExpanded] = useState(false)
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

    const changeLanguage = (lang: string) => {
        i18n.changeLanguage(lang)
        impact('light')
        setLangExpanded(false)
    }

    const sections = [
        {
            title: t('settings.sections.general'),
            items: [
                {
                    id: 'language',
                    icon: Globe,
                    label: t('settings.items.language'),
                    value: i18n.language.startsWith('ru') ? 'Русский' : 'English',
                    onClick: () => setLangExpanded(!langExpanded),
                    isCollapsible: true,
                    expanded: langExpanded,
                    options: [
                        { label: 'Русский', onClick: () => changeLanguage('ru'), active: i18n.language.startsWith('ru') },
                        { label: 'English', onClick: () => changeLanguage('en'), active: i18n.language.startsWith('en') }
                    ]
                },
                { icon: Moon, label: t('settings.items.theme'), value: t('settings.items.themeValue'), onClick: () => toast.error(t('settings.messages.themeToast')) },
                ...(canAddToHome ? [{ icon: Zap, label: t('settings.items.addToHome'), onClick: addToHomeScreen }] : [])
            ]
        },
        {
            title: t('settings.sections.remix'),
            items: [
                { icon: Users, label: t('settings.items.accumulations'), value: String(remixCount), onClick: () => navigate('/accumulations') },
            ]
        },
        {
            title: t('settings.sections.social'),
            items: [
                { icon: Users, label: t('settings.items.subscriptions'), onClick: () => navigate('/subscriptions') },
            ]
        }
    ]

    const aboutSection = {
        title: t('settings.sections.about'),
        items: [
            { icon: MessageCircle, label: t('settings.items.support'), onClick: () => platform === 'ios' ? window.open('https://t.me/aiversebots', '_blank') : tg.openTelegramLink('https://t.me/aiversebots') },
            { icon: Clock, label: t('settings.items.storage'), value: t('settings.items.storageValue'), onClick: () => toast.info(t('settings.messages.storageToast'), { duration: 5000 }) },
            { icon: Info, label: t('settings.items.version'), value: 'v3.0.7', onClick: () => { } },
        ]
    }

    // Custom padding for different platforms
    const getPaddingTop = () => {
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 10px)'
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 50px)'
        return '50px' // Desktop/Web
    }

    const notifOptions = [
        { key: 'telegram_news' as const, label: t('settings.notifications.options.news') },
        { key: 'telegram_remix' as const, label: t('settings.notifications.options.remix') },
        { key: 'telegram_generation' as const, label: t('settings.notifications.options.generation') },
        { key: 'telegram_likes' as const, label: t('settings.notifications.options.likes') },
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
                <h1 className={`text-xl font-bold ${isMobile ? 'ml-1' : ''}`}>{t('settings.title')}</h1>
            </div>

            {/* Content */}
            <div className="px-4 space-y-6 mt-4">
                {/* Dev Mode Banner */}
                <DevModeBanner />

                {sections.map((section, idx) => (
                    <div key={idx} className="space-y-3">
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">{section.title}</h2>
                        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                            {section.items.map((item, i) => (
                                <div key={i} className={i !== section.items.length - 1 ? 'border-b border-white/5' : ''}>
                                    <button
                                        onClick={() => { impact('light'); item.onClick() }}
                                        className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                                            <item.icon size={16} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-sm font-medium text-white">{item.label}</div>
                                        </div>
                                        {item.value && <div className="text-xs font-medium text-zinc-500">{item.value}</div>}
                                        {/* @ts-ignore */}
                                        {item.isCollapsible ? (
                                            /* @ts-ignore */
                                            <ChevronDown size={16} className={`text-zinc-600 transition-transform ${item.expanded ? 'rotate-180' : ''}`} />
                                        ) : (
                                            <ChevronRight size={16} className="text-zinc-600" />
                                        )}
                                    </button>

                                    {/* @ts-ignore */}
                                    {item.isCollapsible && item.expanded && (
                                        <div className="border-t border-white/5 bg-black/20">
                                            {/* @ts-ignore */}
                                            {item.options?.map((opt, optIdx) => (
                                                <button
                                                    key={optIdx}
                                                    onClick={opt.onClick}
                                                    className="w-full flex items-center justify-between px-4 py-3 pl-16 hover:bg-white/5 transition-colors"
                                                >
                                                    <span className={`text-sm ${opt.active ? 'text-white' : 'text-zinc-400'}`}>{opt.label}</span>
                                                    {opt.active && <Check size={16} className="text-violet-500" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Notification Settings - Collapsible */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">{t('settings.sections.notifications')}</h2>
                        {showArrow && (
                            <div className="flex items-center gap-1 animate-pulse">
                                <ArrowLeft size={14} className="text-violet-400" />
                                <span className="text-xs text-violet-400">{t('settings.notifications.hint')}</span>
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
                                <div className="text-sm font-medium text-white">{t('settings.notifications.telegram')}</div>
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

                {/* About Section - At the bottom */}
                <div className="space-y-3">
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">{aboutSection.title}</h2>
                    <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                        {aboutSection.items.map((item, i) => (
                            <div key={i} className={i !== aboutSection.items.length - 1 ? 'border-b border-white/5' : ''}>
                                <button
                                    onClick={() => { impact('light'); item.onClick() }}
                                    className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
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
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
