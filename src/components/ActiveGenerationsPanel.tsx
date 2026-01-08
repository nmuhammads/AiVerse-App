import { useEffect, useState } from 'react'
import { Loader2, X, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useActiveGenerationsStore, type ActiveGeneration } from '@/store/activeGenerationsStore'
import { useHaptics } from '@/hooks/useHaptics'

// Model icons mapping
const MODEL_ICONS: Record<string, string> = {
    nanobanana: '/models/optimized/nanobanana.png',
    'nanobanana-pro': '/models/optimized/nanobanana-pro.png',
    seedream4: '/models/optimized/seedream.png',
    'seedream4-5': '/models/optimized/seedream-4-5.png',
    'gpt-image-1.5': '/models/optimized/gpt-image.png',
    'seedance-1.5-pro': '/models/optimized/seedream.png',
}

function formatElapsed(startedAt: number): string {
    const seconds = Math.floor((Date.now() - startedAt) / 1000)
    if (seconds < 60) return `${seconds}с`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}м ${secs}с`
}

interface GenerationCardProps {
    generation: ActiveGeneration
    onViewResult: (gen: ActiveGeneration) => void
    onRemove: (id: string) => void
}

function GenerationCard({ generation, onViewResult, onRemove }: GenerationCardProps) {
    const { t } = useTranslation()
    const { impact } = useHaptics()
    const [elapsed, setElapsed] = useState(formatElapsed(generation.startedAt))

    // Update elapsed time every second for processing items
    useEffect(() => {
        if (generation.status !== 'processing') return
        const interval = setInterval(() => {
            setElapsed(formatElapsed(generation.startedAt))
        }, 1000)
        return () => clearInterval(interval)
    }, [generation.status, generation.startedAt])

    const handleClick = () => {
        impact('light')
        if (generation.status === 'completed') {
            onViewResult(generation)
        }
    }

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation()
        impact('light')
        onRemove(generation.id)
    }

    return (
        <div
            onClick={handleClick}
            className={`flex-shrink-0 w-[180px] p-3 rounded-xl border backdrop-blur-md transition-all ${generation.status === 'completed'
                ? 'bg-emerald-500/10 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20'
                : generation.status === 'error'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-zinc-800/50 border-white/10'
                }`}
        >
            <div className="flex items-start gap-2">
                {/* Model Icon */}
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-700">
                    <img
                        src={MODEL_ICONS[generation.model] || MODEL_ICONS.nanobanana}
                        alt={generation.model}
                        className="w-full h-full object-cover"
                    />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Prompt (truncated) */}
                    <p className="text-xs text-white font-medium truncate leading-tight">
                        {generation.prompt || t('activeGenerations.noPrompt')}
                    </p>

                    {/* Status */}
                    <div className="flex items-center gap-1.5 mt-1">
                        {generation.status === 'processing' && (
                            <>
                                <Loader2 size={12} className="text-violet-400 animate-spin" />
                                <span className="text-[10px] text-violet-300">{elapsed}</span>
                                {generation.imageCount > 1 && (
                                    <span className="text-[10px] text-violet-400 font-medium">
                                        ({generation.imageCount}×)
                                    </span>
                                )}
                            </>
                        )}
                        {generation.status === 'completed' && (
                            <>
                                <Check size={12} className="text-emerald-400" />
                                <span className="text-[10px] text-emerald-300">{t('activeGenerations.completed')}</span>
                                <ExternalLink size={10} className="text-emerald-400 ml-auto" />
                            </>
                        )}
                        {generation.status === 'error' && (
                            <>
                                <AlertCircle size={12} className="text-rose-400" />
                                <span className="text-[10px] text-rose-300 truncate">{generation.error || t('activeGenerations.error')}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Remove button (for completed/error) */}
                {generation.status !== 'processing' && (
                    <button
                        onClick={handleRemove}
                        className="p-1 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                    >
                        <X size={12} className="text-zinc-400" />
                    </button>
                )}
            </div>

            {/* Preview thumbnail for completed */}
            {generation.status === 'completed' && (generation.imageUrl || generation.videoUrl) && (
                <div className="mt-2 rounded-lg overflow-hidden h-16 bg-black/20">
                    {generation.mediaType === 'video' && generation.videoUrl ? (
                        <video
                            src={generation.videoUrl}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                        />
                    ) : (
                        <img
                            src={generation.imageUrl}
                            alt="result"
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>
            )}
        </div>
    )
}

interface ActiveGenerationsPanelProps {
    onViewResult: (gen: ActiveGeneration) => void
}

export function ActiveGenerationsPanel({ onViewResult }: ActiveGenerationsPanelProps) {
    const { t } = useTranslation()
    const { generations, removeGeneration, clearCompleted } = useActiveGenerationsStore()
    const { impact } = useHaptics()

    // Only show if there are any generations
    if (generations.length === 0) return null

    const activeCount = generations.filter(g => g.status === 'processing').length
    const completedCount = generations.filter(g => g.status !== 'processing').length

    return (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        {t('activeGenerations.title')}
                    </span>
                    {activeCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold">
                            {activeCount}
                        </span>
                    )}
                </div>
                {completedCount > 0 && (
                    <button
                        onClick={() => { impact('light'); clearCompleted() }}
                        className="text-[10px] text-zinc-500 hover:text-white transition-colors"
                    >
                        {t('activeGenerations.clearCompleted')}
                    </button>
                )}
            </div>

            {/* Cards scroll container */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
                {generations.map((gen) => (
                    <GenerationCard
                        key={gen.id}
                        generation={gen}
                        onViewResult={onViewResult}
                        onRemove={removeGeneration}
                    />
                ))}
            </div>
        </div>
    )
}
