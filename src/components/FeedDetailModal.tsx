import { X, Heart, Repeat, Download, Share2, Sparkles } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useState, useEffect } from 'react'

interface FeedItem {
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
}

interface Props {
    item: FeedItem
    onClose: () => void
    onRemix: (item: FeedItem) => void
    onLike: (item: FeedItem) => void
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

export function FeedDetailModal({ item, onClose, onRemix, onLike }: Props) {
    const { impact } = useHaptics()
    const { user, platform } = useTelegram()
    const [isLikeAnimating, setIsLikeAnimating] = useState(false)

    // Close on escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [onClose])

    const handleLikeClick = () => {
        impact('light')
        setIsLikeAnimating(true)
        onLike(item)
        setTimeout(() => setIsLikeAnimating(false), 300)
    }

    const modelName = getModelDisplayName(item.model || null)
    const date = new Date(item.created_at).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl flex flex-col gap-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        {modelName && (
                            <div className="bg-zinc-800 text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5">
                                <Sparkles size={12} className="text-violet-400" />
                                {modelName}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => { impact('light'); onClose() }}
                        className="w-9 h-9 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-white/10 active:scale-95 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Main Image */}
                <div className="relative flex items-center justify-center rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl border border-white/5">
                    <img
                        src={item.image_url}
                        alt={item.prompt}
                        className="max-w-full max-h-[65dvh] object-contain"
                    />
                </div>

                {/* Footer */}
                <div className="space-y-4 px-1">

                    {/* User & Date */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden">
                                {item.author.avatar_url ? (
                                    <img src={item.author.avatar_url} alt={item.author.username} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold">
                                        {item.author.username[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="text-white font-semibold text-sm">@{item.author.username}</div>
                                <div className="text-zinc-500 text-xs">{date}</div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleLikeClick}
                            className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 border ${item.is_liked
                                    ? 'bg-pink-500/20 text-pink-500 border-pink-500/20'
                                    : 'bg-zinc-900 text-white border-white/10 hover:bg-zinc-800'
                                }`}
                        >
                            <Heart
                                size={20}
                                className={`transition-transform duration-300 ${isLikeAnimating ? 'scale-150' : 'scale-100'} ${item.is_liked ? 'fill-current' : ''}`}
                            />
                            <span>{item.likes_count}</span>
                        </button>

                        <button
                            onClick={() => { impact('medium'); onRemix(item) }}
                            className="flex-1 h-12 rounded-xl bg-violet-600 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-violet-700 border border-violet-500"
                        >
                            <Repeat size={20} />
                            <span>Повторить</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
