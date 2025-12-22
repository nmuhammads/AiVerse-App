import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Users, UserPlus } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'

interface UserItem {
    user_id: number
    username: string | null
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    followed_at: string
}

type TabType = 'followers' | 'following'

export default function SubscriptionsPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const { impact } = useHaptics()
    const { user, platform, tg } = useTelegram()

    const initialTab = (searchParams.get('tab') as TabType) || 'followers'
    const [activeTab, setActiveTab] = useState<TabType>(initialTab)
    const [followers, setFollowers] = useState<UserItem[]>([])
    const [following, setFollowing] = useState<UserItem[]>([])
    const [loading, setLoading] = useState(true)

    const isMobile = platform === 'ios' || platform === 'android'

    // Back button handling
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

    // Fetch data
    useEffect(() => {
        if (!user?.id) return

        const fetchData = async () => {
            setLoading(true)
            try {
                const [followersRes, followingRes] = await Promise.all([
                    fetch(`/api/user/followers/${user.id}`),
                    fetch(`/api/user/following/${user.id}`)
                ])

                const followersData = await followersRes.json()
                const followingData = await followingRes.json()

                if (followersRes.ok && followersData.items) {
                    setFollowers(followersData.items)
                }
                if (followingRes.ok && followingData.items) {
                    setFollowing(followingData.items)
                }
            } catch (e) {
                console.error('Failed to fetch subscriptions:', e)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [user?.id])

    const getPaddingTop = () => {
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 10px)'
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 50px)'
        return '50px'
    }

    const getDisplayName = (item: UserItem) => {
        if (item.first_name) {
            return item.last_name ? `${item.first_name} ${item.last_name}` : item.first_name
        }
        return item.username ? `@${item.username}` : 'User'
    }

    const getAvatarUrl = (item: UserItem) => {
        if (item.avatar_url) return item.avatar_url
        const seed = item.username || String(item.user_id)
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`
    }

    const currentItems = activeTab === 'followers' ? followers : following

    return (
        <div className="min-h-dvh bg-black text-white pb-32" style={{ paddingTop: getPaddingTop() }}>
            {/* Header */}
            <div className="px-4 py-4 flex items-center gap-4">
                {!isMobile && (
                    <button
                        onClick={() => { impact('light'); navigate(-1) }}
                        className="w-10 h-10 rounded-xl bg-zinc-900/50 border border-white/10 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}
                <h1 className={`text-xl font-bold ${isMobile ? 'ml-1' : ''}`}>Подписки</h1>
            </div>

            {/* Tabs */}
            <div className="px-4 mb-4">
                <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-1 flex gap-1">
                    <button
                        onClick={() => { setActiveTab('followers'); impact('light') }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'followers'
                                ? 'bg-violet-600 text-white shadow-lg'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <Users size={16} />
                        Подписчики
                        {followers.length > 0 && (
                            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{followers.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => { setActiveTab('following'); impact('light') }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'following'
                                ? 'bg-violet-600 text-white shadow-lg'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                    >
                        <UserPlus size={16} />
                        Подписки
                        {following.length > 0 && (
                            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{following.length}</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="px-4">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                                <div className="w-12 h-12 rounded-full bg-zinc-800" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-zinc-800 rounded w-32" />
                                    <div className="h-3 bg-zinc-800 rounded w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : currentItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                        <Users size={48} className="mb-4 opacity-30" />
                        <p className="text-sm font-medium">
                            {activeTab === 'followers' ? 'Пока нет подписчиков' : 'Вы пока ни на кого не подписаны'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {currentItems.map(item => (
                            <button
                                key={item.user_id}
                                onClick={() => {
                                    impact('light')
                                    navigate(`/profile/${item.user_id}`)
                                }}
                                className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-4 flex items-center gap-3 hover:bg-zinc-800/50 transition-colors"
                            >
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 ring-2 ring-violet-500/30">
                                    <img
                                        src={getAvatarUrl(item)}
                                        alt={getDisplayName(item)}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/9.x/avataaars/svg?seed=${item.user_id}`
                                        }}
                                    />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-semibold text-white">{getDisplayName(item)}</div>
                                    {item.username && (
                                        <div className="text-xs text-zinc-500">@{item.username}</div>
                                    )}
                                </div>
                                <ChevronLeft size={16} className="text-zinc-600 rotate-180" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
