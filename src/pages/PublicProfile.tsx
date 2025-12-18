import { Share2, History as HistoryIcon, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { FeedImage, type FeedItem } from '@/components/FeedImage'
import { FeedDetailModal } from '@/components/FeedDetailModal'
import { useGenerationStore, type ModelType } from '@/store/generationStore'
import { FeedSkeletonGrid } from '@/components/ui/skeleton'

export default function PublicProfile() {
    const { userId } = useParams()
    const navigate = useNavigate()
    const { impact, notify } = useHaptics()
    const { user: currentUser, platform, tg } = useTelegram()

    const [profileUser, setProfileUser] = useState<any>(null)
    const [items, setItems] = useState<FeedItem[]>([])
    const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null)
    const [total, setTotal] = useState<number | undefined>(undefined)
    const [offset, setOffset] = useState(0)
    const [loading, setLoading] = useState(false)

    const location = useLocation()

    // Native Back Button for Mobile
    useEffect(() => {
        if (platform === 'ios' || platform === 'android') {
            tg.BackButton.show()
            const handleBack = () => {
                if (location.state?.fromDeepLink) {
                    navigate('/', { replace: true })
                } else {
                    navigate(-1)
                }
            }
            tg.BackButton.onClick(handleBack)
            return () => {
                tg.BackButton.offClick(handleBack)
                tg.BackButton.hide()
            }
        }
    }, [platform, navigate, tg, location])

    const {
        setPrompt,
        setSelectedModel,
        setParentGeneration,
        setCurrentScreen,
        setAspectRatio,
        setGenerationMode,
        setUploadedImages
    } = useGenerationStore()

    useEffect(() => {
        if (userId) {
            // Fetch User Info
            fetch(`/api/user/info/${userId}`).then(async r => {
                const j = await r.json().catch(() => null)
                if (r.ok && j) {
                    setProfileUser(j)
                }
            })

            // Fetch Published Generations
            setLoading(true)
            const viewerParam = currentUser?.id ? `&viewer_id=${currentUser.id}` : ''
            fetch(`/api/user/generations?user_id=${userId}&limit=6&offset=0&published_only=true${viewerParam}`).then(async r => {
                const j = await r.json().catch(() => null)
                if (r.ok && j) {
                    setItems(j.items || [])
                    setTotal(j.total)
                }
                setLoading(false)
            })
        }
    }, [userId, currentUser?.id])

    const handleRemix = (item: FeedItem) => {
        impact('medium')

        // Parse metadata from prompt
        let cleanPrompt = item.prompt
        let metadata: Record<string, string> = {}

        const match = item.prompt.match(/\s*\[(.*?)\]\s*$/)
        if (match) {
            const metaString = match[1]
            cleanPrompt = item.prompt.replace(match[0], '').trim()

            metaString.split(';').forEach(part => {
                const [key, val] = part.split('=').map(s => s.trim())
                if (key && val) metadata[key] = val
            })
        }

        setPrompt(cleanPrompt)

        if (item.model) {
            const modelMap: Record<string, ModelType> = {
                'nanobanana': 'nanobanana',
                'nanobanana-pro': 'nanobanana-pro',
                'seedream4': 'seedream4',
                'seedream4-5': 'seedream4-5',
                'seedream4.5': 'seedream4-5',
                'qwen-edit': 'seedream4-5'
            }
            if (modelMap[item.model]) {
                setSelectedModel(modelMap[item.model])
            }
        }

        if (metadata.ratio) {
            const validRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '16:21', 'Auto', 'square_hd', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9']
            if (validRatios.includes(metadata.ratio)) {
                setAspectRatio(metadata.ratio as any)
            }
        }

        if (metadata.type) {
            if (metadata.type === 'text_photo') {
                setGenerationMode('image')
            } else {
                setGenerationMode('text')
            }
        }

        if (item.input_images && item.input_images.length > 0) {
            setUploadedImages(item.input_images)
            setGenerationMode('image')
        } else {
            setUploadedImages([])
        }

        setParentGeneration(item.id, item.author.username)
        setCurrentScreen('form')
        navigate('/studio')
    }

    const handleLike = async (item: FeedItem) => {
        // Optimistic update in list
        setItems(prev => prev.map(i => {
            if (i.id === item.id) {
                return { ...i, is_liked: !i.is_liked, likes_count: i.is_liked ? i.likes_count - 1 : i.likes_count + 1 }
            }
            return i
        }))

        // Also update selected item if open
        if (selectedItem?.id === item.id) {
            setSelectedItem(prev => prev ? { ...prev, is_liked: !prev.is_liked, likes_count: prev.is_liked ? prev.likes_count - 1 : prev.likes_count + 1 } : null)
        }

        try {
            const res = await fetch('/api/feed/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generationId: item.id, userId: currentUser?.id })
            })
            if (!res.ok) throw new Error('Failed to like')
        } catch (e) {
            // Revert logic omitted
        }
    }

    const displayName = (profileUser?.first_name && profileUser?.last_name)
        ? `${profileUser.first_name} ${profileUser.last_name}`
        : (profileUser?.first_name || profileUser?.username || 'User')

    const username = profileUser?.username ? `@${profileUser.username}` : '—'
    const avatarSeed = profileUser?.username || String(userId || 'guest')
    const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`
    const avatarSrc = profileUser?.avatar_url || avatarUrl

    const stats = [
        { label: 'Генерации', value: typeof total === 'number' ? total : items.length },
        { label: 'Лайки', value: profileUser?.likes_count || 0 },
        { label: 'Ремиксы', value: profileUser?.remix_count || 0 },
    ]

    const paddingTop = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 5px)' : 'calc(env(safe-area-inset-top) + 50px)'

    return (
        <div className="min-h-dvh bg-black safe-bottom-tabbar" style={{ paddingTop }}>
            <div className="mx-auto max-w-3xl px-4 py-4 space-y-6">

                <div
                    className="relative overflow-hidden rounded-[2rem] bg-zinc-900/90 border border-white/5 p-5 shadow-2xl mt-12 transition-all duration-500"
                    style={profileUser?.cover_url ? {
                        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${profileUser.cover_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    } : {}}
                >
                    {/* Close Button for Desktop/Web */}
                    {platform !== 'ios' && platform !== 'android' && (
                        <button
                            onClick={() => navigate(-1)}
                            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    )}
                    {/* Background Effects (only if no cover) */}
                    {!profileUser?.cover_url && (
                        <>
                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-violet-600/20 rounded-full blur-[80px] pointer-events-none" />
                            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] pointer-events-none" />
                        </>
                    )}

                    <div className="relative z-10 flex flex-col items-center text-center">
                        {/* Avatar */}
                        <div className="relative mb-3">
                            <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 shadow-xl shadow-violet-500/20">
                                <div className="w-full h-full rounded-full bg-black overflow-hidden relative">
                                    <img
                                        src={avatarSrc}
                                        alt={displayName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = avatarUrl }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Name & Username */}
                        <h1 className="text-xl font-bold text-white mb-0.5 tracking-tight">{displayName}</h1>
                        <p className="text-zinc-400 font-medium text-sm mb-4">{username}</p>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-2 w-full mb-4">
                            {stats.map(s => (
                                <div key={s.label} className="bg-black/10 backdrop-blur-xl rounded-xl p-2 border border-white/10 flex flex-col items-center justify-center gap-0.5 shadow-xl">
                                    <span className="text-lg font-bold text-white shadow-black/80 drop-shadow-lg">{s.value}</span>
                                    <span className="text-[9px] uppercase tracking-wider text-zinc-100 font-bold shadow-black/80 drop-shadow-md">{s.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-4 px-1">
                        <div className="text-lg font-bold text-white">Публичные генерации</div>
                    </div>
                    {loading && items.length === 0 ? (
                        <FeedSkeletonGrid viewMode="standard" />
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-600 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800"><HistoryIcon size={32} className="mb-3 opacity-20" /><p className="text-sm font-medium">Нет публичных работ</p></div>
                    ) : (
                        <>
                            <div className="flex gap-4 items-start">
                                <div className="flex-1 min-w-0 space-y-4">
                                    {items.filter((_, i) => i % 2 === 0).map(item => (
                                        <FeedImage key={item.id} item={item} priority={true} handleRemix={handleRemix} onClick={setSelectedItem} />
                                    ))}
                                </div>
                                <div className="flex-1 min-w-0 space-y-4">
                                    {items.filter((_, i) => i % 2 !== 0).map(item => (
                                        <FeedImage key={item.id} item={item} priority={true} handleRemix={handleRemix} onClick={setSelectedItem} />
                                    ))}
                                </div>
                            </div>

                            {items.length > 0 && (
                                <div className="mt-4 flex justify-center pb-20">
                                    <button onClick={async () => { if (loading || !userId) return; setLoading(true); const viewerParam = currentUser?.id ? `&viewer_id=${currentUser.id}` : ''; try { const r = await fetch(`/api/user/generations?user_id=${userId}&limit=6&offset=${offset + 6}&published_only=true${viewerParam}`); const j = await r.json().catch(() => null); if (r.ok && j) { setItems([...items, ...j.items]); setOffset(offset + 6); setTotal(j.total) } } finally { setLoading(false); impact('light') } }} className="text-xs text-violet-400 bg-violet-500/5 border border-violet-500/10 hover:bg-violet-500/10 px-4 py-2 rounded-lg">Загрузить ещё</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {selectedItem && (
                <FeedDetailModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onRemix={(item) => { setSelectedItem(null); handleRemix(item) }}
                    onLike={handleLike}
                />
            )}
        </div>
    )
}
