import { X, Heart, Repeat, Download, Share2, Sparkles, Maximize2, Trophy, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useState, useEffect } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface FeedItem {
    id: number
    image_url: string | null
    video_url?: string | null
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
    media_type?: 'image' | 'video' | null
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
    // Optional navigation between generations
    onPrevGeneration?: () => void
    onNextGeneration?: () => void
    canGoPrev?: boolean
    canGoNext?: boolean
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
        case 'seedance-1.5-pro': return 'Seedance Pro'
        default: return model
    }
}

export function FeedDetailModal({ item, onClose, onRemix, onLike, onPrevGeneration, onNextGeneration, canGoPrev, canGoNext }: Props) {
    const { t, i18n } = useTranslation()
    const { impact } = useHaptics()
    const { user, platform } = useTelegram()
    const [isLikeAnimating, setIsLikeAnimating] = useState(false)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [imageIndex, setImageIndex] = useState(0)
    const navigate = useNavigate()

    // Get all images (original + variants)
    const allImages = item.edit_variants && item.edit_variants.length > 0
        ? [item.image_url, ...item.edit_variants]
        : [item.image_url]
    const hasVariants = allImages.length > 1
    const currentImage = allImages[imageIndex] || item.image_url

    // Prevent body scroll when modal is open
    useEffect(() => {
        const scrollY = window.scrollY
        document.body.style.position = 'fixed'
        document.body.style.top = `-${scrollY}px`
        document.body.style.width = '100%'
        document.body.style.overflow = 'hidden'

        return () => {
            document.body.style.position = ''
            document.body.style.top = ''
            document.body.style.width = ''
            document.body.style.overflow = ''
            window.scrollTo(0, scrollY)
        }
    }, [])

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
    const date = new Date(item.created_at).toLocaleDateString(i18n.language, {
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
            className={`fixed inset-0 z-[100] bg-black flex ${isMobile9_16 ? 'items-end' : 'items-center'} justify-center animate-in fade-in duration-200`}
            style={{
                top: 0, left: 0, right: 0, bottom: 0, margin: 0,
                padding: isMobile9_16 ? '0 16px 30px 16px' : '0 16px'
            }}
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

                {/* Main Media - Video or Image */}
                <div className="relative flex items-center justify-center rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl border border-white/5 group">
                    {item.media_type === 'video' && item.video_url ? (
                        <video
                            src={item.video_url}
                            controls
                            loop
                            playsInline
                            className="max-w-full max-h-[65dvh] object-contain"
                        />
                    ) : (
                        <img
                            src={currentImage}
                            alt={item.prompt}
                            className="max-w-full max-h-[65dvh] object-contain"
                        />
                    )}

                    {/* Navigation between generations (if provided) */}
                    {onPrevGeneration && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onPrevGeneration()
                            }}
                            disabled={canGoPrev === false}
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    {onNextGeneration && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onNextGeneration()
                            }}
                            disabled={canGoNext === false}
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={24} />
                        </button>
                    )}

                    {/* Variant switcher (bottom center) - only if has variants */}
                    {hasVariants && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 py-1.5 px-2 bg-black/50 backdrop-blur-md rounded-lg border border-white/10">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    impact('light')
                                    setImageIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1)
                                }}
                                className="w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="text-xs text-white/80 min-w-[28px] text-center font-medium">
                                {imageIndex + 1}/{allImages.length}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    impact('light')
                                    setImageIndex(prev => prev === allImages.length - 1 ? 0 : prev + 1)
                                }}
                                className="w-5 h-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95 transition-all"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    )}

                    {/* Fallback: Old carousel navigation for when generation nav is not provided */}
                    {hasVariants && !onPrevGeneration && !onNextGeneration && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    impact('light')
                                    setImageIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1)
                                }}
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md border border-white/10"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    impact('light')
                                    setImageIndex(prev => prev === allImages.length - 1 ? 0 : prev + 1)
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white backdrop-blur-md border border-white/10"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </>
                    )}
                    {item.media_type !== 'video' && (
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
                    )}
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
                                        <span className="text-[10px] text-zinc-500 font-medium ml-1">{t('feed.participatingInContest')}</span>
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
                            <span>{t('feed.remix')}</span>
                        </button>
                    </div>
                </div>
            </div >

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
                                    src={currentImage}
                                    alt="Fullscreen"
                                    className="max-w-full max-h-full object-contain"
                                />
                            </TransformComponent>
                        </TransformWrapper>
                    </div>
                </div>
            )
            }
        </div >
    )
}
