import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
    Sparkles, Loader2, Zap, Image as ImageIcon, Type, X, Send,
    Download as DownloadIcon, Clipboard, Layers, ChevronDown, ChevronUp,
    AlertCircle
} from 'lucide-react'
import { useMultiGenerationStore, SUPPORTED_RATIOS, type ModelConfig } from '@/store/multiGenerationStore'
import { type ModelType, type AspectRatio, type GptImageQuality } from '@/store/generationStore'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'
import { PaymentModal } from '@/components/PaymentModal'
import { compressImage } from '@/utils/imageCompression'

// Модели для изображений (без видео)
const IMAGE_MODELS: { id: ModelType; name: string; desc: string; color: string; icon: string }[] = [
    { id: 'nanobanana', name: 'NanoBanana', desc: '3 токена', color: 'from-yellow-400 to-orange-500', icon: '/models/optimized/nanobanana.png' },
    { id: 'nanobanana-pro', name: 'NanoBanana Pro', desc: '15 токенов', color: 'from-pink-500 to-rose-500', icon: '/models/optimized/nanobanana-pro.png' },
    { id: 'seedream4', name: 'Seedream 4', desc: '4 токена', color: 'from-purple-400 to-fuchsia-500', icon: '/models/optimized/seedream.png' },
    { id: 'seedream4-5', name: 'Seedream 4.5', desc: '7 токенов', color: 'from-blue-400 to-indigo-500', icon: '/models/optimized/seedream-4-5.png' },
    { id: 'gpt-image-1.5', name: 'GPT image 1.5', desc: 'от 5 токенов', color: 'from-cyan-400 to-blue-500', icon: '/models/optimized/gpt-image.png' },
]

const RATIO_EMOJIS: Record<AspectRatio, string> = {
    'Auto': '✨',
    '1:1': '🟧',
    '16:9': '🖥️',
    '9:16': '📱',
    '4:3': '📺',
    '3:4': '📕',
    '21:9': '🎬',
    '16:21': '📜',
    '2:3': '📷',
    '3:2': '🖼️',
    'square_hd': '🟧',
    'portrait_4_3': '📕',
    'portrait_16_9': '📱',
    'landscape_4_3': '📺',
    'landscape_16_9': '🖥️'
}

export default function MultiGeneration() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user, platform, saveToGallery, tg } = useTelegram()
    const isMobile = platform === 'ios' || platform === 'android'
    const { impact, notify } = useHaptics()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const {
        selectedModels,
        prompt,
        uploadedImages,
        generationMode,
        isGenerating,
        toggleModel,
        isModelSelected,
        updateModelConfig,
        setPrompt,
        addUploadedImage,
        removeUploadedImage,
        setGenerationMode,
        startGeneration,
        setModelResult,
        calculateTotalCost,
        getModelPrice,
        reset,
        resetResults,
    } = useMultiGenerationStore()

    const [balance, setBalance] = useState<number | null>(null)
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [showBalancePopup, setShowBalancePopup] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [expandedModels, setExpandedModels] = useState<Set<ModelType>>(new Set())

    // BackButton для мобилок
    useEffect(() => {
        if (isMobile) {
            tg.BackButton.show()
            const handleBack = () => {
                impact('light')
                navigate('/studio')
            }
            tg.BackButton.onClick(handleBack)
            return () => {
                tg.BackButton.hide()
                tg.BackButton.offClick(handleBack)
            }
        }
    }, [isMobile, navigate, tg, impact])

    // Загрузить баланс
    useEffect(() => {
        if (user?.id) {
            fetch(`/api/user/info/${user.id}`).then(async r => {
                const j = await r.json().catch(() => null)
                if (r.ok && j && typeof j.balance === 'number') setBalance(j.balance)
            })
        }
    }, [user?.id, isPaymentModalOpen, isGenerating])

    // Обработка загрузки изображений
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        const maxImages = 8
        if (uploadedImages.length + files.length > maxImages) {
            setError(t('studio.upload.limitError', { limit: maxImages }))
            notify('error')
            return
        }

        for (const file of Array.from(files)) {
            try {
                const compressed = await compressImage(file)
                addUploadedImage(compressed)
                impact('light')
            } catch (err) {
                console.error('Compression failed', err)
                const reader = new FileReader()
                reader.readAsDataURL(file)
                reader.onload = (ev) => {
                    if (ev.target?.result) addUploadedImage(ev.target.result as string)
                }
            }
        }

        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // Обработка paste
    const processPastedFiles = async (files: FileList | File[]) => {
        const maxImages = 8
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue
            if (uploadedImages.length >= maxImages) {
                setError(t('studio.upload.limitError', { limit: maxImages }))
                notify('error')
                break
            }
            try {
                const compressed = await compressImage(file)
                addUploadedImage(compressed)
                impact('light')
                notify('success')
            } catch (err) {
                console.error('Compression failed', err)
            }
        }
    }

    // Генерация
    const handleGenerate = async () => {
        if (selectedModels.length === 0) {
            setError(t('multiGeneration.noModelsSelected'))
            notify('error')
            return
        }

        if (!prompt.trim()) {
            setError(t('studio.errors.promptRequired'))
            notify('error')
            return
        }

        if (generationMode === 'image' && uploadedImages.length === 0) {
            setError(t('studio.errors.imageRequired'))
            notify('error')
            return
        }

        setError(null)
        startGeneration()
        impact('heavy')

        try {
            const requestBody = {
                prompt,
                models: selectedModels.map(m => ({
                    model: m.modelId,
                    aspect_ratio: m.aspectRatio,
                    resolution: m.resolution,
                    gpt_image_quality: m.gptImageQuality,
                })),
                images: generationMode === 'image' ? uploadedImages : [],
                user_id: user?.id || null,
            }

            const res = await fetch('/api/generation/generate/multi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            })

            if (res.status === 403) {
                setShowBalancePopup(true)
                notify('error')
                resetResults()
                return
            }

            const data = await res.json()

            if (!res.ok) {
                setError(data.error || t('studio.errors.generationError'))
                notify('error')
                resetResults()
                return
            }

            // Начинаем поллинг результатов
            const generationIds: number[] = data.generation_ids || []
            pollResults(generationIds)

        } catch (err) {
            console.error('Multi-generation error:', err)
            setError(t('studio.errors.generationError'))
            notify('error')
            resetResults()
        }
    }

    // Поллинг результатов
    const pollResults = async (generationIds: number[]) => {
        const pollInterval = 3000
        const maxPolls = 120 // 6 минут максимум

        // Создаём карту genId -> modelId из текущего состояния
        const genIdToModelId = new Map<number, ModelType>()
        const currentModels = useMultiGenerationStore.getState().selectedModels
        for (let i = 0; i < generationIds.length; i++) {
            if (currentModels[i]) {
                genIdToModelId.set(generationIds[i], currentModels[i].modelId)
            }
        }

        // Отслеживаем какие генерации ещё ожидают результатов
        const pendingGenIds = new Set(generationIds.filter(id => id > 0))

        for (let poll = 0; poll < maxPolls; poll++) {
            if (pendingGenIds.size === 0) break

            // Проверяем статус каждой ожидающей генерации
            for (const genId of Array.from(pendingGenIds)) {
                const modelId = genIdToModelId.get(genId)
                if (!modelId) continue

                try {
                    const res = await fetch(`/api/generation/${genId}`)
                    if (!res.ok) continue

                    const data = await res.json()

                    if (data.status === 'completed' && data.image_url) {
                        setModelResult(modelId, data.image_url, null, genId)
                        pendingGenIds.delete(genId)
                        notify('success')
                    } else if (data.status === 'failed') {
                        setModelResult(modelId, null, data.error_message || 'Generation failed', genId)
                        pendingGenIds.delete(genId)
                        notify('error')
                    }
                    // Если pending — оставляем в pendingGenIds
                } catch (err) {
                    console.error('[MultiGen] Poll error for genId', genId, err)
                    // Игнорируем ошибки поллинга, пробуем снова
                }
            }

            if (pendingGenIds.size === 0) break
            await new Promise(r => setTimeout(r, pollInterval))
        }

        // Если после всех попыток остались pending — пометить как ошибку (timeout)
        for (const genId of Array.from(pendingGenIds)) {
            const modelId = genIdToModelId.get(genId)
            if (modelId) {
                setModelResult(modelId, null, 'Generation timeout', genId)
            }
        }
    }

    // Переключить раскрытие модели
    const toggleExpanded = (modelId: ModelType) => {
        setExpandedModels(prev => {
            const next = new Set(prev)
            if (next.has(modelId)) {
                next.delete(modelId)
            } else {
                next.add(modelId)
            }
            return next
        })
    }

    // Получить данные модели
    const getModelInfo = (modelId: ModelType) => {
        return IMAGE_MODELS.find(m => m.id === modelId)
    }

    const totalCost = calculateTotalCost()
    const paddingTop = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 5px)' : 'calc(env(safe-area-inset-top) + 50px)'
    const maxImages = 8

    return (
        <div className="min-h-dvh bg-black pb-32 flex flex-col" style={{ paddingTop }}>
            <div className="mx-auto max-w-3xl w-full px-4 py-4 flex-1 flex flex-col gap-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/studio')}
                            className="p-2 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                            {t('multiGeneration.title')}
                        </h1>
                    </div>
                    <button
                        onClick={() => { impact('light'); setIsPaymentModalOpen(true) }}
                        className="px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 flex items-center gap-1.5 active:scale-95 transition-transform"
                    >
                        <Zap size={14} className="text-yellow-500 fill-yellow-500" />
                        {balance === null ? (
                            <div className="h-4 w-8 bg-zinc-700 rounded animate-pulse" />
                        ) : (
                            <span className="text-xs font-bold text-white">{balance}</span>
                        )}
                    </button>
                </div>

                {/* 1. Селектор моделей */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                            {t('multiGeneration.selectModels')}
                        </span>
                        <span className="text-xs text-zinc-400">
                            {selectedModels.length}/3
                        </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                        {IMAGE_MODELS.map(m => {
                            const isSelected = isModelSelected(m.id)
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => {
                                        const success = toggleModel(m.id)
                                        if (!success) {
                                            setError(t('multiGeneration.limitReached'))
                                            notify('warning')
                                        } else {
                                            impact('light')
                                            // Раскрыть модель при добавлении
                                            if (!isSelected) {
                                                setExpandedModels(prev => new Set([...prev, m.id]))
                                            }
                                        }
                                    }}
                                    className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl transition-all duration-200 ${isSelected
                                        ? `bg-gradient-to-b ${m.color} shadow-lg ring-2 ring-white/20`
                                        : 'bg-zinc-900/40 hover:bg-zinc-800/60'
                                        }`}
                                >
                                    <div className={`w-9 h-9 rounded-lg overflow-hidden shadow-md transition-transform duration-200 ${isSelected ? 'scale-105' : ''}`}>
                                        <img src={m.icon} alt={m.name} className="w-full h-full object-cover" />
                                    </div>
                                    <span className={`text-[8px] font-semibold text-center leading-tight ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                                        {m.name}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 2. Режим T2I / I2I */}
                <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
                    <button
                        onClick={() => { setGenerationMode('text'); impact('light') }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${generationMode === 'text'
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <Type size={14} />
                        <span>{t('studio.mode.textToImage')}</span>
                    </button>
                    <button
                        onClick={() => { setGenerationMode('image'); impact('light') }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${generationMode === 'image'
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <ImageIcon size={14} />
                        <span>{t('studio.mode.imageToImage')}</span>
                    </button>
                </div>

                {/* 3. Блоки выбранных моделей */}
                {selectedModels.length > 0 && (
                    <div className="space-y-3">
                        {selectedModels.map((modelConfig, index) => (
                            <ModelBlock
                                key={modelConfig.modelId}
                                modelConfig={modelConfig}
                                modelInfo={getModelInfo(modelConfig.modelId)!}
                                isExpanded={expandedModels.has(modelConfig.modelId)}
                                onToggleExpand={() => toggleExpanded(modelConfig.modelId)}
                                onUpdateConfig={(config) => updateModelConfig(modelConfig.modelId, config)}
                                onRemove={() => { toggleModel(modelConfig.modelId); impact('light') }}
                                getModelPrice={getModelPrice}
                                saveToGallery={saveToGallery}
                            />
                        ))}
                    </div>
                )}

                {/* 4. Промпт */}
                {/* 4. Промпт */}
                <div className="prompt-container group relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t('studio.prompt.placeholder')}
                        className="prompt-input min-h-[100px] bg-zinc-900/30 backdrop-blur-sm no-scrollbar text-white placeholder:text-zinc-500 focus:outline-none resize-none"
                    />
                    {prompt && (
                        <button
                            onClick={() => setPrompt('')}
                            className="absolute top-3 right-3 p-1.5 bg-zinc-800/50 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors z-10"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* 5. Референсы (для I2I режима) */}
                {generationMode === 'image' && (
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-4 bg-zinc-900/20">
                        {uploadedImages.length > 0 ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-4 gap-2">
                                    {uploadedImages.map((img, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group">
                                            <img src={img} alt={`uploaded-${idx}`} className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => removeUploadedImage(idx)}
                                                className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {uploadedImages.length < maxImages && (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full py-2 px-3 rounded-lg border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors text-xs"
                                    >
                                        <ImageIcon size={14} />
                                        <span>{t('studio.upload.more')}</span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="py-2 text-center">
                                    <div className="w-10 h-10 mx-auto bg-zinc-800 rounded-full flex items-center justify-center mb-2 text-zinc-400">
                                        <ImageIcon size={20} />
                                    </div>
                                    <div className="text-xs font-medium text-zinc-300">{t('studio.upload.addReferences', { limit: maxImages })}</div>
                                </div>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-2.5 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors active:scale-95"
                                >
                                    <ImageIcon size={16} />
                                    <span className="text-xs font-medium">{t('studio.upload.selectPhoto')}</span>
                                </button>
                                <div
                                    contentEditable
                                    suppressContentEditableWarning
                                    onPaste={async (e) => {
                                        e.preventDefault()
                                        const items = e.clipboardData?.items
                                        if (!items) return
                                        const files: File[] = []
                                        for (const item of Array.from(items)) {
                                            if (item.type.startsWith('image/')) {
                                                const file = item.getAsFile()
                                                if (file) files.push(file)
                                            }
                                        }
                                        if (files.length > 0) await processPastedFiles(files)
                                        e.currentTarget.innerHTML = ''
                                    }}
                                    onInput={(e) => { e.currentTarget.innerHTML = '' }}
                                    className="w-full py-3 px-3 rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 flex items-center justify-center gap-2 text-violet-300 text-xs font-medium cursor-text focus:outline-none focus:border-violet-500/50"
                                >
                                    <Clipboard size={16} />
                                    <span>{t('studio.upload.pasteHint')}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm animate-in fade-in">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* 6. Кнопка генерации */}
                <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || selectedModels.length === 0 || !prompt.trim()}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-base rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 size={18} className="mr-2 animate-spin" />
                            {t('multiGeneration.generating')}
                        </>
                    ) : (
                        <>
                            <Sparkles size={18} className="mr-2" />
                            {t('multiGeneration.generate')} ({totalCost} {t('multiGeneration.tokens')})
                        </>
                    )}
                </Button>

            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
            />

            {/* Payment Modal */}
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
            />

            {/* Balance Popup */}
            {showBalancePopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 mx-4 max-w-sm w-full animate-in zoom-in-95">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
                                <Zap size={32} className="text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-white">{t('studio.insufficientBalance')}</h3>
                            <p className="text-sm text-zinc-400">{t('studio.topUpBalance')}</p>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowBalancePopup(false)}
                                    className="flex-1 border-white/10"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    onClick={() => { setShowBalancePopup(false); setIsPaymentModalOpen(true) }}
                                    className="flex-1 bg-purple-600 hover:bg-purple-500"
                                >
                                    {t('studio.topUp')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Компонент блока модели
interface ModelBlockProps {
    modelConfig: ModelConfig
    modelInfo: { id: ModelType; name: string; desc: string; color: string; icon: string }
    isExpanded: boolean
    onToggleExpand: () => void
    onUpdateConfig: (config: Partial<ModelConfig>) => void
    onRemove: () => void
    getModelPrice: (modelId: ModelType, gptQuality?: GptImageQuality, resolution?: string) => number
    saveToGallery: (url: string, filename: string) => void
}

function ModelBlock({
    modelConfig,
    modelInfo,
    isExpanded,
    onToggleExpand,
    onUpdateConfig,
    onRemove,
    getModelPrice,
    saveToGallery
}: ModelBlockProps) {
    const { t } = useTranslation()
    const price = getModelPrice(modelConfig.modelId, modelConfig.gptImageQuality, modelConfig.resolution)
    const ratios = SUPPORTED_RATIOS[modelConfig.modelId] || ['1:1']

    return (
        <div className={`bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden transition-all ${modelConfig.status === 'error' ? 'border-red-500/30' : ''
            }`}>
            {/* Header */}
            <button
                onClick={onToggleExpand}
                className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg overflow-hidden shadow-md bg-gradient-to-b ${modelInfo.color}`}>
                        <img src={modelInfo.icon} alt={modelInfo.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-left">
                        <div className="text-sm font-bold text-white">{modelInfo.name}</div>
                        <div className="text-xs text-zinc-400">{price} токенов</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {modelConfig.status === 'generating' && (
                        <Loader2 size={16} className="text-purple-400 animate-spin" />
                    )}
                    {modelConfig.status === 'success' && (
                        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-white text-[10px]">✓</span>
                        </div>
                    )}
                    {modelConfig.status === 'error' && (
                        <AlertCircle size={16} className="text-red-400" />
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove() }}
                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                        <X size={14} />
                    </button>
                    {isExpanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
                </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="px-3 pb-3 space-y-3 animate-in slide-in-from-top-2">
                    {/* Ratio selector */}
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Соотношение сторон</span>
                        <div className="flex flex-wrap gap-1.5">
                            {ratios.map(ratio => (
                                <button
                                    key={ratio}
                                    onClick={() => onUpdateConfig({ aspectRatio: ratio })}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${modelConfig.aspectRatio === ratio
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                >
                                    {RATIO_EMOJIS[ratio]} {ratio}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* NanoBanana Pro: Resolution selector */}
                    {modelConfig.modelId === 'nanobanana-pro' && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Разрешение</span>
                            <div className="flex gap-2">
                                {(['2K', '4K'] as const).map(res => (
                                    <button
                                        key={res}
                                        onClick={() => onUpdateConfig({ resolution: res })}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${modelConfig.resolution === res
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                    >
                                        {res}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* GPT Image 1.5: Quality selector */}
                    {modelConfig.modelId === 'gpt-image-1.5' && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Качество</span>
                            <div className="flex gap-2">
                                {([
                                    { value: 'medium' as const, label: 'Medium', price: 5 },
                                    { value: 'high' as const, label: 'High', price: 15 }
                                ]).map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => onUpdateConfig({ gptImageQuality: opt.value })}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${modelConfig.gptImageQuality === opt.value
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                    >
                                        {opt.label} ({opt.price}🪙)
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Result area */}
                    <div className="min-h-[100px] rounded-lg border border-white/10 bg-black/30 flex items-center justify-center">
                        {modelConfig.status === 'idle' && (
                            <span className="text-xs text-zinc-500">{t('multiGeneration.resultWillAppear')}</span>
                        )}
                        {modelConfig.status === 'generating' && (
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 size={24} className="text-purple-400 animate-spin" />
                                <span className="text-xs text-zinc-400">{t('multiGeneration.generating')}</span>
                            </div>
                        )}
                        {modelConfig.status === 'success' && modelConfig.result && (
                            <div className="w-full">
                                <img
                                    src={modelConfig.result}
                                    alt="result"
                                    className="w-full h-auto rounded-lg"
                                />
                                <div className="flex gap-2 mt-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            if (modelConfig.result) {
                                                saveToGallery(modelConfig.result, `multi-gen-${Date.now()}.jpg`)
                                            }
                                        }}
                                        className="flex-1 text-xs"
                                    >
                                        <DownloadIcon size={12} className="mr-1" />
                                        {t('studio.result.save')}
                                    </Button>
                                </div>
                            </div>
                        )}
                        {modelConfig.status === 'error' && (
                            <div className="flex flex-col items-center gap-2 text-center p-3">
                                <AlertCircle size={24} className="text-red-400" />
                                <span className="text-xs text-red-400">{modelConfig.error || t('multiGeneration.error')}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
