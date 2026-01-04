import { useRef, useState, useEffect } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, CloudRain, Code2, Zap, Image as ImageIcon, Type, X, Send, Maximize2, Download as DownloadIcon, Info, Camera, Clipboard, FolderOpen, Pencil, Video, Volume2, VolumeX, Lock, Unlock } from 'lucide-react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useGenerationStore, type ModelType, type AspectRatio, type VideoDuration, type VideoResolution, type GptImageQuality } from '@/store/generationStore'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'
import { PaymentModal } from '@/components/PaymentModal'
import { DevModeBanner } from '@/components/DevModeBanner'
import { compressImage } from '@/utils/imageCompression'


// Модели для генерации изображений
const IMAGE_MODELS: { id: ModelType; name: string; desc: string; color: string; icon: string }[] = [
  { id: 'nanobanana', name: 'NanoBanana', desc: '3 токена', color: 'from-yellow-400 to-orange-500', icon: '/models/optimized/nanobanana.png' },
  { id: 'nanobanana-pro', name: 'NanoBanana Pro', desc: '15 токенов', color: 'from-pink-500 to-rose-500', icon: '/models/optimized/nanobanana-pro.png' },
  { id: 'seedream4', name: 'Seedream 4', desc: '4 токена', color: 'from-purple-400 to-fuchsia-500', icon: '/models/optimized/seedream.png' },
  { id: 'seedream4-5', name: 'Seedream 4.5', desc: '7 токенов', color: 'from-blue-400 to-indigo-500', icon: '/models/optimized/seedream-4-5.png' },
  { id: 'gpt-image-1.5', name: 'GPT image 1.5', desc: 'от 5 токенов', color: 'from-cyan-400 to-blue-500', icon: '/models/optimized/gpt-image.png' },
]

// Модели для генерации видео
const VIDEO_MODELS: { id: ModelType; name: string; desc: string; color: string; icon: string }[] = [
  { id: 'seedance-1.5-pro', name: 'Seedance Pro', desc: 'от 24 токенов', color: 'from-red-500 to-orange-500', icon: '/models/optimized/seedream.png' },
]

// Для обратной совместимости
const MODELS = IMAGE_MODELS

const MODEL_PRICES: Record<ModelType, number> = {
  nanobanana: 3,
  'nanobanana-pro': 15,
  seedream4: 4,
  'seedream4-5': 7,
  'p-image-edit': 2,
  'seedance-1.5-pro': 42, // Default: 720p, 8s, без аудио
  'gpt-image-1.5': 5, // Default: medium quality
}

// Цены для GPT Image 1.5 по качеству
const GPT_IMAGE_PRICES: Record<GptImageQuality, number> = {
  medium: 5,
  high: 15,
}

const SUPPORTED_RATIOS: Record<ModelType, AspectRatio[]> = {
  'nanobanana-pro': ['Auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  seedream4: ['16:9', '4:3', '1:1', '3:4', '9:16'],
  nanobanana: ['Auto', '16:9', '4:3', '1:1', '3:4', '9:16'],
  'seedream4-5': ['16:9', '4:3', '1:1', '3:4', '9:16'],
  'p-image-edit': ['Auto', '1:1', '16:9', '9:16', '4:3', '3:4'],
  'seedance-1.5-pro': ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
  'gpt-image-1.5': ['1:1', '2:3', '3:2'],
}

// Цены для видео Seedance 1.5 Pro
const VIDEO_PRICES: Record<string, Record<string, { base: number; audio: number }>> = {
  '480p': {
    '4': { base: 12, audio: 24 },
    '8': { base: 21, audio: 42 },
    '12': { base: 29, audio: 58 },
  },
  '720p': {
    '4': { base: 24, audio: 48 },
    '8': { base: 42, audio: 84 },
    '12': { base: 58, audio: 116 },
  },
}

const calculateVideoCost = (resolution: string, duration: string, withAudio: boolean): number => {
  const prices = VIDEO_PRICES[resolution]?.[duration]
  if (!prices) return 42
  return withAudio ? prices.audio : prices.base
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
  '2:3': '📷',
  '3:2': '🖼️',
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
  const { t } = useTranslation()
  const {
    selectedModel,
    mediaType,
    prompt,
    negativePrompt,
    uploadedImages,
    aspectRatio,
    generationMode,
    generatedImage,
    generatedVideo,
    isGenerating,
    error,
    currentScreen,
    parentAuthorUsername,
    parentGenerationId,
    isPromptPrivate,
    // Видео параметры
    videoDuration,
    videoResolution,
    fixedLens,
    generateAudio,
    setSelectedModel,
    setMediaType,
    setPrompt,
    setNegativePrompt,
    setUploadedImages,
    addUploadedImage,
    removeUploadedImage,
    setAspectRatio,
    setGenerationMode,
    setGeneratedImage,
    setGeneratedVideo,
    setIsGenerating,
    setError,
    setCurrentScreen,
    setParentGeneration,
    // Видео setters
    setVideoDuration,
    setVideoResolution,
    setFixedLens,
    setGenerateAudio,
    // GPT Image 1.5 параметры
    gptImageQuality,
    setGptImageQuality,
  } = useGenerationStore()

  const { shareImage, saveToGallery, user, platform, tg } = useTelegram()
  const { impact, notify } = useHaptics()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [showBalancePopup, setShowBalancePopup] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [scale, setScale] = useState(1)
  const [resolution, setResolution] = useState<'2K' | '4K'>('4K')
  const [searchParams] = useSearchParams()
  const [contestEntryId, setContestEntryId] = useState<number | null>(null)
  const [inputKey, setInputKey] = useState(0) // Key for forcing input re-render after Face ID
  const [showSourceMenu, setShowSourceMenu] = useState(false)
  const [showTimeoutModal, setShowTimeoutModal] = useState(false)

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
  }, [user?.id, isPaymentModalOpen, isGenerating]) // Refresh when payment modal closes or generation completes

  // Handle Remix & Contest Entry
  useEffect(() => {
    const remixId = searchParams.get('remix')
    const contestEntry = searchParams.get('contest_entry')

    if (contestEntry) {
      setContestEntryId(Number(contestEntry))
    }

    if (remixId) {
      console.log('[Remix] Starting fetch for remixId:', remixId)
      fetch(`/api/generation/${remixId}`)
        .then(res => {
          console.log('[Remix] Fetch response status:', res.status, res.ok)
          return res.json()
        })
        .then(data => {
          console.log('[Remix] Raw API response:', JSON.stringify(data))
          if (data && !data.error) {
            // Set prompt
            setPrompt(data.prompt || '')

            // Set model
            if (data.model) setSelectedModel(data.model as ModelType)

            // Set aspect ratio if available
            if (data.aspect_ratio && data.aspect_ratio !== '1:1') {
              setAspectRatio(data.aspect_ratio as AspectRatio)
            }

            // Set input images if available (for image-to-image remix)
            if (data.input_images && Array.isArray(data.input_images) && data.input_images.length > 0) {
              setUploadedImages(data.input_images)
              setGenerationMode('image')
            }

            // Set media type
            if (data.media_type === 'video') {
              setMediaType('video')
              // Ensure we use the video model
              if (!data.model || data.model === 'seedance-1.5-pro') {
                setSelectedModel('seedance-1.5-pro')
              }
            } else {
              setMediaType('image')
            }

            // Set parent generation for tracking remix chain (with privacy flag)
            setParentGeneration(data.id, data.users?.username || 'Unknown', !!data.is_prompt_private)

            console.log('[Remix] Loaded data:', {
              id: data.id,
              prompt: data.prompt?.slice(0, 50),
              model: data.model,
              ratio: data.aspect_ratio,
              media_type: data.media_type,
              hasInputImages: data.input_images?.length > 0
            })
          } else {
            console.error('[Remix] API returned error:', data?.error)
          }
        })
        .catch(err => console.error('[Remix] Failed to load remix data:', err))
    }
  }, [searchParams, setPrompt, setSelectedModel, setParentGeneration, setAspectRatio, setUploadedImages, setGenerationMode, setMediaType])

  // Default ratio logic
  useEffect(() => {
    if (parentGenerationId) return // Skip default logic if remixing

    if (selectedModel === 'seedream4') {
      setAspectRatio('3:4')
    } else if (selectedModel === 'seedream4-5') {
      setAspectRatio('3:4')
    } else if (selectedModel === 'gpt-image-1.5') {
      setAspectRatio('2:3')
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
      setError(t('studio.upload.modelLimitError', { limit: maxImages }))
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
        setError(t('studio.upload.limitError', { limit: maxImages }))
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
    setError(t('studio.errors.pasteInstruction'))
    notify('warning')
  }

  const handleGenerate = async () => {
    // Пропустить проверку промпта для слепого ремикса с приватным промптом
    if (!prompt.trim() && !(isPromptPrivate && parentGenerationId)) {
      setError(t('studio.errors.promptRequired'))
      notify('error')
      return
    }
    if (generationMode === 'image' && uploadedImages.length === 0) {
      setError(t('studio.errors.imageRequired'))
      notify('error')
      return
    }
    setIsGenerating(true)
    setError(null)

    impact('heavy')

    // Create AbortController for client-side timeout (300s for images, 360s for video)
    const controller = new AbortController()
    const timeoutMs = mediaType === 'video' ? 360000 : 300000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const requestBody: Record<string, unknown> = {
        prompt,
        model: selectedModel,
        aspect_ratio: aspectRatio,
        images: generationMode === 'image' ? uploadedImages : [],
        user_id: user?.id || null,
        parent_id: parentGenerationId || undefined,
        resolution: selectedModel === 'nanobanana-pro' ? resolution : undefined,
        contest_entry_id: contestEntryId || undefined
      }

      // Добавить параметры видео для Seedance 1.5 Pro
      if (mediaType === 'video') {
        requestBody.video_duration = videoDuration
        requestBody.video_resolution = videoResolution
        requestBody.fixed_lens = fixedLens
        requestBody.generate_audio = generateAudio
      }

      // Добавить параметр качества для GPT Image 1.5
      if (selectedModel === 'gpt-image-1.5') {
        requestBody.gpt_image_quality = gptImageQuality
      }

      const res = await fetch('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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

      if (data.status === 'pending') {
        setShowTimeoutModal(true)
        notify('warning')
        setIsGenerating(false)
        return
      }

      if (!res.ok) throw new Error(data.error || t('studio.errors.generationError'))

      // Обработать результат: для видео и изображений
      if (mediaType === 'video') {
        setGeneratedVideo(data.image) // API возвращает URL в поле image
        setGeneratedImage(null)
      } else {
        setGeneratedImage(data.image)
        setGeneratedVideo(null)
      }

      setParentGeneration(null, null) // Reset parent after success
      // Баланс уже был списан на сервере при создании генерации
      // Не обновляем локально чтобы избежать двойного списания

      try {
        const modelName = mediaType === 'video' ? 'Seedance Pro' : MODELS.find(m => m.id === selectedModel)?.name
        const item = { id: Date.now(), url: data.image, prompt, model: modelName, ratio: aspectRatio, date: new Date().toLocaleDateString(), mediaType }
        const prev = JSON.parse(localStorage.getItem('img_gen_history_v2') || '[]')
        const next = [item, ...prev]
        localStorage.setItem('img_gen_history_v2', JSON.stringify(next))
      } catch { void 0 }
      setCurrentScreen('result')
      notify('success')
    } catch (e) {
      let msg = t('studio.errors.generationError')
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          msg = mediaType === 'video' ? t('studio.errors.videoTimeout') : t('studio.errors.timeout')
        } else if (e.message === 'Failed to fetch' || e.message.includes('Load failed')) {
          msg = t('studio.errors.network')
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

  // Показать результат для изображения ИЛИ видео
  const hasResult = currentScreen === 'result' && (generatedImage || generatedVideo)
  const isVideoResult = !!generatedVideo
  // Для видео используем generatedVideo, для изображений - generatedImage
  const resultUrl = isVideoResult ? generatedVideo : (generatedImage || '')

  // Debug log
  console.log('[Studio Result]', { generatedImage, generatedVideo, isVideoResult, resultUrl })

  if (hasResult) {
    return (
      <div className="min-h-dvh bg-black safe-bottom-tabbar flex flex-col justify-end pb-24">
        <div className="mx-auto max-w-3xl w-full px-4">
          <Card className="bg-zinc-900/90 border-white/10 backdrop-blur-xl relative">
            <button
              onClick={() => { setCurrentScreen('form'); setGeneratedImage(null); setGeneratedVideo(null); setError(null) }}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white transition-colors z-10"
            >
              <X size={20} />
            </button>
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                {isVideoResult && <Video size={20} className="text-orange-400" />}
                {isVideoResult ? t('studio.result.videoTitle') : t('studio.result.title')}
              </CardTitle>
              <CardDescription className="text-white/60">
                {isVideoResult ? 'Seedance Pro' : MODELS.find(m => m.id === selectedModel)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative rounded-lg overflow-hidden group bg-black/20 flex items-center justify-center py-2">
                {isVideoResult ? (
                  <>
                    {console.log('[Studio Video]', { resultUrl })}
                    <video
                      src={resultUrl}
                      controls
                      loop
                      muted={isMuted}
                      playsInline
                      className="max-h-[45vh] w-auto object-contain shadow-lg rounded-md"
                      onLoadStart={() => console.log('[Studio Video] Load started, url:', resultUrl)}
                      onLoadedData={() => console.log('[Studio Video] Data loaded successfully')}
                      onCanPlay={() => console.log('[Studio Video] Can play now')}
                      onError={(e) => {
                        const video = e.currentTarget
                        console.error('[Studio Video] Error:', {
                          url: resultUrl,
                          errorCode: video.error?.code,
                          errorMsg: video.error?.message,
                          networkState: video.networkState,
                          readyState: video.readyState
                        })
                      }}
                    />
                  </>
                ) : (
                  <img src={resultUrl} alt="result" className="max-h-[45vh] w-auto object-contain shadow-lg rounded-md" />
                )}
                {!isVideoResult && (
                  <button
                    onClick={() => {
                      impact('light')
                      setIsFullScreen(true)
                    }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors"
                  >
                    <Maximize2 size={16} />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={() => {
                      const ext = isVideoResult ? 'mp4' : 'jpg'
                      saveToGallery(resultUrl, `ai-${Date.now()}.${ext}`)
                    }}
                    className="flex-1 bg-white text-black hover:bg-zinc-200 font-bold"
                  >
                    <DownloadIcon size={16} className="mr-2" />
                    {t('studio.result.save')}
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!user?.id) return
                      impact('light')
                      try {
                        const r = await fetch('/api/telegram/sendDocument', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: user.id, file_url: resultUrl, caption: prompt }) })
                        const j = await r.json().catch(() => null)
                        if (r.ok && j?.ok) { notify('success') }
                        else {
                          notify('error')
                          if (!isVideoResult) shareImage(resultUrl, prompt)
                        }
                      } catch {
                        notify('error')
                      }
                    }}
                    className="flex-1 bg-violet-600 text-white hover:bg-violet-700 font-bold"
                  >
                    <Send size={16} className="mr-2" />
                    {t('studio.result.sendToChat')}
                  </Button>
                </div>
                {/* Кнопка редактирования только для изображений */}
                {!isVideoResult && (
                  <Button
                    onClick={() => navigate(`/editor?image=${encodeURIComponent(resultUrl)}`)}
                    className="w-full bg-cyan-600 text-white hover:bg-cyan-500 font-bold"
                  >
                    <Pencil size={16} className="mr-2" />
                    {t('editor.edit')}
                  </Button>
                )}
                <Button
                  onClick={() => { setCurrentScreen('form'); setGeneratedImage(null); setGeneratedVideo(null); setError(null) }}
                  className="w-full bg-zinc-800 text-white hover:bg-zinc-700 font-bold border border-white/10"
                >
                  {t('studio.result.close')}
                </Button>
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
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">{t('studio.title')}</h1>
          <div className="flex items-center gap-2">
            {/* Editor Button */}
            <button
              onClick={() => { impact('light'); navigate('/editor') }}
              className="px-3 py-1.5 rounded-full bg-cyan-600/20 border border-cyan-500/30 flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <Pencil size={14} className="text-cyan-400" />
              <span className="text-xs font-bold text-cyan-300">{t('editor.title')}</span>
            </button>
            {/* Balance Button */}
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
        </div>

        {/* Dev Mode Banner */}
        <DevModeBanner />

        {/* 0. Media Type Toggle: Фото / Видео */}
        <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
          <button
            onClick={() => {
              setMediaType('image')
              // При переключении на фото выбираем первую модель изображений
              if (selectedModel === 'seedance-1.5-pro') {
                setSelectedModel('nanobanana-pro')
              }
              impact('light')
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-sm font-bold transition-all ${mediaType === 'image' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <ImageIcon size={16} />
            <span>{t('studio.mediaType.image')}</span>
          </button>
          <button
            onClick={() => {
              setMediaType('video')
              // При переключении на видео выбираем модель видео
              setSelectedModel('seedance-1.5-pro')
              impact('light')
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-sm font-bold transition-all ${mediaType === 'video' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Video size={16} />
            <span>{t('studio.mediaType.video')}</span>
          </button>
        </div>

        {/* 1. Compact Model Selector (Grid, no scroll) */}
        {mediaType === 'image' && (
          <div className="grid grid-cols-4 gap-2">
            {IMAGE_MODELS.map(m => {
              const isSelected = selectedModel === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id); impact('light') }}
                  className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all duration-200 ${isSelected
                    ? 'bg-zinc-800 shadow-lg'
                    : 'bg-zinc-900/40 hover:bg-zinc-800/60'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl overflow-hidden shadow-md transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}>
                    <img src={m.icon} alt={m.name} className="w-full h-full object-cover" />
                  </div>
                  <span className={`text-[10px] font-semibold text-center leading-tight ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                    {m.name}
                  </span>
                </button>
              )
            })}

          </div>
        )}

        {/* 1.5 Video Model Info (показываем когда выбрано видео) */}
        {mediaType === 'video' && (
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-xl">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md">
              <img src="/models/optimized/seedream.png" alt="Seedance Pro" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white">Seedance Pro</div>
              <div className="text-xs text-zinc-400">{t('studio.video.modelDesc')}</div>
            </div>
          </div>
        )}

        {/* 2. Mode Toggle (T2I/I2I) — только для изображений */}
        {mediaType === 'image' && (
          <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
            <button
              onClick={() => { setGenerationMode('text'); impact('light') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${generationMode === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Type size={14} />
              <span>{t('studio.mode.textToImage')}</span>
            </button>
            <button
              onClick={() => { setGenerationMode('image'); impact('light') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${generationMode === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <ImageIcon size={14} />
              <span>{t('studio.mode.imageToImage')}</span>
            </button>
          </div>
        )}

        {/* 2.5 Video Mode Toggle (T2V/I2V) — только для видео */}
        {mediaType === 'video' && (
          <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
            <button
              onClick={() => { setGenerationMode('text'); setUploadedImages([]); impact('light') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${generationMode === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Type size={14} />
              <span>{t('studio.mode.textToVideo')}</span>
            </button>
            <button
              onClick={() => { setGenerationMode('image'); impact('light') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${generationMode === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <ImageIcon size={14} />
              <span>{t('studio.mode.imageToVideo')}</span>
            </button>
          </div>
        )}

        {/* 3. Prompt Input (New Animation) */}
        <div className="relative mt-1">
          {parentAuthorUsername && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-violet-400 animate-in fade-in slide-in-from-bottom-2 mb-1 px-1">
              <Sparkles size={12} />
              <span>{t('studio.prompt.from', { username: parentAuthorUsername })}</span>

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
          <div className="prompt-container group relative">
            {/* For private prompts: show only placeholder, completely hide real prompt */}
            {isPromptPrivate && parentAuthorUsername ? (
              <>
                {/* Visual placeholder - no access to real prompt */}
                <div className="prompt-input min-h-[120px] bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-amber-500/30 !flex items-center justify-center">
                  <span className="text-zinc-400 italic">{t('profile.preview.hiddenByAuthor')}</span>
                </div>
              </>
            ) : (
              <>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t('studio.prompt.placeholder')}
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
              </>
            )}
          </div>
        </div>



        {/* 4. Reference Image for IMAGES mode (Multi-Image Support) */}
        {generationMode === 'image' && mediaType === 'image' && (
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
                        <span>{t('studio.upload.more')}</span>
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
                        <span>{t('studio.upload.paste')}</span>
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
                    <div className="text-xs font-medium text-zinc-300">{t('studio.upload.addReferences', { limit: maxImages })}</div>
                  </div>

                  {/* Source selection */}
                  <div className="space-y-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors active:scale-95"
                    >
                      <ImageIcon size={16} />
                      <span className="text-xs font-medium">{t('studio.upload.selectPhoto')}</span>
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
                      <span>{t('studio.upload.pasteHint')}</span>
                    </div>
                  </div>

                  {/* Hint */}
                  <div className="text-[10px] text-zinc-500 text-center">
                    {t('studio.upload.copyHint')}
                  </div>
                </div>
              )}
            </div>
            {parentGenerationId && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs animate-in fade-in slide-in-from-top-2">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>{t('studio.upload.remixHint')}</span>
              </div>
            )}
          </div>
        )}

        {/* 4.1 Reference Frames for VIDEO mode (Start/End frames for I2V) */}
        {generationMode === 'image' && mediaType === 'video' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-2 gap-3">
              {/* Start Frame */}
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.startFrame')}</label>
                {uploadedImages[0] ? (
                  <div className="border-2 border-dashed border-white/10 rounded-xl aspect-[4/3] bg-zinc-900/20 relative overflow-hidden">
                    <img src={uploadedImages[0]} alt="start-frame" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        const newImages = [...uploadedImages]
                        newImages[0] = ''
                        setUploadedImages(newImages.filter(Boolean))
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Select file button */}
                    <button
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = 'image/*'
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) {
                            const base64 = await new Promise<string>((resolve) => {
                              const reader = new FileReader()
                              reader.onloadend = () => resolve(reader.result as string)
                              reader.readAsDataURL(file)
                            })
                            const newImages = [...uploadedImages]
                            newImages[0] = base64
                            setUploadedImages(newImages)
                          }
                        }
                        input.click()
                      }}
                      className="w-full py-2.5 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors active:scale-95"
                    >
                      <ImageIcon size={14} />
                      <span className="text-[10px] font-medium">{t('studio.upload.selectPhoto')}</span>
                    </button>
                    {/* Paste zone */}
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
                              const base64 = await new Promise<string>((resolve) => {
                                const reader = new FileReader()
                                reader.onloadend = () => resolve(reader.result as string)
                                reader.readAsDataURL(file)
                              })
                              const newImages = [...uploadedImages]
                              newImages[0] = base64
                              setUploadedImages(newImages)
                              break
                            }
                          }
                        }
                        e.currentTarget.innerHTML = ''
                      }}
                      onInput={(e) => { e.currentTarget.innerHTML = '' }}
                      className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 flex items-center justify-center gap-2 text-violet-300 text-[10px] font-medium cursor-text select-none focus:outline-none focus:border-violet-500/50"
                    >
                      <Clipboard size={14} />
                      <span>{t('studio.upload.paste')}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* End Frame */}
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.endFrame')}</label>
                {uploadedImages[1] ? (
                  <div className="border-2 border-dashed border-white/10 rounded-xl aspect-[4/3] bg-zinc-900/20 relative overflow-hidden">
                    <img src={uploadedImages[1]} alt="end-frame" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        const newImages = [...uploadedImages]
                        newImages.splice(1, 1)
                        setUploadedImages(newImages.filter(Boolean))
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Select file button */}
                    <button
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = 'image/*'
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) {
                            const base64 = await new Promise<string>((resolve) => {
                              const reader = new FileReader()
                              reader.onloadend = () => resolve(reader.result as string)
                              reader.readAsDataURL(file)
                            })
                            const newImages = [...uploadedImages]
                            if (!newImages[0]) newImages[0] = ''
                            newImages[1] = base64
                            setUploadedImages(newImages.filter(Boolean))
                          }
                        }
                        input.click()
                      }}
                      className="w-full py-2.5 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors active:scale-95"
                    >
                      <ImageIcon size={14} />
                      <span className="text-[10px] font-medium">{t('studio.upload.selectPhoto')}</span>
                    </button>
                    {/* Paste zone */}
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
                              const base64 = await new Promise<string>((resolve) => {
                                const reader = new FileReader()
                                reader.onloadend = () => resolve(reader.result as string)
                                reader.readAsDataURL(file)
                              })
                              const newImages = [...uploadedImages]
                              if (!newImages[0]) newImages[0] = ''
                              newImages[1] = base64
                              setUploadedImages(newImages.filter(Boolean))
                              break
                            }
                          }
                        }
                        e.currentTarget.innerHTML = ''
                      }}
                      onInput={(e) => { e.currentTarget.innerHTML = '' }}
                      className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 flex items-center justify-center gap-2 text-violet-300 text-[10px] font-medium cursor-text select-none focus:outline-none focus:border-violet-500/50"
                    >
                      <Clipboard size={14} />
                      <span>{t('studio.upload.paste')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-2 px-1">{t('studio.video.framesHint')}</p>
          </div>
        )}

        {/* 5. Aspect Ratio Selector (Emojis) */}
        {(true || generationMode === 'text') && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.aspectRatio')}</label>
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
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.quality.label')}</label>
            <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-xl border border-white/5">
              <button
                onClick={() => { setResolution('2K'); impact('light') }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${resolution === '2K' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                2K · 10 ⚡
              </button>
              <button
                onClick={() => { setResolution('4K'); impact('light') }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${resolution === '4K' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                4K · 15 ⚡
              </button>
            </div>
          </div>
        )}

        {/* 5.1.5 Quality Selector (GPT Image 1.5 only) */}
        {selectedModel === 'gpt-image-1.5' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.quality.label')}</label>
            <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-xl border border-white/5">
              <button
                onClick={() => { setGptImageQuality('medium'); impact('light') }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${gptImageQuality === 'medium' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Medium · {GPT_IMAGE_PRICES.medium} ⚡
              </button>
              <button
                onClick={() => { setGptImageQuality('high'); impact('light') }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${gptImageQuality === 'high' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                High · {GPT_IMAGE_PRICES.high} ⚡
              </button>
            </div>
          </div>
        )}

        {/* 5.2 Video Parameters (Seedance 1.5 Pro only) — Compact Layout */}
        {mediaType === 'video' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
            {/* Row 1: Duration & Resolution */}
            <div className="grid grid-cols-2 gap-3">
              {/* Duration */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.duration')}</label>
                <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                  {(['4', '8', '12'] as VideoDuration[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => { setVideoDuration(d); impact('light') }}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${videoDuration === d ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.resolution')}</label>
                <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                  <button
                    onClick={() => { setVideoResolution('480p'); impact('light') }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${videoResolution === '480p' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    480p
                  </button>
                  <button
                    onClick={() => { setVideoResolution('720p'); impact('light') }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${videoResolution === '720p' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    720p
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Camera & Audio */}
            <div className="grid grid-cols-2 gap-3">
              {/* Camera */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.camera')}</label>
                <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                  <button
                    onClick={() => { setFixedLens(true); impact('light') }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${fixedLens ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Lock size={12} />
                    {t('studio.video.cameraStatic')}
                  </button>
                  <button
                    onClick={() => { setFixedLens(false); impact('light') }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${!fixedLens ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Unlock size={12} />
                    {t('studio.video.cameraDynamic')}
                  </button>
                </div>
              </div>

              {/* Audio */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.audio')}</label>
                <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                  <button
                    onClick={() => { setGenerateAudio(false); impact('light') }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${!generateAudio ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <VolumeX size={12} />
                    {t('studio.video.audioOff')}
                  </button>
                  <button
                    onClick={() => { setGenerateAudio(true); impact('light') }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${generateAudio ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Volume2 size={12} />
                    {t('studio.video.audioOn')}
                  </button>
                </div>
              </div>
            </div>

            {/* Camera hint */}
            <p className="text-[10px] text-zinc-500 px-1">
              {fixedLens ? t('studio.video.cameraStaticHint') : t('studio.video.cameraDynamicHint')}
            </p>
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
          {isGenerating && (
            <p className="text-xs text-zinc-500 text-center mb-3 animate-in fade-in slide-in-from-bottom-1 px-4 leading-relaxed">
              <Trans i18nKey="studio.generate.waitMessage" components={[<br />, <span className="text-zinc-400 font-medium" />, <br />, <span className="text-zinc-400 font-medium" />]} />
            </p>
          )}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || (!prompt.trim() && !(isPromptPrivate && parentGenerationId)) || aspectRatio === 'Auto' || (generationMode === 'image' && uploadedImages.length === 0)}
            className={`w-full py-6 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-[0.98] relative overflow-hidden group ${isGenerating ? 'bg-zinc-900/80 text-violet-200 cursor-wait border border-violet-500/20' : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-violet-500/25 border border-white/10'}`}
          >
            {isGenerating ? (
              <div className="absolute inset-0 bg-violet-500/10 animate-pulse" />
            ) : (
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            )}
            <div className="relative flex items-center gap-2">
              {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              <span>{isGenerating ? t('studio.generate.generating') : t('studio.generate.button')}</span>
              {!isGenerating && <span className="bg-black/20 px-2 py-0.5 rounded text-xs font-normal ml-1">
                {mediaType === 'video'
                  ? `${calculateVideoCost(videoResolution, videoDuration, generateAudio)} ${t('studio.tokens')}`
                  : `${selectedModel === 'nanobanana-pro' && resolution === '2K' ? 10
                    : selectedModel === 'gpt-image-1.5' ? GPT_IMAGE_PRICES[gptImageQuality]
                      : MODEL_PRICES[selectedModel]
                  } ${t('studio.tokens')}`
                }
              </span>}
            </div>
          </Button>
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

      {/* Timeout Modal */}
      {showTimeoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full relative shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="text-4xl text-center mb-4">⏳</div>
            <h3 className="text-lg font-bold text-white text-center mb-2">
              Генерация занимает больше времени
            </h3>
            <p className="text-zinc-400 text-center text-sm mb-6">
              Результат появится в профиле или токены вернутся автоматически.
            </p>
            <button
              onClick={() => setShowTimeoutModal(false)}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
            >
              Понятно
            </button>
          </div>
        </div>
      )}

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


