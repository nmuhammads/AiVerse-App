import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Globe, Bell, Info, Shield, ChevronRight, Moon, Zap, Users, MessageCircle } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export default function Settings() {
    const navigate = useNavigate()
    const { impact } = useHaptics()
    const { addToHomeScreen, checkHomeScreenStatus, platform, tg } = useTelegram()
    const [canAddToHome, setCanAddToHome] = useState(false)

    const isMobile = platform === 'ios' || platform === 'android'

    const location = useLocation()

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
            })
        }
    }, [user?.id])

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
            title: 'Реферальная система',
            items: [
                { icon: Users, label: 'Накопления', value: String(remixCount), onClick: () => navigate('/accumulations') },
            ]
        },
        {
            title: 'О приложении',
            items: [
                { icon: MessageCircle, label: 'Поддержка', onClick: () => platform === 'ios' ? window.open('https://t.me/aiversebots', '_blank') : tg.openTelegramLink('https://t.me/aiversebots') },
                { icon: Info, label: 'Версия', value: 'v2.7.7', onClick: () => { } },
            ]
        }
    ]

    // Custom padding for different platforms
    const getPaddingTop = () => {
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 10px)'
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 50px)'
        return '50px' // Desktop/Web
    }

    return (
        <div className="min-h-dvh bg-black text-white pb-10" style={{ paddingTop: getPaddingTop() }}>
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
            </div>
        </div>
    )
}
