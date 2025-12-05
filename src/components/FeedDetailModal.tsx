import { X, Heart, Repeat, Download, Share2, Sparkles, Maximize2, Trophy } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useState, useEffect } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useNavigate } from 'react-router-dom'

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
    contest?: {
        id: number
        title: string
    } | null
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
    const [isFullScreen, setIsFullScreen] = useState(false)
    const navigate = useNavigate()

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

    const handleProfileClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        impact('light')
        onClose()
        navigate(`/profile/${item.author.id}`)
    }

    const handleContestClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (item.contest) {
            impact('light')
            onClose()
            navigate(`/contests/${item.contest.id}`)
        }
    }

    const modelName = getModelDisplayName(item.model || null)
    const date = new Date(item.created_at).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })

    // Check for 9:16 ratio in metadata using regex for robustness
    const is9_16 = /ratio\s*=\s*9:16/.test(item.prompt) || /portrait_16_9/.test(item.prompt)

    // Check for mobile platforms (iOS or Android)
    const isMobile = platform === 'ios' || platform === 'android'
    const isMobile9_16 = is9_16 && isMobile

    return (
        <div
            className={`fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex ${isMobile9_16 ? 'items-start pt-24' : 'items-center'} justify-center p-4 animate-in fade-in duration-200`}
            onClick={onClose}
        >
            <div
                className={`w-full max-w-2xl flex flex-col gap-4 transition-transform ${is9_16 && !isMobile9_16 ? 'translate-y-8' : ''}`}
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
                <div className="relative flex items-center justify-center rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl border border-white/5 group">
                    <img
                        src={item.image_url}
                        alt={item.prompt}
                        className="max-w-full max-h-[65dvh] object-contain"
                    />
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            impact('light')
                            setIsFullScreen(true)
                        }}
                        className={`absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-opacity ${platform === 'ios' || platform === 'android'
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                            }`}
                    >
                        <Maximize2 size={20} />
                    </button>
                </div>

                {/* Footer */}
                <div className="space-y-4 px-1">

                    {/* User & Date */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={handleProfileClick}>
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
                                    <div className="text-white font-semibold text-sm">{item.author.username}</div>
                                    <div className="text-zinc-500 text-xs">{date}</div>
                                </div>
                            </div>

                            {item.contest && (
                                <>
                                    <div className="w-px h-8 bg-white/10 mx-1"></div>
                                    <div
                                        className="flex flex-col gap-0.5 cursor-pointer group"
                                        onClick={handleContestClick}
                                    >
                                        <span className="text-[10px] text-zinc-500 font-medium ml-1">Участвует в конкурсе</span>
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 group-hover:bg-yellow-500/20 transition-colors">
                                            <Trophy size={14} />
                                            <span className="text-xs font-medium max-w-[120px] truncate">{item.contest.title}</span>
                                        </div>
                                    </div>
                                </>
                            )}
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

            {isFullScreen && (
                <div className="fixed inset-0 z-[200] bg-black flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className={`absolute top-0 right-0 z-50 p-4 ${platform === 'android' ? 'pt-[calc(5rem+env(safe-area-inset-top))]' : 'pt-[calc(3rem+env(safe-area-inset-top))]'}`}>
                        <button
                            onClick={() => setIsFullScreen(false)}
                            className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md border border-white/10"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div className="w-full h-full flex items-center justify-center overflow-hidden">
                        <TransformWrapper
                            initialScale={1}
                            minScale={1}
                            maxScale={4}
                            centerOnInit
                            alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
                        >
                            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img
                                    src={item.image_url}
                                    alt="Fullscreen"
                                    className="max-w-full max-h-full object-contain"
                                />
                            </TransformComponent>
                        </TransformWrapper>
                    </div>
                </div>
            )}
        </div>
    )
}
