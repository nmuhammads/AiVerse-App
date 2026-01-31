import { Share2, History as HistoryIcon, X, UserPlus, UserMinus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { FeedImage, type FeedItem } from '@/components/FeedImage'
import { FeedDetailModal } from '@/components/FeedDetailModal'
import { useGenerationStore, type ModelType } from '@/store/generationStore'
import { FeedSkeletonGrid } from '@/components/ui/skeleton'

export default function PublicProfile() {
    const { t } = useTranslation()
    const { userId } = useParams()
    const navigate = useNavigate()
    const { impact, notify } = useHaptics()
    const { user: currentUser, platform, tg } = useTelegram()

    const [profileUser, setProfileUser] = useState<any>(null)
    const [items, setItems] = useState<FeedItem[]>([])
    const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null)
    const [currentGenerationIndex, setCurrentGenerationIndex] = useState<number | null>(null)
    const [total, setTotal] = useState<number | undefined>(undefined)
    const [offset, setOffset] = useState(0)
    const [loading, setLoading] = useState(false)
    const [isFollowing, setIsFollowing] = useState(false)
    const [isFollowLoading, setIsFollowLoading] = useState(false)

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
        setUploadedImages,
        setMediaType
    } = useGenerationStore()

    useEffect(() => {
        if (userId) {
            // Fetch User Info with follow status
            const viewerParam = currentUser?.id ? `?viewer_id=${currentUser.id}` : ''
            fetch(`/api/user/info/${userId}${viewerParam}`).then(async r => {
                const j = await r.json().catch(() => null)
                if (r.ok && j) {
                    setProfileUser(j)
                    setIsFollowing(j.is_following || false)
                }
            })

            // Fetch Published Generations
            setLoading(true)
            const viewerParamGen = currentUser?.id ? `&viewer_id=${currentUser.id}` : ''
            fetch(`/api/user/generations?user_id=${userId}&limit=6&offset=0&published_only=true${viewerParamGen}`).then(async r => {
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
        const metadata: Record<string, string> = {}

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
                'qwen-edit': 'seedream4-5',
                'gptimage1.5': 'gpt-image-1.5'
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

        // Load input images if present
        if (item.input_images && item.input_images.length > 0) {
            setUploadedImages(item.input_images)
            setGenerationMode('image')
        } else {
            setUploadedImages([])
        }

        // Set media type based on item
        if (item.media_type === 'video') {
            setMediaType('video')
            // Ensure we use the video model
            if (!item.model || item.model === 'seedance-1.5-pro') {
                setSelectedModel('seedance-1.5-pro')
            }
        } else {
            setMediaType('image')
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

    const handleFollowToggle = async () => {
        if (!currentUser?.id || !userId) return
        impact('medium')
        setIsFollowLoading(true)

        try {
            const res = await fetch('/api/user/follow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ followerId: currentUser.id, followingId: Number(userId) })
            })
            if (res.ok) {
                const data = await res.json()
                setIsFollowing(data.is_following)
            }
        } catch (e) {
            console.error('Failed to toggle follow:', e)
        } finally {
            setIsFollowLoading(false)
        }
    }

    // Navigation between generations
    const goToPrevGeneration = () => {
        if (currentGenerationIndex === null || currentGenerationIndex <= 0) return
        impact('light')
        const newIndex = currentGenerationIndex - 1
        const newItem = items[newIndex]
        if (!newItem) return
        setCurrentGenerationIndex(newIndex)
        setSelectedItem(newItem)
    }

    const goToNextGeneration = async () => {
        if (currentGenerationIndex === null) return

        // If at the last item and there are more to load, fetch next batch
        if (currentGenerationIndex >= items.length - 1) {
            if (total !== undefined && items.length < total && userId) {
                impact('light')
                const viewerParam = currentUser?.id ? `&viewer_id=${currentUser.id}` : ''
                try {
                    const r = await fetch(`/api/user/generations?user_id=${userId}&limit=6&offset=${offset + 6}&published_only=true${viewerParam}`)
                    const j = await r.json().catch(() => null)
                    if (r.ok && j && j.items && j.items.length > 0) {
                        const newItems = [...items, ...j.items]
                        setItems(newItems)
                        setOffset(offset + 6)
                        setTotal(j.total)

                        const newIndex = currentGenerationIndex + 1
                        if (newIndex < newItems.length) {
                            setCurrentGenerationIndex(newIndex)
                            setSelectedItem(newItems[newIndex])
                        }
                    }
                } catch {
                    // Ignore errors
                }
            }
            return
        }

        impact('light')
        const newIndex = currentGenerationIndex + 1
        const newItem = items[newIndex]
        if (!newItem) return
        setCurrentGenerationIndex(newIndex)
        setSelectedItem(newItem)
    }

    const handleSelectItem = (item: FeedItem) => {
        const index = items.findIndex(i => i.id === item.id)
        setCurrentGenerationIndex(index)
        setSelectedItem(item)
    }

    const displayName = (profileUser?.first_name && profileUser?.last_name)
        ? `${profileUser.first_name} ${profileUser.last_name}`
        : (profileUser?.first_name || profileUser?.username || 'User')

    const username = profileUser?.username ? `@${profileUser.username}` : '—'
    const avatarSeed = profileUser?.username || String(userId || 'guest')
    const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`
    const avatarSrc = profileUser?.avatar_url || avatarUrl

    const stats = [
        { label: t('publicProfile.stats.generations'), value: typeof total === 'number' ? total : items.length },
        { label: t('publicProfile.stats.followers'), value: profileUser?.followers_count || 0 },
        { label: t('publicProfile.stats.likes'), value: profileUser?.likes_count || 0 },
        { label: t('publicProfile.stats.remixes'), value: profileUser?.remix_count || 0 },
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
                        <div className="grid grid-cols-4 gap-2 w-full mb-4">
                            {stats.map(s => (
                                <div key={s.label} className="bg-black/10 backdrop-blur-xl rounded-xl p-2 border border-white/10 flex flex-col items-center justify-center gap-0.5 shadow-xl">
                                    <span className="text-lg font-bold text-white shadow-black/80 drop-shadow-lg">{s.value}</span>
                                    <span className="text-[9px] uppercase tracking-wider text-zinc-100 font-bold shadow-black/80 drop-shadow-md">{s.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Follow Button (only show if not own profile) */}
                        {currentUser?.id && Number(userId) !== currentUser.id && (
                            <button
                                onClick={handleFollowToggle}
                                disabled={isFollowLoading}
                                className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${isFollowing
                                    ? 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
                                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500'
                                    } ${isFollowLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isFollowing ? (
                                    <><UserMinus size={16} /> {t('publicProfile.unfollow')}</>
                                ) : (
                                    <><UserPlus size={16} /> {t('publicProfile.follow')}</>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-4 px-1">
                        <div className="text-lg font-bold text-white">{t('publicProfile.publicGenerations')}</div>
                    </div>
                    {loading && items.length === 0 ? (
                        <FeedSkeletonGrid viewMode="standard" />
                    ) : items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-600 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800"><HistoryIcon size={32} className="mb-3 opacity-20" /><p className="text-sm font-medium">{t('publicProfile.empty')}</p></div>
                    ) : (
                        <>
                            <div className="flex gap-4 items-start">
                                <div className="flex-1 min-w-0 space-y-4">
                                    {items.filter((_, i) => i % 2 === 0).map(item => (
                                        <FeedImage key={item.id} item={item} priority={true} handleRemix={handleRemix} onClick={handleSelectItem} />
                                    ))}
                                </div>
                                <div className="flex-1 min-w-0 space-y-4">
                                    {items.filter((_, i) => i % 2 !== 0).map(item => (
                                        <FeedImage key={item.id} item={item} priority={true} handleRemix={handleRemix} onClick={handleSelectItem} />
                                    ))}
                                </div>
                            </div>

                            {items.length > 0 && (
                                <div className="mt-4 flex justify-center pb-20">
                                    <button onClick={async () => { if (loading || !userId) return; setLoading(true); const viewerParam = currentUser?.id ? `&viewer_id=${currentUser.id}` : ''; try { const r = await fetch(`/api/user/generations?user_id=${userId}&limit=6&offset=${offset + 6}&published_only=true${viewerParam}`); const j = await r.json().catch(() => null); if (r.ok && j) { setItems([...items, ...j.items]); setOffset(offset + 6); setTotal(j.total) } } finally { setLoading(false); impact('light') } }} className="text-xs text-violet-400 bg-violet-500/5 border border-violet-500/10 hover:bg-violet-500/10 px-4 py-2 rounded-lg">{t('publicProfile.loadMore')}</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {selectedItem && (
                <FeedDetailModal
                    item={selectedItem}
                    onClose={() => { setSelectedItem(null); setCurrentGenerationIndex(null) }}
                    onRemix={(item) => { setSelectedItem(null); setCurrentGenerationIndex(null); handleRemix(item) }}
                    onLike={handleLike}
                    onPrevGeneration={goToPrevGeneration}
                    onNextGeneration={goToNextGeneration}
                    canGoPrev={currentGenerationIndex !== null && currentGenerationIndex > 0}
                    canGoNext={currentGenerationIndex !== null && (currentGenerationIndex < items.length - 1 || (total !== undefined && items.length < total))}
                />
            )}
        </div>
    )
}
