import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Bell, Newspaper, CheckCheck, Settings } from 'lucide-react'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface Notification {
    id: number
    type: string
    title: string
    body: string
    data?: { deep_link?: string; generation_id?: number }
    read: boolean
    created_at: string
}

interface AppNews {
    id: number
    title: string
    body: string
    image_url?: string
    action_url?: string
    created_at: string
    read?: boolean
}

interface Props {
    isOpen: boolean
    onClose: () => void
}

export function NotificationsModal({ isOpen, onClose }: Props) {
    const { t } = useTranslation()
    const { user, platform } = useTelegram()
    const { impact } = useHaptics()
    const navigate = useNavigate()
    const [tab, setTab] = useState<'personal' | 'news'>('personal')
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [news, setNews] = useState<AppNews[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!isOpen || !user?.id) return

        const fetchData = async () => {
            setLoading(true)
            try {
                const [notifRes, newsRes] = await Promise.all([
                    fetch(`/api/notifications?user_id=${user.id}`),
                    fetch(`/api/app-news?user_id=${user.id}`)
                ])
                const notifData = await notifRes.json()
                const newsData = await newsRes.json()
                setNotifications(notifData.items || [])
                setNews(newsData.items || [])
            } catch (e) {
                console.error('Failed to fetch notifications', e)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [isOpen, user?.id])

    const handleReadAll = async () => {
        if (!user?.id) return
        impact('light')
        try {
            await fetch('/api/notifications/read-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id })
            })
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        } catch (e) {
            console.error('Failed to mark all read', e)
        }
    }

    const handleReadAllNews = async () => {
        if (!user?.id) return
        impact('light')
        try {
            await fetch('/api/app-news/read-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id })
            })
            setNews(prev => prev.map(n => ({ ...n, read: true })))
        } catch (e) {
            console.error('Failed to mark all news read', e)
        }
    }

    const handleNotificationClick = (notif: Notification) => {
        impact('light')
        if (notif.data?.deep_link) {
            onClose()
            navigate(notif.data.deep_link)
        } else if (notif.data?.generation_id) {
            onClose()
            navigate(`/profile?gen=${notif.data.generation_id}`)
        }
    }

    const handleNewsClick = (item: AppNews) => {
        impact('light')
        if (item.action_url) {
            onClose()
            if (item.action_url.startsWith('/')) {
                navigate(item.action_url)
            } else {
                window.open(item.action_url, '_blank')
            }
        }
    }

    const formatTime = (date: string) => {
        const d = new Date(date)
        const now = new Date()
        const diff = now.getTime() - d.getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 60) return `${mins} ${t('notifications.time.m')}`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours} ${t('notifications.time.h')}`
        const days = Math.floor(hours / 24)
        return `${days} ${t('notifications.time.d')}`
    }

    if (!isOpen) return null

    return createPortal(
        <div
            className={`fixed inset-0 z-[60] flex items-start justify-center px-2 ${platform === 'ios' ? 'pt-28' : 'pt-20'}`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[75vh]">
                {/* Header */}
                <div className="p-5 pb-3 flex justify-between items-center shrink-0 border-b border-white/10">
                    <h2 className="text-lg font-bold text-white">{t('notifications.title')}</h2>
                    <div className="flex items-center gap-2">
                        {tab === 'personal' && notifications.some(n => !n.read) && (
                            <button
                                onClick={handleReadAll}
                                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                                title={t('notifications.readAll')}
                            >
                                <CheckCheck size={16} />
                            </button>
                        )}
                        {tab === 'news' && news.some(n => !n.read) && (
                            <button
                                onClick={handleReadAllNews}
                                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                                title={t('notifications.readAll')}
                            >
                                <CheckCheck size={16} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Settings Link */}
                <button
                    onClick={() => {
                        impact('light')
                        onClose()
                        navigate('/settings?notif=open')
                    }}
                    className="flex items-center gap-2 px-5 py-2 text-xs text-zinc-400 hover:text-violet-400 transition-colors border-b border-white/5"
                >
                    <Settings size={14} />
                    <span>{t('notifications.settings')}</span>
                </button>

                {/* Tabs */}
                <div className="flex shrink-0">
                    <button
                        onClick={() => { setTab('personal'); impact('light') }}
                        className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 relative ${tab === 'personal' ? 'text-white border-b-2 border-violet-500' : 'text-zinc-500'}`}
                    >
                        <Bell size={16} />
                        {t('notifications.personal')}
                        {notifications.some(n => !n.read) && (
                            <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                    </button>
                    <button
                        onClick={() => { setTab('news'); impact('light') }}
                        className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 relative ${tab === 'news' ? 'text-white border-b-2 border-violet-500' : 'text-zinc-500'}`}
                    >
                        <Newspaper size={16} />
                        {t('notifications.news')}
                        {news.some(n => !n.read) && (
                            <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full" />
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto min-h-[200px]">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : tab === 'personal' ? (
                        notifications.length === 0 ? (
                            <div className="text-center py-12 text-zinc-500 text-sm">
                                {t('notifications.emptyPersonal')}
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {notifications.map(n => (
                                    <button
                                        key={n.id}
                                        onClick={() => handleNotificationClick(n)}
                                        className={`w-full p-4 text-left hover:bg-white/5 transition-colors ${!n.read ? 'bg-violet-500/5' : ''}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {!n.read && (
                                                <div className="w-2 h-2 rounded-full bg-violet-500 mt-2 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-white">{n.title}</div>
                                                <div className="text-xs text-zinc-400 mt-0.5">{n.body}</div>
                                                <div className="text-[10px] text-zinc-600 mt-1">{formatTime(n.created_at)}</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )
                    ) : (
                        news.length === 0 ? (
                            <div className="text-center py-12 text-zinc-500 text-sm">
                                {t('notifications.emptyNews')}
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {news.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleNewsClick(item)}
                                        className="w-full p-4 text-left hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Unread indicator */}
                                            {!item.read && (
                                                <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                                            )}
                                            {item.image_url && (
                                                <img
                                                    src={item.image_url}
                                                    alt=""
                                                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-white">{item.title}</div>
                                                <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{item.body}</div>
                                                <div className="text-[10px] text-zinc-600 mt-1">{formatTime(item.created_at)}</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
