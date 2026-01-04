import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check, Trash2, Sparkles, Zap, Upload } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

// ... existing interfaces ...

interface WatermarkSettings {
    id?: number
    type: 'text' | 'ai_generated' | 'custom'
    text_content: string
    opacity: number
    position: string
    font_color: string
    font_size: number
    image_url?: string
}

const POSITIONS = [
    'top-left', 'top-center', 'top-right',
    'center-left', 'center', 'center-right',
    'bottom-left', 'bottom-center', 'bottom-right'
]

type AIModel = 'nanobanana' | 'gpt-image-1.5'
type EditorMode = 'generator' | 'custom'

const MODELS: { id: AIModel; name: string; price: number }[] = [
    { id: 'nanobanana', name: 'NanoBanana', price: 3 },
    { id: 'gpt-image-1.5', name: 'GPT Image', price: 5 }
]

const POSITION_LABELS: Record<string, string> = {
    'top-left': '↖', 'top-center': '↑', 'top-right': '↗',
    'center-left': '←', 'center': '●', 'center-right': '→',
    'bottom-left': '↙', 'bottom-center': '↓', 'bottom-right': '↘'
}

export default function WatermarkEditor() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { impact } = useHaptics()
    const { user, tg, platform } = useTelegram()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [removingBg, setRemovingBg] = useState(false)
    const [showPositions, setShowPositions] = useState(false)
    const [selectedModel, setSelectedModel] = useState<AIModel>('gpt-image-1.5')
    const [balance, setBalance] = useState<number | null>(null)
    const [editorMode, setEditorMode] = useState<EditorMode>('generator')
    const [showReplaceConfirm, setShowReplaceConfirm] = useState<'generate' | 'upload' | 'removeBg' | null>(null)
    const [pendingUploadData, setPendingUploadData] = useState<string | null>(null)
    // Upload preview modal state
    const [uploadPreview, setUploadPreview] = useState<{ imageData: string; processed: boolean } | null>(null)
    const [settings, setSettings] = useState<WatermarkSettings>({
        type: 'text',
        text_content: '',
        opacity: 0.5,
        position: 'bottom-right',
        font_color: '#FFFFFF',
        font_size: 48,
        image_url: undefined
    })

    const isMobile = platform === 'ios' || platform === 'android'

    const getPaddingTop = () => {
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 10px)'
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 20px)'
        // Desktop needs more padding to avoid Telegram's top bar
        return '60px'
    }

    // Load existing watermark and balance
    useEffect(() => {
        if (user?.id) {
            // Fetch watermark settings
            fetch(`/api/watermarks`, {
                headers: { 'x-user-id': String(user.id) }
            })
                .then(r => r.json())
                .then(data => {
                    if (data && data.id) {
                        setSettings({
                            id: data.id,
                            type: data.type || 'text',
                            text_content: data.text_content || '',
                            opacity: data.opacity ?? 0.5,
                            position: data.position || 'bottom-right',
                            font_color: data.font_color || '#FFFFFF',
                            font_size: data.font_size || 48,
                            image_url: data.image_url
                        })
                    } else {
                        // Default to username
                        setSettings(s => ({ ...s, text_content: user.username || `@${user.id}` }))
                    }
                })
                .catch(console.error)
                .finally(() => setLoading(false))

            // Fetch balance
            fetch(`/api/user/info/${user.id}`)
                .then(r => r.json())
                .then(data => {
                    if (data && typeof data.balance === 'number') {
                        setBalance(data.balance)
                    }
                })
                .catch(console.error)
        }
    }, [user?.id])

    // Back button handling
    useEffect(() => {
        if (isMobile) {
            tg.BackButton.show()
            const handleBack = () => {
                impact('light')
                navigate(-1)
            }
            tg.BackButton.onClick(handleBack)
            return () => {
                tg.BackButton.hide()
                tg.BackButton.offClick(handleBack)
            }
        }
    }, [isMobile, navigate, tg, impact])

    const handleSave = async () => {
        if (!user?.id) return
        impact('medium')
        setSaving(true)

        try {
            const res = await fetch('/api/watermarks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': String(user.id)
                },
                body: JSON.stringify(settings)
            })

            if (res.ok) {
                toast.success(t('watermark.saved'))
            } else {
                toast.error(t('common.error'))
            }
        } catch {
            toast.error(t('common.error'))
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!user?.id || !settings.id) return
        impact('medium')

        try {
            const res = await fetch('/api/watermarks', {
                method: 'DELETE',
                headers: { 'x-user-id': String(user.id) }
            })

            if (res.ok) {
                toast.success(t('watermark.deleted'))
                setSettings({
                    type: 'text',
                    text_content: user.username || `@${user.id}`,
                    opacity: 0.5,
                    position: 'bottom-right',
                    font_color: '#FFFFFF',
                    font_size: 48
                })
            }
        } catch {
            toast.error(t('common.error'))
        }
    }

    // Check if user has existing image watermark
    const hasExistingImageWatermark = settings.image_url && (settings.type === 'ai_generated' || settings.type === 'custom')

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error(t('watermark.invalidFileType') || 'Выберите изображение')
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            const base64 = reader.result as string
            // Show preview modal instead of direct upload
            setUploadPreview({ imageData: base64, processed: false })
        }
        reader.readAsDataURL(file)

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const performUpload = async (imageData: string) => {
        if (!user?.id) return
        impact('medium')
        setUploading(true)

        try {
            const res = await fetch('/api/watermarks/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': String(user.id)
                },
                body: JSON.stringify({ imageData })
            })
            const data = await res.json()

            if (data.ok && data.imageUrl) {
                const timestampedUrl = `${data.imageUrl}?t=${Date.now()}`
                setSettings(s => ({
                    ...s,
                    type: 'custom',
                    image_url: timestampedUrl,
                    opacity: 0.8
                }))
                setUploadPreview(null) // Close modal
                toast.success(t('watermark.uploaded') || '✨ Изображение загружено!')
            } else {
                toast.error(t('common.error'))
            }
        } catch {
            toast.error(t('common.error'))
        } finally {
            setUploading(false)
            setPendingUploadData(null)
        }
    }

    // Remove background in modal (updates preview)
    const handleRemoveBgInModal = async () => {
        if (!user?.id || !uploadPreview) return

        impact('medium')
        setRemovingBg(true)

        try {
            const res = await fetch('/api/watermarks/remove-background', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': String(user.id)
                },
                body: JSON.stringify({ imageData: uploadPreview.imageData })
            })
            const data = await res.json()

            if (data.ok && data.imageUrl) {
                const timestampedUrl = `${data.imageUrl}?t=${Date.now()}`
                // Update preview with the processed image URL directly (with timestamp)
                setUploadPreview({ imageData: timestampedUrl, processed: true })

                // Update balance in UI
                if (typeof data.balance === 'number') {
                    setBalance(data.balance)
                }

                // Also update settings since backend already saved it
                setSettings(s => ({
                    ...s,
                    type: 'custom',
                    image_url: timestampedUrl,
                    opacity: 0.8
                }))

                toast.success(t('watermark.bgRemoved') || '✨ Фон удалён!')
            } else {
                if (data.error === 'insufficient_balance') {
                    toast.error(t('watermark.insufficientBalance'))
                } else {
                    toast.error(t('common.error'))
                }
            }
        } catch {
            toast.error(t('common.error'))
        } finally {
            setRemovingBg(false)
        }
    }

    const handleGenerateAI = async (skipConfirm = false) => {
        if (!user?.id) return

        // Show confirmation if has existing watermark
        if (!skipConfirm && hasExistingImageWatermark) {
            setShowReplaceConfirm('generate')
            return
        }

        impact('heavy')
        setGenerating(true)

        try {
            const res = await fetch('/api/watermarks/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': String(user.id)
                },
                body: JSON.stringify({
                    model: selectedModel,
                    text: settings.text_content // Pass current text input
                })
            })
            const data = await res.json()

            if (data.ok && data.imageUrl) {
                setSettings(s => ({
                    ...s,
                    type: 'ai_generated',
                    image_url: data.imageUrl,
                    // Clear text to avoid confusion? Or keep it?
                    // logic handles display based on type.
                    opacity: 0.8 // Reset opacity for image
                }))
                // Update balance in UI
                if (typeof data.balance === 'number') {
                    setBalance(data.balance)
                }
                toast.success(t('watermark.generated'))
            } else {
                if (data.error === 'insufficient_balance') {
                    toast.error(t('watermark.insufficientBalance'))
                } else {
                    toast.error(t('common.error') + (data.details ? `: ${JSON.stringify(data.details)}` : ''))
                }
            }
        } catch {
            toast.error(t('common.error'))
        } finally {
            setGenerating(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-white pb-44" style={{ paddingTop: getPaddingTop() }}>
            {/* Header */}
            <div className="bg-black/80 backdrop-blur-xl border-b border-white/10">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        {!isMobile && (
                            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/10 rounded-xl">
                                <ChevronLeft size={24} />
                            </button>
                        )}
                        <h1 className="text-lg font-bold">{t('watermark.title')}</h1>
                    </div>

                    {/* Balance display */}
                    <div className="flex items-center">
                        <button
                            onClick={() => impact('light')}
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
                </div>
            </div>

            {/* Mode Tabs */}
            <div className="px-4 py-2 bg-black">
                <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 rounded-xl">
                    <button
                        onClick={() => {
                            impact('light')
                            setEditorMode('generator')
                        }}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${editorMode === 'generator'
                            ? 'bg-white/10 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <Sparkles size={14} />
                        {t('watermark.tabs.generator') || 'Генератор'}
                    </button>
                    <button
                        onClick={() => {
                            impact('light')
                            setEditorMode('custom')
                        }}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${editorMode === 'custom'
                            ? 'bg-white/10 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <Upload size={14} />
                        {t('watermark.tabs.custom') || 'Свой'}
                    </button>
                </div>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Replace Confirmation Dialog */}
            {showReplaceConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full space-y-4">
                        <h3 className="text-lg font-bold text-white">
                            {t('watermark.replaceWarning.title') || '⚠️ Заменить водяной знак?'}
                        </h3>
                        <p className="text-zinc-400 text-sm">
                            {t('watermark.replaceWarning.text') || 'Текущий водяной знак будет удалён навсегда и заменён новым.'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowReplaceConfirm(null)
                                    setPendingUploadData(null)
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-white font-medium"
                            >
                                {t('common.cancel') || 'Отмена'}
                            </button>
                            <button
                                onClick={() => {
                                    if (showReplaceConfirm === 'generate') {
                                        setShowReplaceConfirm(null)
                                        handleGenerateAI(true)
                                    } else if (showReplaceConfirm === 'upload' && pendingUploadData) {
                                        setShowReplaceConfirm(null)
                                        performUpload(pendingUploadData)
                                    }
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium"
                            >
                                {t('watermark.replaceWarning.confirm') || 'Заменить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Preview Modal */}
            {uploadPreview && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full space-y-4">
                        <h3 className="text-lg font-bold text-white text-center">
                            {t('watermark.uploadPreview.title') || 'Превью изображения'}
                        </h3>

                        {/* Image Preview */}
                        <div className="relative aspect-square bg-zinc-800 rounded-xl overflow-hidden flex items-center justify-center">
                            {removingBg ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm text-zinc-400">{t('watermark.removingBg') || 'Удаляю фон...'}</span>
                                </div>
                            ) : (
                                <img
                                    src={uploadPreview.imageData}
                                    alt="Preview"
                                    className="max-w-full max-h-full object-contain"
                                />
                            )}
                            {uploadPreview.processed && !removingBg && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                    ✓ {t('watermark.bgRemovedLabel') || 'Фон удалён'}
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2">
                            {!uploadPreview.processed && (
                                <button
                                    onClick={handleRemoveBgInModal}
                                    disabled={removingBg}
                                    className="w-full py-3 rounded-xl bg-zinc-800 border border-white/10 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95 transition-transform"
                                >
                                    ✂️ {t('watermark.removeBg') || 'Удалить фон'}
                                    <span className="text-xs text-zinc-400">1⚡</span>
                                </button>
                            )}

                            <button
                                onClick={() => {
                                    if (uploadPreview.processed) {
                                        // Already saved by backend when removing bg
                                        setUploadPreview(null)
                                    } else {
                                        performUpload(uploadPreview.imageData)
                                    }
                                }}
                                disabled={uploading || removingBg}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95 transition-transform"
                            >
                                {uploading ? (
                                    <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                ) : (
                                    uploadPreview.processed
                                        ? (t('common.done') || 'Готово')
                                        : (t('watermark.saveAsIs') || 'Сохранить так')
                                )}
                            </button>

                            <button
                                onClick={() => setUploadPreview(null)}
                                disabled={removingBg}
                                className="w-full py-2 text-sm text-zinc-500 hover:text-white transition-colors"
                            >
                                {t('common.cancel') || 'Отмена'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 space-y-6">
                {/* Preview */}
                <div className="relative aspect-square bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 rounded-2xl overflow-hidden border border-white/10">
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
                        {t('watermark.previewPlaceholder') || 'Preview'}
                    </div>
                    {/* Watermark preview */}
                    <div
                        className={`absolute flex items-center justify-center transition-all duration-200 pointer-events-none ${settings.position.includes('top') ? 'top-4' :
                            settings.position.includes('bottom') ? 'bottom-4' : 'top-1/2 -translate-y-1/2'
                            } ${settings.position.includes('left') ? 'left-4' :
                                settings.position.includes('right') ? 'right-4' : 'left-1/2 -translate-x-1/2'
                            }`}
                        style={{
                            opacity: settings.opacity,
                            // Apply width to container if it's an image watermark (ai_generated or custom)
                            ...((settings.type === 'ai_generated' || settings.type === 'custom') && settings.image_url ? {
                                width: `${settings.font_size}%`,
                                maxWidth: '80%'
                            } : {})
                        }}
                    >
                        {/* Show image if type is ai_generated or custom and has image_url */}
                        {(settings.type === 'ai_generated' || settings.type === 'custom') && settings.image_url ? (
                            <img
                                src={settings.image_url}
                                alt="Watermark"
                                className="w-full object-contain drop-shadow-md select-none"
                            />
                        ) : (
                            <span
                                className="font-bold select-none whitespace-nowrap drop-shadow-md"
                                style={{
                                    color: settings.font_color,
                                    fontSize: `${Math.min(settings.font_size / 3, 24)}px`
                                }}
                            >
                                {settings.text_content || user?.username || 'Watermark'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Text Input */}
                <div className="space-y-2">
                    <label className="text-sm text-zinc-400">{t('watermark.textLabel')}</label>
                    <input
                        type="text"
                        value={settings.text_content}
                        onChange={(e) => setSettings(s => ({ ...s, text_content: e.target.value }))}
                        placeholder={t('watermark.textPlaceholder')}
                        className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50"
                    />
                </div>

                {/* Size Slider */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">{t('watermark.size') || 'Размер'}</span>
                        <span className="text-white">{settings.font_size}</span>
                    </div>
                    <input
                        type="range"
                        min="10"
                        max="100"
                        step="1"
                        value={settings.font_size}
                        onChange={(e) => setSettings(s => ({ ...s, font_size: parseInt(e.target.value) }))}
                        className="w-full accent-violet-500"
                    />
                </div>

                {/* Opacity Slider */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">{t('watermark.opacity')}</span>
                        <span className="text-white">{Math.round(settings.opacity * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={settings.opacity}
                        onChange={(e) => setSettings(s => ({ ...s, opacity: parseFloat(e.target.value) }))}
                        className="w-full accent-violet-500"
                    />
                </div>

                {/* Position Grid (Collapsible) */}
                <div className="space-y-2">
                    <button
                        onClick={() => {
                            impact('light')
                            setShowPositions(!showPositions)
                        }}
                        className="flex items-center justify-between w-full text-sm text-zinc-400 p-2 rounded-lg hover:bg-white/5"
                    >
                        <span>{t('watermark.position')}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-white bg-zinc-800 px-2 py-0.5 rounded text-xs">
                                {POSITION_LABELS[settings.position]}
                            </span>
                            <ChevronLeft size={16} className={`transition-transform ${showPositions ? '-rotate-90' : 'rotate-180'}`} />
                        </div>
                    </button>

                    {showPositions && (
                        <div className="grid grid-cols-3 gap-2 w-1/2 mx-auto pt-2 animate-in fade-in slide-in-from-top-2">
                            {POSITIONS.map((pos) => (
                                <button
                                    key={pos}
                                    onClick={() => {
                                        impact('light')
                                        setSettings(s => ({ ...s, position: pos }))
                                        // Optional: close after selection? User might want to try multiple.
                                    }}
                                    className={`aspect-square rounded-lg border flex items-center justify-center text-base transition-all ${settings.position === pos
                                        ? 'bg-violet-600 border-violet-500 text-white'
                                        : 'bg-zinc-900 border-white/10 text-zinc-500 hover:border-white/20'
                                        }`}
                                >
                                    {POSITION_LABELS[pos]}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* AI Generate Section - only in generator mode */}
                {editorMode === 'generator' && (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                        <label className="text-sm text-zinc-400 font-medium flex items-center gap-2">
                            <Sparkles size={14} className="text-violet-400" />
                            AI Генерация
                        </label>

                        <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded-xl">
                            {MODELS.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => {
                                        impact('light')
                                        setSelectedModel(m.id)
                                    }}
                                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${selectedModel === m.id
                                        ? 'bg-white/10 text-white shadow-sm'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    {m.name} <span className="text-xs opacity-60 ml-1">{m.price}⚡</span>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => handleGenerateAI()}
                            disabled={generating}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95 transition-transform"
                        >
                            {generating ? (
                                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    {t('watermark.generate') || 'Сгенерировать'}
                                </>
                            )}
                        </button>

                        {/* Switch between AI and Text modes */}
                        {(settings.type === 'ai_generated' || settings.type === 'custom') && (
                            <button
                                onClick={() => {
                                    impact('light')
                                    setSettings(s => ({ ...s, type: 'text' }))
                                }}
                                className="w-full py-2 text-sm text-zinc-500 hover:text-white transition-colors"
                            >
                                {t('watermark.switchToText') || 'Вернуться к тексту'}
                            </button>
                        )}

                        {/* Show "Return to AI" button if user has saved image watermark but currently in text mode */}
                        {settings.type === 'text' && settings.image_url && (
                            <button
                                onClick={() => {
                                    impact('light')
                                    setSettings(s => ({ ...s, type: 'ai_generated' }))
                                    toast.success(t('watermark.switchedToAi') || 'Переключено на AI знак')
                                }}
                                className="w-full py-2 text-sm text-violet-400 hover:text-violet-300 transition-colors flex items-center justify-center gap-2"
                            >
                                <Sparkles size={14} />
                                {t('watermark.switchToAi') || 'Вернуться к AI знаку'}
                            </button>
                        )}
                    </div>
                )}

                {/* Custom Upload Section - only in custom mode */}
                {editorMode === 'custom' && (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                        <label className="text-sm text-zinc-400 font-medium flex items-center gap-2">
                            <Upload size={14} className="text-violet-400" />
                            {t('watermark.uploadSection') || 'Загрузка изображения'}
                        </label>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95 transition-transform"
                        >
                            {uploading ? (
                                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Upload size={18} />
                                    {t('watermark.uploadImage') || 'Загрузить изображение'}
                                </>
                            )}
                        </button>

                        {/* Show current custom watermark info */}
                        {settings.type === 'custom' && settings.image_url && (
                            <div className="text-center text-sm text-zinc-500">
                                ✓ {t('watermark.customLoaded') || 'Изображение загружено'}
                            </div>
                        )}

                        {/* Switch to text mode */}
                        {(settings.type === 'custom' || settings.type === 'ai_generated') && (
                            <button
                                onClick={() => {
                                    impact('light')
                                    setSettings(s => ({ ...s, type: 'text' }))
                                }}
                                className="w-full py-2 text-sm text-zinc-500 hover:text-white transition-colors"
                            >
                                {t('watermark.switchToText') || 'Вернуться к тексту'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <div className="fixed left-0 right-0 p-4 bg-black/90 backdrop-blur-xl border-t border-white/10 flex gap-3" style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
                {settings.id && (
                    <button
                        onClick={handleDelete}
                        className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                    >
                        <Trash2 size={20} />
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving || (!settings.text_content && !settings.image_url)}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {saving ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <Check size={18} />
                            {t('watermark.save')}
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
