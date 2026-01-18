import { useState, useRef } from 'react'
import { X, Upload, Loader2, ImageIcon, Sparkles, Clipboard, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHaptics } from '@/hooks/useHaptics'
import { toast } from 'sonner'
import { compressImage } from '@/utils/imageCompression'

interface DescribeImageModalProps {
    isOpen: boolean
    onClose: () => void
    onPromptGenerated: (prompt: string) => void
}

type ModelVersion = 'v1' | 'v2'

export function DescribeImageModal({ isOpen, onClose, onPromptGenerated }: DescribeImageModalProps) {
    const { t } = useTranslation()
    const { impact, notify } = useHaptics()
    const [image, setImage] = useState<string | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [modelVersion, setModelVersion] = useState<ModelVersion>('v1')
    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!isOpen) return null

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            impact('light')
            const compressed = await compressImage(file)
            setImage(compressed)
        } catch (error) {
            console.error('Compression failed:', error)
            // Fallback to raw base64
            const reader = new FileReader()
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setImage(ev.target.result as string)
                }
            }
            reader.readAsDataURL(file)
        }

        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handlePaste = async () => {
        try {
            if (navigator.clipboard && navigator.clipboard.read) {
                const items = await navigator.clipboard.read()
                for (const item of items) {
                    const imageType = item.types.find(type => type.startsWith('image/'))
                    if (imageType) {
                        const blob = await item.getType(imageType)
                        const compressed = await compressImage(new File([blob], 'pasted.png', { type: imageType }))
                        setImage(compressed)
                        impact('light')
                        return
                    }
                }
            }
            toast.error(t('studio.promptHelper.noImageInClipboard'))
        } catch (error) {
            console.error('Paste failed:', error)
            toast.error(t('studio.promptHelper.pasteError'))
        }
    }

    const handleGeneratePrompt = async () => {
        if (!image) return

        setIsGenerating(true)
        impact('medium')

        try {
            const response = await fetch('/api/prompt/describe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image, version: modelVersion })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate prompt')
            }

            if (data.prompt) {
                onPromptGenerated(data.prompt)
                toast.success(t('studio.promptHelper.describeSuccess'))
                notify('success')
                onClose()
                setImage(null)
            } else {
                throw new Error('No prompt returned')
            }
        } catch (error) {
            console.error('Describe error:', error)
            notify('error')
            toast.error(error instanceof Error ? error.message : t('studio.promptHelper.error'))
        } finally {
            setIsGenerating(false)
        }
    }

    const handleClose = () => {
        setImage(null)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-5 pb-3 flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <ImageIcon size={20} className="text-violet-400" />
                            {t('studio.promptHelper.describeTitle')}
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">{t('studio.promptHelper.describeSubtitle')}</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 pb-5">
                    {/* Model Version Selector */}
                    <div className="mb-4">
                        <div className="flex p-1 bg-zinc-800/50 rounded-xl border border-white/5">
                            <button
                                onClick={() => { impact('light'); setModelVersion('v1') }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${modelVersion === 'v1'
                                    ? 'bg-violet-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-300'
                                    }`}
                            >
                                V1
                            </button>
                            <button
                                onClick={() => { impact('light'); setModelVersion('v2') }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${modelVersion === 'v2'
                                    ? 'bg-violet-600 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-300'
                                    }`}
                            >
                                V2
                            </button>
                        </div>

                        {/* Model Description */}
                        <div className="mt-2 p-2.5 bg-zinc-800/30 rounded-lg border border-white/5">
                            <div className="flex items-start gap-2">
                                <Info size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-zinc-400 leading-relaxed">
                                    {modelVersion === 'v1'
                                        ? t('studio.promptHelper.v1Description')
                                        : t('studio.promptHelper.v2Description')
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Image Preview or Upload Zone */}
                    {image ? (
                        <div className="relative rounded-xl overflow-hidden mb-4">
                            <img
                                src={image}
                                alt="Preview"
                                className="w-full max-h-48 object-contain bg-zinc-800"
                            />
                            <button
                                onClick={() => setImage(null)}
                                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-zinc-700 hover:border-violet-500/50 rounded-xl p-6 mb-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
                        >
                            <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center">
                                <Upload size={20} className="text-violet-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-zinc-300 font-medium">{t('studio.promptHelper.uploadImage')}</p>
                                <p className="text-xs text-zinc-500 mt-1">{t('studio.promptHelper.uploadHint')}</p>
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Actions */}
                    <div className="space-y-2">
                        {!image && (
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onPaste={async (e) => {
                                    e.preventDefault()
                                    const items = e.clipboardData?.items
                                    if (!items) return

                                    for (const item of Array.from(items)) {
                                        if (item.type.startsWith('image/')) {
                                            const file = item.getAsFile()
                                            if (file) {
                                                try {
                                                    impact('light')
                                                    const compressed = await compressImage(file)
                                                    setImage(compressed)
                                                } catch (error) {
                                                    console.error('Compression failed:', error)
                                                    const reader = new FileReader()
                                                    reader.onload = (ev) => {
                                                        if (ev.target?.result) {
                                                            setImage(ev.target.result as string)
                                                        }
                                                    }
                                                    reader.readAsDataURL(file)
                                                }
                                                break
                                            }
                                        }
                                    }

                                    e.currentTarget.innerHTML = ''
                                }}
                                onInput={(e) => {
                                    e.currentTarget.innerHTML = ''
                                }}
                                className="w-full py-3 px-3 rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 flex items-center justify-center gap-2 text-violet-300 text-xs font-medium cursor-text select-none focus:outline-none focus:border-violet-500/50 focus:bg-violet-500/10"
                                style={{ minHeight: '44px', WebkitUserSelect: 'none' }}
                            >
                                <Clipboard size={16} />
                                <span>{t('studio.upload.pasteHint')}</span>
                            </div>
                        )}

                        <button
                            onClick={handleGeneratePrompt}
                            disabled={!image || isGenerating}
                            className={`w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm ${image && !isGenerating
                                ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-900/30'
                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                }`}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    {t('studio.promptHelper.describing')}
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    {t('studio.promptHelper.generatePrompt')}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
