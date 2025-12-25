import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, Pencil, Loader2, Zap, Download, Grid, Upload, ChevronLeft, Paintbrush } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'
import { PaymentModal } from '@/components/PaymentModal'
import { GenerationSelector } from '@/components/GenerationSelector'
import { InpaintCanvas } from '@/components/InpaintCanvas'
import { compressImage } from '@/utils/imageCompression'

const EDITOR_PRICE = 2

export default function ImageEditorPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const { user, saveToGallery, platform, tg } = useTelegram()
    const { impact, notify } = useHaptics()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const isMobile = platform === 'ios' || platform === 'android'

    const [sourceImage, setSourceImage] = useState<string | null>(null)
    const [sourceGenerationId, setSourceGenerationId] = useState<number | null>(null)
    const [prompt, setPrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [result, setResult] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [balance, setBalance] = useState<number | null>(null)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [showBalancePopup, setShowBalancePopup] = useState(false)
    const [showGenerationSelector, setShowGenerationSelector] = useState(false)
    const [mode, setMode] = useState<'edit' | 'inpaint'>('edit')
    const [maskImage, setMaskImage] = useState<string | null>(null)
    const [showMaskEditor, setShowMaskEditor] = useState(false)

    // Загрузка изображения из URL параметра
    useEffect(() => {
        const imageUrl = searchParams.get('image')
        const genId = searchParams.get('generation_id')
        if (imageUrl) {
            setSourceImage(decodeURIComponent(imageUrl))
        }
        if (genId) {
            setSourceGenerationId(Number(genId))
        }
    }, [searchParams])

    // Загрузка баланса
    useEffect(() => {
        if (user?.id) {
            fetch(`/api/user/info/${user.id}`)
                .then(r => r.json())
                .then(j => {
                    if (j?.balance != null) setBalance(j.balance)
                })
        }
    }, [user?.id, showPaymentModal, isGenerating])

    // BackButton для мобилок
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
                tg.BackButton.hide()
                tg.BackButton.offClick(handleBack)
            }
        }
    }, [isMobile, navigate, tg, location, impact])

    const getPaddingTop = () => {
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 10px)'
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 50px)'
        return '50px'
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const compressed = await compressImage(file)
            setSourceImage(compressed)
            setSourceGenerationId(null) // Сброс ID т.к. это загрузка с телефона
            impact('light')
        } catch (err) {
            console.error('Compression error:', err)
        }
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleSelectGeneration = async (generationId: number) => {
        try {
            const res = await fetch(`/api/generation/${generationId}`)
            const data = await res.json()
            if (data?.image_url) {
                setSourceImage(data.image_url)
                setSourceGenerationId(generationId)
                impact('light')
            }
        } catch (err) {
            console.error('Failed to load generation:', err)
        }
    }

    const handleGenerate = async () => {
        if (!sourceImage || !prompt.trim()) {
            setError(t('editor.error.required'))
            notify('error')
            return
        }

        setIsGenerating(true)
        setError(null)
        impact('heavy')

        try {
            // Prepare images array: [source] or [source, mask] for inpaint
            const imagesArray = mode === 'inpaint' && maskImage
                ? [sourceImage, maskImage]
                : [sourceImage]

            const res = await fetch('/api/editor/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    images: imagesArray,
                    user_id: user?.id || null,
                    source_generation_id: sourceGenerationId,
                    mode: mode
                })
            })

            if (res.status === 403) {
                setShowBalancePopup(true)
                notify('error')
                setIsGenerating(false)
                return
            }

            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Editor failed')

            setResult(data.image)
            notify('success')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error')
            notify('error')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleUseResult = () => {
        if (result) {
            setSourceImage(result)
            setSourceGenerationId(null) // Новый результат, сбросить ID
            setResult(null)
            setPrompt('')
        }
    }

    // Экран результата
    if (result) {
        return (
            <div className="min-h-dvh bg-black flex flex-col justify-center px-4 pb-24" style={{ paddingTop: getPaddingTop() }}>
                <Card className="bg-zinc-900/90 border-white/10 max-w-xl mx-auto w-full">
                    <CardHeader className="relative">
                        <button
                            onClick={() => setResult(null)}
                            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                        <CardTitle className="text-white">{t('editor.result')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg overflow-hidden bg-black/20">
                            <img
                                src={result}
                                alt="result"
                                className="w-full max-h-[50vh] object-contain"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => saveToGallery(result, `edit-${Date.now()}.jpg`)}
                                className="flex-1 bg-white text-black hover:bg-zinc-200"
                            >
                                <Download size={16} className="mr-2" />
                                {t('editor.save')}
                            </Button>
                            <Button
                                onClick={handleUseResult}
                                className="flex-1 bg-cyan-600 text-white hover:bg-cyan-700"
                            >
                                <Pencil size={16} className="mr-2" />
                                {t('editor.continue')}
                            </Button>
                        </div>
                        <Button
                            onClick={() => { setResult(null); navigate(-1) }}
                            variant="outline"
                            className="w-full border-white/20 bg-zinc-800 text-white hover:bg-zinc-700"
                        >
                            {t('editor.close')}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-dvh bg-black text-white pb-32" style={{ paddingTop: getPaddingTop() }}>
            {/* Header */}
            <div className="px-4 py-4 flex items-center gap-4">
                {!isMobile && (
                    <button
                        onClick={() => { impact('light'); navigate(-1) }}
                        className="w-10 h-10 rounded-xl bg-zinc-900/50 border border-white/10 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}
                <h1 className={`text-xl font-bold flex-1 ${isMobile ? 'ml-1' : ''}`}>{t('editor.title')}</h1>
                <button
                    onClick={() => setShowPaymentModal(true)}
                    className="px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 flex items-center gap-1.5"
                >
                    <Zap size={14} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-bold text-white">{balance ?? '...'}</span>
                </button>
            </div>

            {/* Content */}
            <div className="px-4 max-w-xl mx-auto w-full flex flex-col gap-5">

                {/* Source Image */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        {t('editor.image')}
                    </label>
                    {sourceImage ? (
                        <div className="space-y-3">
                            <div className="relative rounded-xl overflow-hidden border border-white/10">
                                <img
                                    src={sourceImage}
                                    alt="source"
                                    className="w-full max-h-[35vh] object-contain bg-zinc-900"
                                />
                                {/* Mask overlay preview */}
                                {maskImage && mode === 'inpaint' && (
                                    <div className="absolute inset-0 pointer-events-none">
                                        <img
                                            src={maskImage}
                                            alt="mask"
                                            className="w-full h-full object-contain mix-blend-multiply opacity-50"
                                        />
                                    </div>
                                )}
                                <button
                                    onClick={() => { setSourceImage(null); setSourceGenerationId(null); setMaskImage(null) }}
                                    className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80"
                                >
                                    <X size={16} />
                                </button>
                                {sourceGenerationId && (
                                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-violet-500/80 rounded text-[10px] text-white font-medium">
                                        {t('editor.fromGenerations')}
                                    </div>
                                )}
                            </div>

                            {/* Mode Toggle */}
                            <div className="flex items-center gap-2">
                                <div className="flex bg-zinc-800/50 rounded-full p-0.5 border border-white/5 flex-1">
                                    <button
                                        onClick={() => { setMode('edit'); setMaskImage(null); impact('light') }}
                                        className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${mode === 'edit'
                                            ? 'bg-violet-600 text-white'
                                            : 'text-zinc-400 hover:text-white'
                                            }`}
                                    >
                                        <Pencil size={14} />
                                        {t('editor.mode.edit')}
                                    </button>
                                    <button
                                        disabled
                                        className="flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 text-zinc-600 cursor-not-allowed opacity-50"
                                    >
                                        <Paintbrush size={14} />
                                        {t('editor.mode.inpaint')}
                                        <span className="text-[10px] bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-400">
                                            {t('common.soon', 'Скоро')}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Draw Mask Button (Inpaint mode) */}
                            {mode === 'inpaint' && (
                                <button
                                    onClick={() => setShowMaskEditor(true)}
                                    className={`w-full py-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors ${maskImage
                                        ? 'border-green-500/50 bg-green-500/10 text-green-400'
                                        : 'border-violet-500/30 bg-violet-500/5 text-violet-400 hover:border-violet-500/50'
                                        }`}
                                >
                                    <Paintbrush size={18} />
                                    <span className="font-medium">
                                        {maskImage ? '✓ ' : ''}{t('editor.drawMask')}
                                    </span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="py-8 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center gap-2 text-zinc-500 hover:border-cyan-500/30 hover:text-cyan-400 transition-colors"
                            >
                                <Upload size={24} />
                                <span className="text-xs">{t('editor.upload')}</span>
                            </button>
                            <button
                                onClick={() => setShowGenerationSelector(true)}
                                className="py-8 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center gap-2 text-zinc-500 hover:border-violet-500/30 hover:text-violet-400 transition-colors"
                            >
                                <Grid size={24} />
                                <span className="text-xs">{t('editor.myWorks')}</span>
                            </button>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                    />
                </div>

                {/* Prompt */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        {t('editor.instruction')}
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={t('editor.instructionPlaceholder')}
                        className="w-full min-h-[100px] p-4 rounded-xl bg-zinc-900/50 border border-white/10 text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
                    />
                </div>

                {/* Hints */}
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-200 text-xs">
                    <p className="font-medium mb-1.5">💡 {t('editor.hints.title')}</p>
                    <ul className="list-disc list-inside space-y-0.5 text-cyan-300/80">
                        <li>{t('editor.hints.1')}</li>
                        <li>{t('editor.hints.2')}</li>
                        <li>{t('editor.hints.3')}</li>
                    </ul>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Generate Button */}
                <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !sourceImage || !prompt.trim()}
                    className="w-full py-6 rounded-2xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 size={20} className="mr-2 animate-spin" />
                            {t('editor.generating')}
                        </>
                    ) : (
                        <>
                            <Pencil size={20} className="mr-2" />
                            {t('editor.generate')}
                            <span className="ml-2 bg-black/20 px-2 py-0.5 rounded text-xs">
                                {EDITOR_PRICE} {t('editor.tokens')}
                            </span>
                        </>
                    )}
                </Button>
            </div>


            {/* Modals */}
            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
            />

            <GenerationSelector
                isOpen={showGenerationSelector}
                onClose={() => setShowGenerationSelector(false)}
                onSelect={handleSelectGeneration}
            />

            {/* Balance Popup */}
            {showBalancePopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80">
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full animate-in zoom-in-95 fade-in duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">
                            {t('editor.insufficientBalance')}
                        </h3>
                        <p className="text-zinc-400 text-sm mb-4">
                            {t('editor.needTokens', { count: EDITOR_PRICE })}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => setShowBalancePopup(false)}
                                variant="outline"
                                className="flex-1 border-white/20 bg-zinc-800 text-white hover:bg-zinc-700"
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                onClick={() => { setShowBalancePopup(false); setShowPaymentModal(true) }}
                                className="flex-1 bg-violet-600 hover:bg-violet-500"
                            >
                                {t('common.topUp')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Inpaint Canvas Modal */}
            {showMaskEditor && sourceImage && (
                <InpaintCanvas
                    imageUrl={sourceImage}
                    onMaskGenerated={(mask) => {
                        setMaskImage(mask)
                        setShowMaskEditor(false)
                    }}
                    onClose={() => setShowMaskEditor(false)}
                />
            )}
        </div>
    )
}
