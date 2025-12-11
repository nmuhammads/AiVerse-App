import { useRef, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, CloudRain, Code2, Zap, Image as ImageIcon, Type, X, Send, Maximize2, Download as DownloadIcon, Info, Camera, Clipboard, FolderOpen } from 'lucide-react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useGenerationStore, type ModelType, type AspectRatio } from '@/store/generationStore'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'
import { PaymentModal } from '@/components/PaymentModal'
import { compressImage } from '@/utils/imageCompression'

const MODELS: { id: ModelType; name: string; desc: string; color: string; icon: string }[] = [
  { id: 'nanobanana', name: 'NanoBanana', desc: '3 токена', color: 'from-yellow-400 to-orange-500', icon: '/models/optimized/nanobanana.png' },
  { id: 'nanobanana-pro', name: 'NanoBanana Pro', desc: '15 токенов', color: 'from-pink-500 to-rose-500', icon: '/models/optimized/nanobanana-pro.png' },
  { id: 'seedream4', name: 'Seedream 4', desc: '4 токена', color: 'from-purple-400 to-fuchsia-500', icon: '/models/optimized/seedream.png' },
  { id: 'seedream4-5', name: 'Seedream 4.5', desc: '7 токенов', color: 'from-blue-400 to-indigo-500', icon: '/models/optimized/seedream-4-5.png' },
]

const MODEL_PRICES: Record<ModelType, number> = {
  nanobanana: 3,
  'nanobanana-pro': 15,
  seedream4: 4,
  'seedream4-5': 7,
}

const SUPPORTED_RATIOS: Record<ModelType, AspectRatio[]> = {
  'nanobanana-pro': ['Auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  seedream4: ['16:9', '4:3', '1:1', '3:4', '9:16'],
  nanobanana: ['Auto', '16:9', '4:3', '1:1', '3:4', '9:16'],
  'seedream4-5': ['16:9', '4:3', '1:1', '3:4', '9:16'],
}

const RATIO_EMOJIS: Record<AspectRatio, string> = {
  'Auto': '✨',
  '1:1': '🟧',
  '16:9': '🖥️',
  '9:16': '📱',
  '4:3': '📺',
  '3:4': '📕',
  '21:9': '🎬',
  '16:21': '📜',
  'square_hd': '🟧',
  'portrait_4_3': '📕',
  'portrait_16_9': '📱',
  'landscape_4_3': '📺',
  'landscape_16_9': '🖥️'
}

const RATIO_DISPLAY_NAMES: Record<string, string> = {
  'square_hd': '1:1',
  'portrait_4_3': '3:4',
  'portrait_16_9': '9:16',
  'landscape_4_3': '4:3',
  'landscape_16_9': '16:9',
}

export default function Studio() {
  const {
    selectedModel,

    prompt,
    negativePrompt,
    uploadedImages,
    aspectRatio,
    generationMode,
    generatedImage,
    isGenerating,
    error,
    currentScreen,
    parentAuthorUsername,
    parentGenerationId,
    setSelectedModel,
    setPrompt,
    setNegativePrompt,
    setUploadedImages,
    addUploadedImage,
    removeUploadedImage,
    setAspectRatio,
    setGenerationMode,
    setGeneratedImage,
    setIsGenerating,
    setError,
    setCurrentScreen,
    setParentGeneration,
  } = useGenerationStore()

  const { shareImage, saveToGallery, user, platform, tg } = useTelegram()
  const { impact, notify } = useHaptics()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [showBalancePopup, setShowBalancePopup] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [scale, setScale] = useState(1)
  const [resolution, setResolution] = useState<'2K' | '4K'>('4K')
  const [searchParams] = useSearchParams()
  const [contestEntryId, setContestEntryId] = useState<number | null>(null)
  const [inputKey, setInputKey] = useState(0) // Key for forcing input re-render after Face ID
  const [showSourceMenu, setShowSourceMenu] = useState(false)

  // Reset scale when closing fullscreen
  useEffect(() => {
    if (!isFullScreen) setScale(1)
  }, [isFullScreen])

  // Handle iOS Face ID / app resume: re-mount the file input
  useEffect(() => {
    const handleActivated = () => {
      // Force re-render of file input by changing its key
      setInputKey(prev => prev + 1)
    }
    try {
      tg?.onEvent?.('activated', handleActivated)
    } catch { /* noop */ }
    return () => {
      try {
        tg?.offEvent?.('activated', handleActivated)
      } catch { /* noop */ }
    }
  }, [tg])

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/user/info/${user.id}`).then(async r => {
        const j = await r.json().catch(() => null)
        if (r.ok && j && typeof j.balance === 'number') setBalance(j.balance)
      })
    }
  }, [user?.id, isPaymentModalOpen]) // Refresh when payment modal closes

  // Handle Remix & Contest Entry
  useEffect(() => {
    const remixId = searchParams.get('remix')
    const contestEntry = searchParams.get('contest_entry')

    if (contestEntry) {
      setContestEntryId(Number(contestEntry))
    }

    if (remixId) {
      fetch(`/api/generations/${remixId}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setPrompt(data.prompt)
            if (data.model) setSelectedModel(data.model as ModelType)
            // Try to infer aspect ratio or use default
            // If data has aspect_ratio, use it. Otherwise default.
            // Assuming the API returns aspect_ratio if stored, or we infer from dimensions if available.
            // For now, let's stick to model defaults unless we store ratio.
            // If we want to be precise, we should store aspect_ratio in DB.
            // Let's assume we might not have it, so we rely on user or default.

            setParentGeneration(data.id, data.users?.username || 'Unknown')

            // If it's image-to-image and has input images, we might want to load them?
            // Usually remix implies using the prompt. If it was img2img, maybe we don't load the original source image to avoid confusion/privacy issues, 
            // or we do. Let's stick to prompt for now as per standard remix behavior.
          }
        })
        .catch(err => console.error('Failed to load remix data', err))
    }
  }, [searchParams, setPrompt, setSelectedModel, setParentGeneration])

  // Default ratio logic
  useEffect(() => {
    if (parentGenerationId) return // Skip default logic if remixing

    if (selectedModel === 'seedream4') {
      setAspectRatio('3:4')
    } else if (selectedModel === 'seedream4-5') {
      setAspectRatio('3:4')
    } else if (selectedModel === 'nanobanana-pro' && aspectRatio === '16:21') {
      setAspectRatio('Auto')
    }
  }, [selectedModel, setAspectRatio, parentGenerationId])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Limit check
    const maxImages = 8
    if (uploadedImages.length + files.length > maxImages) {
      setError(`Максимум ${maxImages} фото для этой модели`)
      notify('error')
      return
    }

    // Process files with compression
    const processFiles = async () => {
      const newImages: string[] = []

      for (const file of Array.from(files)) {
        try {
          const compressed = await compressImage(file)
          newImages.push(compressed)
        } catch (e) {
          console.error('Compression failed', e)
          // Fallback to original if compression fails
          const reader = new FileReader()
          reader.readAsDataURL(file)
          reader.onload = (ev) => {
            if (ev.target?.result) addUploadedImage(ev.target.result as string)
          }
        }
      }

      newImages.forEach(img => addUploadedImage(img))
      impact('light')
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    processFiles()
  }

  // Process pasted files from clipboard event
  const processPastedFiles = async (files: FileList | File[]) => {
    const maxImages = 8
    const fileArray = Array.from(files)

    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) continue
      if (uploadedImages.length >= maxImages) {
        setError(`Максимум ${maxImages} фото`)
        notify('error')
        break
      }

      try {
        const compressed = await compressImage(file)
        addUploadedImage(compressed)
        impact('light')
        notify('success')
      } catch (e) {
        console.error('Compression failed', e)
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (ev) => {
          if (ev.target?.result) addUploadedImage(ev.target.result as string)
        }
      }
    }
  }

  // Handle paste button click - try clipboard API, show instructions otherwise
  const handlePasteClick = async () => {
    // First try modern Clipboard API
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read()
        const files: File[] = []

        for (const item of items) {
          const imageType = item.types.find(type => type.startsWith('image/'))
          if (imageType) {
            const blob = await item.getType(imageType)
            files.push(new File([blob], 'pasted-image.png', { type: imageType }))
          }
        }

        if (files.length > 0) {
          await processPastedFiles(files)
          return
        }
      }
    } catch (e) {
      console.log('Clipboard API not available:', e)
    }

    // Show instruction for manual paste
    setError('Скопируйте фото и нажмите долгим тапом здесь → Вставить')
    notify('warning')
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Введите промпт')
      notify('error')
      return
    }
    if (generationMode === 'image' && uploadedImages.length === 0) {
      setError('Загрузите изображение')
      notify('error')
      return
    }
    setIsGenerating(true)
    setError(null)

    impact('heavy')

    // Create AbortController for client-side timeout (300s)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000)

    try {
      const res = await fetch('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          aspect_ratio: aspectRatio,
          images: generationMode === 'image' ? uploadedImages : [],
          user_id: user?.id || null,
          parent_id: parentGenerationId || undefined,
          resolution: selectedModel === 'nanobanana-pro' ? resolution : undefined,
          contest_entry_id: contestEntryId || undefined
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (res.status === 403) {
        setShowBalancePopup(true)
        notify('error')
        setIsGenerating(false)
        return
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации')
      setGeneratedImage(data.image)
      setParentGeneration(null, null) // Reset parent after success
      // Update balance after generation
      if (balance !== null) {
        const cost = selectedModel === 'nanobanana-pro' && resolution === '2K' ? 10 : MODEL_PRICES[selectedModel]
        setBalance(prev => (prev !== null ? prev - cost : null))
      }

      try {
        const item = { id: Date.now(), url: data.image, prompt, model: MODELS.find(m => m.id === selectedModel)?.name, ratio: aspectRatio, date: new Date().toLocaleDateString() }
        const prev = JSON.parse(localStorage.getItem('img_gen_history_v2') || '[]')
        const next = [item, ...prev]
        localStorage.setItem('img_gen_history_v2', JSON.stringify(next))
      } catch { void 0 }
      setCurrentScreen('result')
      notify('success')
    } catch (e) {
      let msg = 'Ошибка генерации'
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          msg = 'Время ожидания истекло. Генерация может завершиться в фоне, проверьте историю позже.'
        } else if (e.message === 'Failed to fetch' || e.message.includes('Load failed')) {
          msg = 'Ошибка сети. Проверьте интернет или попробуйте позже.'
        } else {
          msg = e.message
        }
      }
      setError(msg)
      notify('error')
    } finally {
      clearTimeout(timeoutId)
      setIsGenerating(false)
    }
  }

  if (currentScreen === 'result' && generatedImage) {
    return (
      <div className="min-h-dvh bg-black safe-bottom-tabbar flex flex-col justify-end pb-24">
        <div className="mx-auto max-w-3xl w-full px-4">
          <Card className="bg-zinc-900/90 border-white/10 backdrop-blur-xl relative">
            <button
              onClick={() => { setCurrentScreen('form'); setGeneratedImage(null); setError(null) }}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors z-10"
            >
              <X size={20} />
            </button>
            <CardHeader>
              <CardTitle className="text-white">Результат</CardTitle>
              <CardDescription className="text-white/60">{MODELS.find(m => m.id === selectedModel)?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative rounded-lg overflow-hidden group bg-black/20 flex items-center justify-center py-2">
                <img src={generatedImage} alt="result" className="max-h-[45vh] w-auto object-contain shadow-lg rounded-md" />
                <button
                  onClick={() => {
                    impact('light')
                    setIsFullScreen(true)
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors"
                >
                  <Maximize2 size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={() => { saveToGallery(generatedImage, `ai-${Date.now()}.jpg`) }} className="flex-1 bg-white text-black hover:bg-zinc-200 font-bold">
                    <DownloadIcon size={16} className="mr-2" />
                    Сохранить
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!user?.id) return
                      impact('light')
                      try {
                        const r = await fetch('/api/telegram/sendDocument', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: user.id, file_url: generatedImage, caption: prompt }) })
                        const j = await r.json().catch(() => null)
                        if (r.ok && j?.ok) { notify('success') }
                        else {
                          notify('error')
                          shareImage(generatedImage, prompt)
                        }
                      } catch {
                        notify('error')
                      }
                    }}
                    className="flex-1 bg-violet-600 text-white hover:bg-violet-700 font-bold"
                  >
                    <Send size={16} className="mr-2" />
                    Отправить в чат
                  </Button>
                </div>
                <Button onClick={() => { setCurrentScreen('form'); setGeneratedImage(null); setError(null) }} className="w-full bg-zinc-800 text-white hover:bg-zinc-700 font-bold border border-white/10">Закрыть окно</Button>
              </div>
            </CardContent>
          </Card>
        </div>
        {isFullScreen && (
          <div className="fixed inset-0 z-[200] bg-black flex flex-col">
            <div className={`absolute top-0 right-0 z-50 p-4 pt-[calc(3rem+env(safe-area-inset-top))]`}>
              <button
                onClick={() => setIsFullScreen(false)}
                className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md"
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
                    src={generatedImage}
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

  const ratios = SUPPORTED_RATIOS[selectedModel] || SUPPORTED_RATIOS['seedream4']
  const maxImages = 8

  const paddingTop = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 5px)' : 'calc(env(safe-area-inset-top) + 50px)'

  return (
    <div className="min-h-dvh bg-black pb-32 flex flex-col" style={{ paddingTop }}>
      <div className="mx-auto max-w-3xl w-full px-4 py-4 flex-1 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">Studio</h1>
          <button
            onClick={() => { impact('light'); setIsPaymentModalOpen(true) }}
            className="px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10 flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            <Zap size={14} className="text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-bold text-white">{balance ?? '—'}</span>
          </button>
        </div>

        {/* 1. Compact Model Selector (Grid, no scroll) */}
        <div className="grid grid-cols-4 gap-2">
          {MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => { setSelectedModel(m.id); impact('light') }}
              className={`relative flex flex-col items-center gap-1.5 py-2 rounded-xl border transition-all duration-300 ${selectedModel === m.id ? 'bg-zinc-900 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-zinc-900/30 border-transparent hover:bg-zinc-900/50'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${m.color} shadow-lg transition-transform duration-300 overflow-hidden ${selectedModel === m.id ? 'scale-110' : ''}`}>
                <img src={m.icon} alt={m.name} className="w-full h-full object-cover" />
              </div>
              <span className={`text-[10px] font-semibold text-center leading-tight ${selectedModel === m.id ? 'text-white' : 'text-zinc-500'}`}>{m.name}</span>
              {selectedModel === m.id && <div className="absolute inset-0 rounded-xl ring-1 ring-white/20 pointer-events-none" />}
            </button>
          ))}
        </div>

        {/* 2. Mode Toggle */}
        <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
          <button
            onClick={() => { setGenerationMode('text'); impact('light') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${generationMode === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Type size={14} />
            <span>Text to Image</span>
          </button>
          <button
            onClick={() => { setGenerationMode('image'); impact('light') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${generationMode === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <ImageIcon size={14} />
            <span>Image to Image</span>
          </button>
        </div>

        {/* 3. Prompt Input (New Animation) */}
        <div className="relative mt-1">
          {parentAuthorUsername && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-violet-400 animate-in fade-in slide-in-from-bottom-2 mb-1 px-1">
              <Sparkles size={12} />
              <span>Промпт от {parentAuthorUsername}</span>
              <button
                onClick={() => {
                  setParentGeneration(null, null)
                  setPrompt('')
                  setUploadedImages([])
                }}
                className="ml-1 p-0.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          )}
          <div className="prompt-container group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Опишите вашу идею..."
              className={`prompt-input min-h-[120px] bg-zinc-900/30 backdrop-blur-sm no-scrollbar ${parentAuthorUsername ? 'border-violet-500/30 focus:border-violet-500/50' : ''}`}
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
        </div>



        {/* 4. Reference Image (Multi-Image Support) */}
        {generationMode === 'image' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="border-2 border-dashed border-white/10 rounded-xl p-4 bg-zinc-900/20 relative overflow-hidden">

              {uploadedImages.length > 0 ? (
                <div className="space-y-3">
                  {/* Image grid */}
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

                  {/* Add more buttons */}
                  {uploadedImages.length < maxImages && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2 px-3 rounded-lg border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors text-xs"
                      >
                        <ImageIcon size={14} />
                        <span>Ещё</span>
                      </button>
                      {/* Paste zone for adding more */}
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        onPaste={async (e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const items = e.clipboardData?.items
                          if (!items) return

                          const files: File[] = []
                          for (const item of Array.from(items)) {
                            if (item.type.startsWith('image/')) {
                              const file = item.getAsFile()
                              if (file) files.push(file)
                            }
                          }

                          if (files.length > 0) {
                            await processPastedFiles(files)
                          }
                          e.currentTarget.innerHTML = ''
                        }}
                        onInput={(e) => { e.currentTarget.innerHTML = '' }}
                        className="flex-1 py-2 px-3 rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 flex items-center justify-center gap-2 text-violet-300 text-xs cursor-text focus:outline-none focus:border-violet-500/50"
                      >
                        <Clipboard size={14} />
                        <span>Вставить</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Main upload area - compact */}
                  <div className="py-2 text-center">
                    <div className="w-10 h-10 mx-auto bg-zinc-800 rounded-full flex items-center justify-center mb-2 text-zinc-400">
                      <ImageIcon size={20} />
                    </div>
                    <div className="text-xs font-medium text-zinc-300">Добавить референсы (до {maxImages})</div>
                  </div>

                  {/* Source selection */}
                  <div className="space-y-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors active:scale-95"
                    >
                      <ImageIcon size={16} />
                      <span className="text-xs font-medium">Выбрать фото</span>
                    </button>

                    {/* Paste zone - contenteditable for iOS long-press paste */}
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

                        if (files.length > 0) {
                          await processPastedFiles(files)
                        }

                        // Clear the contenteditable
                        e.currentTarget.innerHTML = ''
                      }}
                      onInput={(e) => {
                        // Clear any text input
                        e.currentTarget.innerHTML = ''
                      }}
                      className="w-full py-3 px-3 rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 flex items-center justify-center gap-2 text-violet-300 text-xs font-medium cursor-text select-none focus:outline-none focus:border-violet-500/50 focus:bg-violet-500/10"
                      style={{ minHeight: '44px', WebkitUserSelect: 'none' }}
                    >
                      <Clipboard size={16} />
                      <span>Зажмите здесь → Вставить</span>
                    </div>
                  </div>

                  {/* Hint */}
                  <div className="text-[10px] text-zinc-500 text-center">
                    Скопируйте фото → зажмите фиолетовую зону → Вставить
                  </div>
                </div>
              )}
            </div>
            {parentGenerationId && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs animate-in fade-in slide-in-from-top-2">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>При повторе генерации замените фото референсы на свои личные (один или несколько) при необходимости</span>
              </div>
            )}
          </div>
        )}

        {/* 5. Aspect Ratio Selector (Emojis) */}
        {(true || generationMode === 'text') && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">Соотношение сторон</label>
            <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar -mx-2 px-2">
              {ratios.map(r => (
                <button
                  key={r}
                  onClick={() => { setAspectRatio(r); impact('light') }}
                  className={`flex-shrink-0 w-14 h-14 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all overflow-hidden ${aspectRatio === r ? 'bg-white text-black border-white shadow-lg shadow-white/10 scale-105' : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:bg-zinc-800'}`}
                >
                  <span className="text-lg leading-none">{RATIO_EMOJIS[r]}</span>
                  <span className={`leading-none ${aspectRatio === r ? 'opacity-100' : 'opacity-60'}`}>{RATIO_DISPLAY_NAMES[r] || r}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5.1 Resolution Selector (NanoBanana Pro only) */}
        {selectedModel === 'nanobanana-pro' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">Качество</label>
            <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-xl border border-white/5">
              <button
                onClick={() => { setResolution('2K'); impact('light') }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${resolution === '2K' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                2K (10 токенов)
              </button>
              <button
                onClick={() => { setResolution('4K'); impact('light') }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${resolution === '4K' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                4K (15 токенов)
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={`${error.includes('Время ожидания') ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'} border rounded-xl p-3 flex items-center gap-3 text-sm animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`w-1.5 h-1.5 rounded-full ${error.includes('Время ожидания') ? 'bg-amber-500' : 'bg-rose-500'}`} />
            {error}
          </div>
        )}

        {/* 6. Generate Button (Moved Up) */}
        <div className="">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || (generationMode === 'image' && uploadedImages.length === 0)}
            className={`w-full py-6 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-[0.98] relative overflow-hidden group ${isGenerating ? 'bg-zinc-900/80 text-violet-200 cursor-wait border border-violet-500/20' : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-violet-500/25 border border-white/10'}`}
          >
            {isGenerating ? (
              <div className="absolute inset-0 bg-violet-500/10 animate-pulse" />
            ) : (
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            )}
            <div className="relative flex items-center gap-2">
              {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              <span>{isGenerating ? 'Создание шедевра...' : generationMode === 'image' ? 'Сгенерировать' : 'Сгенерировать'}</span>
              {!isGenerating && <span className="bg-black/20 px-2 py-0.5 rounded text-xs font-normal ml-1">
                {selectedModel === 'nanobanana-pro' && resolution === '2K' ? 10 : MODEL_PRICES[selectedModel]} токена
              </span>}
            </div>
          </Button>
          {isGenerating && (
            <p className="text-[10px] text-zinc-500 text-center mt-3 animate-in fade-in slide-in-from-top-1 px-4 leading-relaxed">
              Если процесс идет долго, можете свернуть приложение. <br />
              Результат появится в разделе <span className="text-zinc-400 font-medium">Мои генерации</span> в профиле.
            </p>
          )}
        </div>

      </div>
      {/* Insufficient Balance Popup */}
      {
        showBalancePopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full relative shadow-2xl animate-in slide-in-from-bottom-4">
              <button onClick={() => setShowBalancePopup(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
                <X size={20} />
              </button>
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4 mx-auto">
                <Zap size={24} className="text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-2">Недостаточно токенов</h3>
              <p className="text-zinc-400 text-center text-sm mb-6">
                У вас закончились токены для генерации. Пополните баланс, чтобы продолжить создавать шедевры!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBalancePopup(false)}
                  className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-bold"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    impact('medium')
                    setShowBalancePopup(false)
                    setIsPaymentModalOpen(true)
                  }}
                  className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-bold shadow-lg shadow-violet-900/20"
                >
                  Купить токены
                </button>
              </div>
            </div>
          </div>
        )}

      <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} />

      {/* Persistent File Input - Kept outside conditional rendering to prevent unmounting during OS context switches */}
      <input
        key={inputKey}
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        className="hidden"
        onClick={(e) => {
          e.stopPropagation();
          // Reset value to allow selecting same file again if needed
          (e.target as HTMLInputElement).value = '';
        }}
      />

      {/* Camera Input - separate input for camera capture */}
      <input
        key={`camera-${inputKey}`}
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
        onClick={(e) => {
          e.stopPropagation();
          (e.target as HTMLInputElement).value = '';
        }}
      />
    </div>
  )
}


