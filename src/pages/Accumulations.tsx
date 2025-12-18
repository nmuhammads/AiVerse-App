import { useEffect, useState, useRef, useCallback } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { ArrowRight, Coins, ChevronLeft, ImageOff } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useHaptics } from '@/hooks/useHaptics'

interface Generation {
    id: number
    image_url: string | null
    prompt: string
}

interface RewardItem {
    id: number
    amount: number
    created_at: string
    source_generation: Generation | null
    remix_generation: Generation | null
}

const THUMB_BASE_URL = import.meta.env.VITE_R2_PUBLIC_URL_THUMBNAILS || 'https://pub-40a5e220759a483cbf66bbe98d76d7a1.r2.dev'

// Helper to get thumbnail URL from generation id
const getThumbnailUrl = (gen: Generation | null): string | null => {
    if (!gen || !gen.id) return null
    return `${THUMB_BASE_URL}/gen_${gen.id}_thumb.jpg`
}

export default function Accumulations() {
    const [items, setItems] = useState<RewardItem[]>([])
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [page, setPage] = useState(0)
    const observer = useRef<IntersectionObserver | null>(null)

    const { user, platform, tg } = useTelegram()
    const navigate = useNavigate()
    const { impact } = useHaptics()

    const isMobile = platform === 'ios' || platform === 'android'

    const location = useLocation()

    // Handle Back Button
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
                // Don't hide if we are going back to Settings which also needs it? 
                // Actually Settings handles its own button state.
                // But if we pop, the previous screen might not expect it shown.
                // Usually we hide it on unmount if the previous screen doesn't enforce it.
                // But let's just detach listener.
                tg.BackButton.offClick(handleBack)
            }
        }
    }, [isMobile, navigate, tg, impact, location])

    const fetchRewards = useCallback(async (pageNum: number) => {
        if (!user?.id) return
        try {
            setLoading(true)
            const limit = 20
            const offset = pageNum * limit
            const res = await fetch(`/api/user/accumulations?user_id=${user.id}&limit=${limit}&offset=${offset}`)
            const data = await res.json()

            if (data.items && Array.isArray(data.items)) {
                setItems(prev => {
                    const existingIds = new Set(prev.map(p => p.id))
                    const filtered = data.items.filter((u: RewardItem) => !existingIds.has(u.id))
                    return [...prev, ...filtered]
                })

                if (data.items.length < limit) {
                    setHasMore(false)
                }
            } else {
                setHasMore(false)
            }
        } catch (e) {
            console.error('Failed to fetch rewards', e)
        } finally {
            setLoading(false)
        }
    }, [user?.id])

    useEffect(() => {
        if (user?.id) {
            fetchRewards(0)
        }
    }, [user?.id, fetchRewards])

    const lastElementRef = useCallback((node: HTMLDivElement) => {
        if (loading) return
        if (observer.current) observer.current.disconnect()
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => {
                    const nextPage = prev + 1
                    fetchRewards(nextPage)
                    return nextPage
                })
            }
        })
        if (node) observer.current.observe(node)
    }, [loading, hasMore, fetchRewards])

    const paddingTop = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 10px)' : (platform === 'android' ? 'calc(env(safe-area-inset-top) + 50px)' : '50px')

    return (
        <div className="min-h-dvh bg-black text-white pb-10" style={{ paddingTop }}>
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
                <h1 className={`text-xl font-bold ${isMobile ? 'ml-1' : ''}`}>Накопления</h1>
            </div>

            <div className="px-4 space-y-3">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1
                    const date = new Date(item.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

                    return (
                        <div
                            key={item.id}
                            ref={isLast ? lastElementRef : undefined}
                            className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 flex items-center justify-between"
                        >
                            <div className="flex flex-col gap-2">
                                <div className="text-xs text-zinc-500 font-medium">{date}</div>
                                <div className="flex items-center gap-3">
                                    {/* Source Image */}
                                    <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden border border-white/10 flex items-center justify-center">
                                        {item.source_generation ? (
                                            <img
                                                src={getThumbnailUrl(item.source_generation) || item.source_generation.image_url || ''}
                                                alt="Source"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    target.style.display = 'none';
                                                    target.parentElement?.classList.add('show-placeholder');
                                                }}
                                            />
                                        ) : (
                                            <ImageOff size={16} className="text-zinc-600" />
                                        )}
                                        <ImageOff size={16} className="text-zinc-600 hidden group-[.show-placeholder]:block" />
                                    </div>

                                    <ArrowRight size={16} className="text-zinc-600" />

                                    {/* Remix Image */}
                                    <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden border border-white/10 flex items-center justify-center">
                                        {item.remix_generation ? (
                                            <img
                                                src={getThumbnailUrl(item.remix_generation) || item.remix_generation.image_url || ''}
                                                alt="Remix"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    target.style.display = 'none';
                                                    target.parentElement?.classList.add('show-placeholder');
                                                }}
                                            />
                                        ) : (
                                            <ImageOff size={16} className="text-zinc-600" />
                                        )}
                                        <ImageOff size={16} className="text-zinc-600 hidden group-[.show-placeholder]:block" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-lg">
                                    <span>+{item.amount}</span>
                                    <Coins size={16} />
                                </div>
                                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">За ремикс</div>
                            </div>
                        </div>
                    )
                })}

                {loading && (
                    <div className="text-center text-white/50 py-4">Загрузка...</div>
                )}

                {!loading && items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Coins size={32} className="text-zinc-600" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-medium text-white">История пуста</h3>
                            <p className="text-sm text-zinc-500 max-w-[200px] mx-auto">
                                Здесь будут отображаться токены, полученные за ремиксы ваших работ другими пользователями.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
