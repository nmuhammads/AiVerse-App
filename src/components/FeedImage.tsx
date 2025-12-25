import React, { useState, useEffect } from 'react'
import { Heart, Repeat, Trophy, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useNavigate } from 'react-router-dom'
import { useCloudflareProxy } from '@/contexts/CloudflareProxyContext'

export interface FeedItem {
    id: number
    image_url: string
    compressed_url?: string | null
    prompt: string
    created_at: string
    author: {
        id: number
        username: string
        first_name?: string
        avatar_url: string
    }
    likes_count: number
    remix_count: number
    input_images?: string[]
    is_liked: boolean
    model?: string | null
    edit_variants?: string[] | null
    is_contest_entry?: boolean
    contest?: {
        id: number
        title: string
    } | null
}

function getModelDisplayName(model: string | null): string {
    if (!model) return ''
    switch (model) {
        case 'nanobanana': return 'NanoBanana'
        case 'nanobanana-pro': return 'NanoBanana Pro'
        case 'seedream4': return 'Seedream 4'
        case 'seedream4-5': return 'Seedream 4.5'
        case 'seedream4.5': return 'Seedream 4.5'
        case 'qwen-edit': return 'Qwen Edit'
        case 'flux': return 'Flux'
        case 'p-image-edit': return 'Editor'
        default: return model
    }
}

export const FeedImage = ({ item, priority = false, handleRemix, onClick, onLike, showRemix = true, isCompact = false }: { item: FeedItem; priority?: boolean; handleRemix: (item: FeedItem) => void; onClick: (item: FeedItem) => void; onLike?: (id: number, isLiked: boolean) => void; showRemix?: boolean; isCompact?: boolean }) => {
    const { t } = useTranslation()
    const [loaded, setLoaded] = useState(false)
    const { impact } = useHaptics()
    const { user } = useTelegram()
    const navigate = useNavigate()
    const { getImageUrl, needsProxy } = useCloudflareProxy()
    const [isLiked, setIsLiked] = useState(item.is_liked)
    const [likesCount, setLikesCount] = useState(item.likes_count)
    const [isLikeAnimating, setIsLikeAnimating] = useState(false)
    const [imgSrc, setImgSrc] = useState(getImageUrl(item.compressed_url || item.image_url))
    const [hasError, setHasError] = useState(false)
    const [triedProxy, setTriedProxy] = useState(false)

    const imgRef = React.useRef<HTMLImageElement>(null)

    useEffect(() => {
        setIsLiked(item.is_liked)
        setLikesCount(item.likes_count)
    }, [item.is_liked, item.likes_count])

    useEffect(() => {
        setImgSrc(getImageUrl(item.compressed_url || item.image_url))
        setHasError(false)
        setLoaded(false)
        setTriedProxy(false)
    }, [item.compressed_url, item.image_url, getImageUrl])

    // Check for cached images
    useEffect(() => {
        if (imgRef.current && imgRef.current.complete) {
            setLoaded(true)
        }
    }, [imgSrc])

    const handleImageError = () => {
        console.warn('Image load error for:', imgSrc)
        if (!hasError && item.compressed_url && imgSrc !== getImageUrl(item.image_url)) {
            // First failure (thumbnail): try original
            console.log('Falling back to original:', item.image_url)
            setImgSrc(getImageUrl(item.image_url))
        } else if (!triedProxy && !needsProxy) {
            // If direct access failed and we haven't tried proxy yet, try proxy
            console.log('Trying proxy fallback for:', item.image_url)
            setTriedProxy(true)
            const proxyUrl = `/api/proxy/image?url=${encodeURIComponent(item.compressed_url || item.image_url)}`
            setImgSrc(proxyUrl)
        } else {
            console.error('All image load attempts failed')
            setHasError(true)
        }
    }

    const handleLike = async () => {
        console.log('handleLike called', { userId: user?.id, itemId: item.id })
        if (!user?.id) {
            console.warn('User not logged in, cannot like')
            return
        }
        impact('light')

        if (onLike) {
            onLike(item.id, isLiked)
            return
        }

        // Optimistic update
        const newLiked = !isLiked
        setIsLiked(newLiked)
        setLikesCount(prev => newLiked ? prev + 1 : prev - 1)
        setIsLikeAnimating(true)
        setTimeout(() => setIsLikeAnimating(false), 300)

        try {
            console.log('Sending like request...')
            const res = await fetch('/api/feed/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generationId: item.id, userId: user.id })
            })
            console.log('Like response:', res.status)
            if (!res.ok) throw new Error('Failed to like')
        } catch (e) {
            console.error('Like error:', e)
            // Revert on error
            setIsLiked(!newLiked)
            setLikesCount(prev => !newLiked ? prev + 1 : prev - 1)
        }
    }

    const handleProfileClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        impact('light')
        navigate(`/profile/${item.author.id}`)
    }

    const modelName = getModelDisplayName(item.model || null)

    return (
        <div className="mb-4 break-inside-avoid" onClick={() => onClick(item)}>
            <div className="relative rounded-xl overflow-hidden bg-zinc-900 shadow-sm border border-white/5">
                <div className="aspect-auto w-full relative" style={{ minHeight: loaded ? undefined : '200px' }}>
                    {!loaded && !hasError && (
                        <div
                            className="absolute inset-0 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%]"
                            style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
                        />
                    )}
                    {hasError ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-white/40 text-xs" style={{ minHeight: '200px' }}>
                            {t('feed.imageUnavailable')}
                        </div>
                    ) : (
                        <img
                            ref={imgRef}
                            src={imgSrc}
                            alt={item.prompt}
                            loading={priority ? "eager" : "lazy"}
                            className={`w-full h-auto block transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                            onLoad={() => {
                                // console.log('Image loaded:', imgSrc)
                                setLoaded(true)
                            }}
                            onError={handleImageError}
                        />
                    )}
                    {modelName && (
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md border border-white/10 font-medium">
                            {modelName}
                        </div>
                    )}
                    {item.is_contest_entry && (
                        <div className="absolute top-2 right-2 bg-yellow-500/20 backdrop-blur-md text-yellow-500 p-1.5 rounded-full border border-yellow-500/30">
                            <Trophy size={12} />
                        </div>
                    )}
                    {/* Edit variants indicator */}
                    {!item.is_contest_entry && item.edit_variants && item.edit_variants.length > 0 && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500/80 backdrop-blur-md flex items-center justify-center border border-violet-400/30">
                            <Pencil size={12} className="text-white" />
                        </div>
                    )}
                </div>

                <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2" onClick={handleProfileClick}>
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
                                {item.author.avatar_url ? (
                                    <img src={item.author.avatar_url} alt={item.author.username} className="w-full h-full object-cover" />
                                ) : (
                                    item.author.username[0].toUpperCase()
                                )}
                            </div>
                        </div>
                        <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2'}`}>
                            {showRemix && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemix(item)
                                    }}
                                    className={`flex items-center ${isCompact ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'} rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors`}
                                >
                                    <Repeat size={isCompact ? 12 : 14} />
                                    {item.remix_count > 0 && <span className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-medium`}>{item.remix_count}</span>}
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleLike()
                                }}
                                className={`flex items-center ${isCompact ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'} rounded-full transition-colors ${isLiked ? 'bg-pink-500/20 text-pink-500' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
                            >
                                <Heart
                                    size={isCompact ? 12 : 14}
                                    className={`transition-transform ${isLikeAnimating ? 'scale-125' : 'scale-100'} ${isLiked ? 'fill-current' : ''}`}
                                />
                                <span className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-medium`}>{likesCount}</span>
                            </button>
                        </div>
                    </div>
                    <div className="text-xs font-medium text-zinc-300 truncate" onClick={handleProfileClick}>{item.author.username}</div>

                </div>
            </div>
        </div>
    )
}
