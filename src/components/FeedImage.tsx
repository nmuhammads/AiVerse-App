import React, { useState, useEffect } from 'react'
import { Heart, Repeat, Trophy } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useNavigate } from 'react-router-dom'

export interface FeedItem {
    id: number
    image_url: string
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
        case 'qwen-edit': return 'Qwen Edit'
        case 'flux': return 'Flux'
        default: return model
    }
}

export const FeedImage = ({ item, priority = false, handleRemix, onClick, onLike, showRemix = true }: { item: FeedItem; priority?: boolean; handleRemix: (item: FeedItem) => void; onClick: (item: FeedItem) => void; onLike?: (id: number, isLiked: boolean) => void; showRemix?: boolean }) => {
    const [loaded, setLoaded] = useState(false)
    const { impact } = useHaptics()
    const { user } = useTelegram()
    const navigate = useNavigate()
    const [isLiked, setIsLiked] = useState(item.is_liked)
    const [likesCount, setLikesCount] = useState(item.likes_count)
    const [isLikeAnimating, setIsLikeAnimating] = useState(false)

    useEffect(() => {
        setIsLiked(item.is_liked)
        setLikesCount(item.likes_count)
    }, [item.is_liked, item.likes_count])

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
                <div className="aspect-auto w-full relative">
                    {!loaded && (
                        <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
                    )}
                    <img
                        src={item.image_url}
                        alt={item.prompt}
                        loading={priority ? "eager" : "lazy"}
                        className={`w-full h-auto block transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                        onLoad={() => setLoaded(true)}
                    />
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
                        <div className="flex items-center gap-2">
                            {showRemix && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemix(item)
                                    }}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                    <Repeat size={14} />
                                    {item.remix_count > 0 && <span className="text-xs font-medium">{item.remix_count}</span>}
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleLike()
                                }}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors ${isLiked ? 'bg-pink-500/20 text-pink-500' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
                            >
                                <Heart
                                    size={14}
                                    className={`transition-transform ${isLikeAnimating ? 'scale-125' : 'scale-100'} ${isLiked ? 'fill-current' : ''}`}
                                />
                                <span className="text-xs font-medium">{likesCount}</span>
                            </button>
                        </div>
                    </div>
                    <div className="text-xs font-medium text-zinc-300 truncate" onClick={handleProfileClick}>{item.author.username}</div>

                </div>
            </div>
        </div>
    )
}
