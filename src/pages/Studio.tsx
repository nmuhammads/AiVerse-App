import { useRef, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation, Trans } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, CloudRain, Code2, Zap, Image as ImageIcon, Type, X, Send, Maximize2, Download as DownloadIcon, Info, Camera, Clipboard, FolderOpen, Pencil, Video, Volume2, VolumeX, Lock, Unlock, ChevronLeft, ChevronRight, Layers, Wand2 } from 'lucide-react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useGenerationStore, type ModelType, type AspectRatio, type VideoDuration, type VideoResolution, type GptImageQuality, type ImageCount, type KlingVideoMode, type KlingDuration, type KlingMCQuality, type CharacterOrientation } from '@/store/generationStore'
import { useActiveGenerationsStore, MAX_ACTIVE_IMAGES } from '@/store/activeGenerationsStore'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'
import { PaymentModal } from '@/components/PaymentModal'
import { DevModeBanner } from '@/components/DevModeBanner'
import { ActiveGenerationsPanel } from '@/components/ActiveGenerationsPanel'
import { DescribeImageModal } from '@/components/DescribeImageModal'
import { compressImage } from '@/utils/imageCompression'


// Модели для генерации изображений
const ALL_IMAGE_MODELS: { id: ModelType; color: string; icon: string; devOnly?: boolean }[] = [
  { id: 'nanobanana', color: 'from-yellow-400 to-orange-500', icon: '/models/optimized/nanobanana.png' },
  { id: 'nanobanana-pro', color: 'from-pink-500 to-rose-500', icon: '/models/optimized/nanobanana-pro.png' },
  { id: 'seedream4', color: 'from-purple-400 to-fuchsia-500', icon: '/models/optimized/seedream.png' },
  { id: 'seedream4-5', color: 'from-blue-400 to-indigo-500', icon: '/models/optimized/seedream-4-5.png' },
  { id: 'gpt-image-1.5', color: 'from-cyan-400 to-blue-500', icon: '/models/optimized/gpt-image.png' },
  { id: 'test-model', color: 'from-green-400 to-emerald-500', icon: '/models/optimized/nanobanana.png', devOnly: true },
]

// Фильтруем модели по DEV режиму
const IS_DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'
const IMAGE_MODELS = ALL_IMAGE_MODELS.filter(m => !m.devOnly || IS_DEV_MODE)

// Модели для генерации видео
const VIDEO_MODELS: { id: ModelType; color: string; icon: string }[] = [
  { id: 'seedance-1.5-pro', color: 'from-red-500 to-orange-500', icon: '/models/optimized/seedream.png' },
  { id: 'kling-t2v', color: 'from-cyan-500 to-blue-500', icon: '/models/optimized/kling.png' },
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
  'test-model': 0, // Тестовая модель - бесплатно
  'kling-t2v': 55, // Default: 5s, без звука
  'kling-i2v': 55, // Default: 5s, без звука
  'kling-mc': 30, // Default: 5s × 6 токенов/сек
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
  'test-model': ['1:1', '16:9', '9:16'],
  'kling-t2v': ['1:1', '16:9', '9:16'],
  'kling-i2v': ['1:1', '16:9', '9:16'],
  'kling-mc': ['1:1', '16:9', '9:16'],
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

// === Цены для Kling AI ===
// T2V & I2V: фиксированная цена по длительности
const KLING_VIDEO_PRICES: Record<string, { base: number; audio: number }> = {
  '5': { base: 55, audio: 110 },
  '10': { base: 110, audio: 220 },
}

// Motion Control: цена за секунду (минимум 5 сек)
const KLING_MC_PRICES: Record<string, number> = {
  '720p': 6,
  '1080p': 9,
}

const calculateKlingCost = (
  mode: KlingVideoMode,
  duration: KlingDuration,
  withSound: boolean,
  mcQuality: KlingMCQuality = '720p',
  videoDurationSeconds: number = 0
): number => {
  if (mode === 'motion-control') {
    const pricePerSec = KLING_MC_PRICES[mcQuality]
    const effectiveDuration = Math.max(5, videoDurationSeconds)
    return effectiveDuration * pricePerSec
  }
  const prices = KLING_VIDEO_PRICES[duration]
  return withSound ? prices.audio : prices.base
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
    // Множественная генерация
    imageCount,
    setImageCount,
    generatedImages,
    setGeneratedImages,
    // Kling AI параметры
    klingVideoMode,
    klingDuration,
    klingSound,
    klingMCQuality,
    characterOrientation,
    uploadedVideoUrl,
    videoDurationSeconds,
    setKlingVideoMode,
    setKlingDuration,
    setKlingSound,
    setKlingMCQuality,
    setCharacterOrientation,
    setUploadedVideoUrl,
    setVideoDurationSeconds,
  } = useGenerationStore()

  const { shareImage, saveToGallery, user, platform, tg } = useTelegram()
  const { impact, notify } = useHaptics()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null) // Для загрузки видео (Motion Control)
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
  const [showCountSelector, setShowCountSelector] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [isDescribeModalOpen, setIsDescribeModalOpen] = useState(false)

  // Реактивно отслеживаем доступные слоты для генерации
  const availableSlots = useActiveGenerationsStore(
    (state) => MAX_ACTIVE_IMAGES - state.generations
      .filter((g) => g.status === 'processing')
      .reduce((sum, g) => sum + g.imageCount, 0)
  )

  // Reset scale when closing fullscreen
  useEffect(() => {
    if (!isFullScreen) setScale(1)
  }, [isFullScreen])

  // Kling Motion Control validation
  useEffect(() => {
    if (selectedModel === 'kling-mc' && uploadedVideoUrl && videoDurationSeconds > 0) {
      const maxDuration = characterOrientation === 'image' ? 10 : 30
      if (videoDurationSeconds > maxDuration) {
        setError(t('studio.kling.mc.durationError', { max: maxDuration, defaultValue: `Видео слишком длинное. Максимум: ${maxDuration} сек` }))
      } else {
        // Clear specific duration error if valid
        if (error?.includes('Видео слишком длинное')) {
          setError(null)
        }
      }
    }
  }, [selectedModel, uploadedVideoUrl, videoDurationSeconds, characterOrientation, t, error, setError])

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

    // Limit check - Kling модели поддерживают только 1 изображение
    const isKlingModel = ['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel)
    const maxImages = isKlingModel ? 1 : 8
    if (uploadedImages.length + files.length > maxImages) {
      setError(t('studio.upload.modelLimitError', { limit: maxImages }))
      notify('error')
      return
    }

    // Process files with compression
    const processFiles = async () => {
      setIsUploadingImage(true)
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
      // Сразу переключить режим на image, чтобы UI отобразил загруженные фото
      if (newImages.length > 0) {
        setGenerationMode('image')
      }
      impact('light')
      setIsUploadingImage(false)
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }

    processFiles().catch(() => setIsUploadingImage(false))
  }

  // Process pasted files from clipboard event
  const processPastedFiles = async (files: FileList | File[]) => {
    const isKlingModel = ['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel)
    const maxImages = isKlingModel ? 1 : 8
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

  // Улучшить промпт с помощью AI
  const handleOptimizePrompt = async () => {
    if (!prompt.trim()) {
      toast.error(t('studio.promptHelper.noPrompt'))
      return
    }

    setIsOptimizing(true)
    impact('medium')

    try {
      const response = await fetch('/api/prompt/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to optimize prompt')
      }

      if (data.prompt) {
        setPrompt(data.prompt)
        toast.success(t('studio.promptHelper.optimizeSuccess'))
        notify('success')
      } else {
        throw new Error('No prompt returned')
      }
    } catch (error) {
      console.error('Optimize error:', error)
      notify('error')
      toast.error(error instanceof Error ? error.message : t('studio.promptHelper.error'))
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleGenerate = async () => {
    // Получить store
    const { addGeneration, updateGeneration, removeGeneration, getAvailableSlots } = useActiveGenerationsStore.getState()

    // Определить количество изображений для этого запроса
    const requestImageCount = mediaType === 'video' ? 1 : imageCount

    // Проверить лимит активных изображений
    const availableSlots = getAvailableSlots()
    if (availableSlots < requestImageCount) {
      setError(t('activeGenerations.maxReached'))
      notify('error')
      return
    }

    // Пропустить проверку промпта для слепого ремикса с приватным промптом или для Kling Motion Control
    if (!prompt.trim() && !(isPromptPrivate && parentGenerationId) && selectedModel !== 'kling-mc') {
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
    // Reset previous result data to prevent stale state rendering black screen
    setGeneratedImage(null)
    setGeneratedVideo(null)
    setGeneratedImages([])
    impact('medium')

    // Добавить генерацию в очередь с количеством изображений
    const generationId = addGeneration({
      prompt: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
      model: selectedModel,
      status: 'processing',
      mediaType,
      imageCount: requestImageCount
    })

    // Сохранить текущие параметры для асинхронного запроса
    const currentParams = {
      prompt,
      selectedModel,
      aspectRatio,
      uploadedImages: generationMode === 'image' ? [...uploadedImages] : [],
      userId: user?.id || null,
      parentGenerationId,
      resolution,
      contestEntryId,
      imageCount: mediaType === 'image' ? imageCount : 1,
      mediaType,
      videoDuration,
      videoResolution,
      fixedLens,
      generateAudio,
      gptImageQuality,
      // Kling параметры
      klingDuration,
      klingSound,
      klingMCQuality,
      characterOrientation,
      uploadedVideoUrl,
      videoDurationSeconds
    }

      // Запустить генерацию асинхронно (не блокируя UI)
      ; (async () => {
        const controller = new AbortController()
        // Таймаут: видео до 30 мин (Kling Motion Control), изображения 5 мин
        const timeoutMs = currentParams.mediaType === 'video' ? 1800000 : 300000
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

        try {
          const requestBody: Record<string, unknown> = {
            prompt: currentParams.prompt,
            model: currentParams.selectedModel,
            aspect_ratio: currentParams.aspectRatio,
            images: currentParams.uploadedImages,
            user_id: currentParams.userId,
            parent_id: currentParams.parentGenerationId || undefined,
            resolution: currentParams.selectedModel === 'nanobanana-pro' ? currentParams.resolution : undefined,
            contest_entry_id: currentParams.contestEntryId || undefined,
            image_count: currentParams.imageCount
          }

          // Добавить параметры видео для Seedance 1.5 Pro
          if (currentParams.selectedModel === 'seedance-1.5-pro') {
            requestBody.video_duration = currentParams.videoDuration
            requestBody.video_resolution = currentParams.videoResolution
            requestBody.fixed_lens = currentParams.fixedLens
            requestBody.generate_audio = currentParams.generateAudio
          }

          // Добавить параметры для Kling T2V/I2V
          if (currentParams.selectedModel === 'kling-t2v' || currentParams.selectedModel === 'kling-i2v') {
            requestBody.kling_duration = currentParams.klingDuration
            requestBody.kling_sound = currentParams.klingSound
          }

          // Добавить параметры для Kling Motion Control
          if (currentParams.selectedModel === 'kling-mc') {
            requestBody.kling_mc_quality = currentParams.klingMCQuality
            requestBody.character_orientation = currentParams.characterOrientation
            requestBody.video_url = currentParams.uploadedVideoUrl
            requestBody.video_duration_seconds = currentParams.videoDurationSeconds
          }

          // Добавить параметр качества для GPT Image 1.5
          if (currentParams.selectedModel === 'gpt-image-1.5') {
            requestBody.gpt_image_quality = currentParams.gptImageQuality
          }

          const res = await fetch('/api/generation/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          if (res.status === 403) {
            updateGeneration(generationId, { status: 'error', error: 'Недостаточно токенов' })
            setShowBalancePopup(true)
            notify('error')
            return
          }

          const data = await res.json()

          if (data.status === 'pending') {
            // Генерация ушла в фон — удаляем из локального store, т.к. сервер теперь отслеживает её
            // Это предотвращает двойной подсчёт в PendingIndicator (serverCount + localActiveCount)
            removeGeneration(generationId)
            notify('success')
            toast.success(t('studio.generation.backgroundStarted', 'Запущено в фоне'))
            return
          }

          if (!res.ok) {
            throw new Error(data.error || t('studio.errors.generationError'))
          }

          // Обработать результат
          if (currentParams.mediaType === 'video') {
            updateGeneration(generationId, {
              status: 'completed',
              videoUrl: data.image
            })
          } else {
            const images = data.images || (data.image ? [data.image] : [])
            updateGeneration(generationId, {
              status: 'completed',
              imageUrl: images[0] || data.image,
              imageUrls: images.length > 1 ? images : undefined
            })
          }

          // Сохранить в историю
          try {
            const modelName = currentParams.mediaType === 'video' ? 'Seedance Pro' : t(`studio.models.${currentParams.selectedModel}.name`)
            const item = { id: Date.now(), url: data.image, prompt: currentParams.prompt, model: modelName, ratio: currentParams.aspectRatio, date: new Date().toLocaleDateString(), mediaType: currentParams.mediaType }
            const prev = JSON.parse(localStorage.getItem('img_gen_history_v2') || '[]')
            const next = [item, ...prev]
            localStorage.setItem('img_gen_history_v2', JSON.stringify(next))
          } catch { void 0 }

          notify('success')

          // Обновить баланс
          if (user?.id) {
            fetch(`/api/user/info/${user.id}`).then(async r => {
              const j = await r.json().catch(() => null)
              if (r.ok && j && typeof j.balance === 'number') setBalance(j.balance)
            })
          }

        } catch (e) {
          let msg = t('studio.errors.generationError')
          if (e instanceof Error) {
            if (e.name === 'AbortError') {
              msg = currentParams.mediaType === 'video' ? t('studio.errors.videoTimeout') : t('studio.errors.timeout')
            } else if (e.message === 'Failed to fetch' || e.message.includes('Load failed')) {
              msg = t('studio.errors.network')
            } else {
              msg = e.message
            }
          }
          updateGeneration(generationId, { status: 'error', error: msg })
          notify('error')
        } finally {
          clearTimeout(timeoutId)
        }
      })()

    // Сброс parent после запуска генерации
    setParentGeneration(null, null)
  }

  // Обработчик для просмотра результата из панели активных генераций
  const handleViewGenerationResult = (gen: { imageUrl?: string; imageUrls?: string[]; videoUrl?: string; mediaType: 'image' | 'video' }) => {
    if (gen.mediaType === 'video' && gen.videoUrl) {
      setGeneratedVideo(gen.videoUrl)
      setGeneratedImage(null)
      setGeneratedImages([])
    } else if (gen.imageUrls && gen.imageUrls.length > 1) {
      // Множественные изображения (2x, 3x, 4x)
      setGeneratedImages(gen.imageUrls)
      setGeneratedImage(gen.imageUrls[0])
      setGeneratedVideo(null)
      setCurrentImageIndex(0)
    } else if (gen.imageUrl) {
      setGeneratedImage(gen.imageUrl)
      setGeneratedVideo(null)
      setGeneratedImages([])
    }
    setCurrentScreen('result')
  }

  // Показать результат для изображения ИЛИ видео
  const hasMultipleImages = generatedImages.length > 1
  const isVideoResult = !!generatedVideo
  // Для видео используем generatedVideo, для изображений - проверяем множественные или одиночные
  const resultUrl = isVideoResult
    ? generatedVideo
    : hasMultipleImages
      ? generatedImages[currentImageIndex] || generatedImages[0]
      : (generatedImage || '')

  // Safety: если экран result, но данных нет — принудительно вернуть на форму (через useEffect, чтобы избежать side-effects в рендере)
  useEffect(() => {
    if (currentScreen === 'result' && !generatedImage && !generatedVideo && generatedImages.length === 0) {
      console.warn('[Studio] Screen is "result" but no data present, resetting to form')
      setCurrentScreen('form')
    }
  }, [currentScreen, generatedImage, generatedVideo, generatedImages, setCurrentScreen])

  // Вычислить hasResult ПОСЛЕ safety-check
  const hasResult = currentScreen === 'result' && !!resultUrl

  // Debug log
  console.log('[Studio Result]', { currentScreen, generatedImage, generatedImages, generatedVideo, isVideoResult, hasMultipleImages, currentImageIndex, resultUrl, hasResult })

  if (hasResult) {

    const paddingTopResult = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 10px)' : 'calc(env(safe-area-inset-top) + 50px)'

    const paddingBottomResult = platform === 'ios' ? 'calc(env(safe-area-inset-bottom) + 96px)' : '120px'

    return (
      <div className="min-h-dvh bg-black flex flex-col justify-end px-4" style={{ paddingTop: paddingTopResult, paddingBottom: paddingBottomResult }}>
        {/* Image/Video Preview */}
        <div className="flex-1 flex items-center justify-center mb-4 relative">
          {isVideoResult ? (
            <>
              {console.log('[Studio Video]', { resultUrl })}
              <video
                src={resultUrl}
                controls
                loop
                muted={isMuted}
                playsInline
                className="max-w-full max-h-[60vh] object-contain rounded-xl"
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
              {/* Mute toggle for video */}
              <button
                onClick={() => { setIsMuted(!isMuted); impact('light') }}
                className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md"
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </>
          ) : (
            <>
              <img
                src={resultUrl}
                alt="result"
                className="max-w-full max-h-[60vh] object-contain rounded-xl"
                onClick={() => { impact('light'); setIsFullScreen(true) }}
              />
              {/* Navigation for multiple images */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={() => {
                      impact('light')
                      setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : generatedImages.length - 1))
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => {
                      impact('light')
                      setCurrentImageIndex((prev) => (prev < generatedImages.length - 1 ? prev + 1 : 0))
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                  {/* Dot indicators */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {generatedImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => { impact('light'); setCurrentImageIndex(idx) }}
                        className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
              {/* Fullscreen button for single image */}
              {!hasMultipleImages && (
                <button
                  onClick={() => { impact('light'); setIsFullScreen(true) }}
                  className="absolute right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md"
                  style={{ top: 'calc(env(safe-area-inset-top) + 60px)' }}
                >
                  <Maximize2 size={18} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Compact Bottom Panel */}
        <div className="bg-zinc-900/95 backdrop-blur-lg border border-white/10 rounded-2xl p-4 space-y-3">
          {/* Model & count info */}
          {hasMultipleImages && (
            <div className="text-center text-xs text-zinc-400 mb-1">
              {currentImageIndex + 1} / {generatedImages.length}
            </div>
          )}

          {/* Primary Action Buttons Row */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const ext = isVideoResult ? 'mp4' : 'jpg'
                saveToGallery(resultUrl, `ai-${Date.now()}.${ext}`)
              }}
              className="flex-1 py-3 rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
            >
              <DownloadIcon size={18} />
              <span className="text-sm">{t('studio.result.save')}</span>
            </button>
            <button
              onClick={async () => {
                if (!user?.id) return
                impact('light')
                try {
                  const r = await fetch('/api/telegram/sendDocument', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: user.id, file_url: resultUrl, caption: prompt })
                  })
                  const j = await r.json().catch(() => null)
                  if (r.ok && j?.ok) {
                    notify('success')
                  } else {
                    notify('error')
                    if (!isVideoResult) shareImage(resultUrl, prompt)
                  }
                } catch {
                  notify('error')
                }
              }}
              className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-violet-500 transition-colors"
            >
              <Send size={18} />
              <span className="text-sm">{t('studio.result.sendToChat')}</span>
            </button>
          </div>

          {/* Secondary Actions */}
          <div className="flex gap-2">
            {/* Edit button - only for images */}
            {!isVideoResult && (
              <button
                onClick={() => navigate(`/editor?image=${encodeURIComponent(resultUrl)}`)}
                className="flex-1 py-2.5 rounded-xl bg-cyan-600/20 text-cyan-400 text-sm font-medium flex items-center justify-center gap-2 border border-cyan-500/30 hover:bg-cyan-600/30 transition-colors"
              >
                <Pencil size={16} />
                {t('editor.edit')}
              </button>
            )}
            <button
              onClick={() => {
                setCurrentScreen('form')
                setGeneratedImage(null)
                setGeneratedVideo(null)
                setGeneratedImages([])
                setCurrentImageIndex(0)
                setError(null)
              }}
              className={`${!isVideoResult ? 'flex-1' : 'w-full'} py-2.5 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-medium flex items-center justify-center gap-2 border border-white/10 hover:bg-zinc-700 hover:text-white transition-colors`}
            >
              <X size={16} />
              {t('studio.result.close')}
            </button>
          </div>
        </div>

        {/* Fullscreen Modal */}
        {isFullScreen && (
          <div className="fixed inset-0 z-[200] bg-black flex flex-col">
            <div className="absolute top-0 right-0 z-50 p-4 pt-[calc(3rem+env(safe-area-inset-top))]">
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
                    src={resultUrl}
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
                    <img src={m.icon} alt={t(`studio.models.${m.id}.name`)} className="w-full h-full object-cover" />
                  </div>
                  <span className={`text-[10px] font-semibold text-center leading-tight ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                    {t(`studio.models.${m.id}.name`)}
                  </span>
                </button>
              )
            })}

          </div>
        )}

        {/* Multi Generation Button */}
        {mediaType === 'image' && (
          <button
            onClick={() => { impact('light'); navigate('/multi-generation') }}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 flex items-center justify-between group active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
                <Layers size={20} />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white group-hover:text-pink-200 transition-colors">
                  {t('multiGeneration.title')}
                </div>
                <div className="text-[10px] text-zinc-400">
                  {t('multiGeneration.desc')}
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
          </button>
        )}

        {/* 1.5 Video Model Selector (Grid) */}
        {mediaType === 'video' && (
          <div className="grid grid-cols-2 gap-3">
            {VIDEO_MODELS.map(m => {
              // Kling модели группируются под одной карточкой
              const isKlingModel = m.id === 'kling-t2v'
              const isSelected = isKlingModel
                ? ['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel)
                : selectedModel === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (isKlingModel) {
                      // При выборе Kling устанавливаем модель по режиму
                      const klingModel = klingVideoMode === 'motion-control' ? 'kling-mc' : klingVideoMode === 'i2v' ? 'kling-i2v' : 'kling-t2v'
                      setSelectedModel(klingModel)
                      if (klingVideoMode === 't2v') setGenerationMode('text')
                      else setGenerationMode('image')
                    } else {
                      setSelectedModel(m.id as ModelType)
                    }
                    impact('light')
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isSelected
                    ? `bg-gradient-to-r ${m.color} shadow-lg`
                    : 'bg-zinc-900/50 border border-white/5 hover:bg-zinc-800/60'
                    }`}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md">
                    <img src={m.icon} alt={t(`studio.models.${m.id}.name`)} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{t(`studio.models.${m.id}.name`)}</div>
                    <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-zinc-500'}`}>{t(`studio.models.${m.id}.desc`)}</div>
                  </div>
                </button>
              )
            })}
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

        {/* 2.5 Video Mode Toggle — для Seedance: T2V/I2V */}
        {mediaType === 'video' && selectedModel === 'seedance-1.5-pro' && (
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

        {/* 2.6 Kling Mode Toggle — T2V / I2V / Motion Control */}
        {mediaType === 'video' && ['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) && (
          <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
            <button
              onClick={() => {
                setKlingVideoMode('t2v')
                setSelectedModel('kling-t2v')
                setGenerationMode('text')
                setUploadedImages([])
                setUploadedVideoUrl(null)
                impact('light')
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${klingVideoMode === 't2v' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Type size={14} />
              <span>{t('studio.kling.t2v', 'T2V')}</span>
            </button>
            <button
              onClick={() => {
                setKlingVideoMode('i2v')
                setSelectedModel('kling-i2v')
                setGenerationMode('image')
                setUploadedVideoUrl(null)
                impact('light')
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${klingVideoMode === 'i2v' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <ImageIcon size={14} />
              <span>{t('studio.kling.i2v', 'I2V')}</span>
            </button>
            <button
              onClick={() => {
                setKlingVideoMode('motion-control')
                setSelectedModel('kling-mc')
                setGenerationMode('image')
                impact('light')
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${klingVideoMode === 'motion-control' ? 'bg-zinc-800 text-white shadow-sm' : 'text-purple-400 hover:text-purple-300'}`}
              style={klingVideoMode !== 'motion-control' ? { textShadow: '0 0 10px rgba(168, 85, 247, 0.5)' } : undefined}
            >
              <Zap size={14} />
              <span>{t('studio.kling.motionControl', 'Motion Control')}</span>
            </button>
          </div>
        )}

        {/* 3. Prompt Input (New Animation) — скрыть для Kling Motion Control */}
        {selectedModel !== 'kling-mc' && <div className="relative mt-1">
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

          {/* Prompt Helper Buttons */}
          {!isPromptPrivate && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleOptimizePrompt}
                disabled={isOptimizing || !prompt.trim()}
                className={`flex-1 h-9 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${prompt.trim() && !isOptimizing
                  ? 'bg-gradient-to-r from-violet-600/80 to-purple-600/80 hover:from-violet-600 hover:to-purple-600 text-white'
                  : 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed'
                  }`}
              >
                {isOptimizing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t('studio.promptHelper.optimizing')}
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    {t('studio.promptHelper.optimize')}
                  </>
                )}
              </button>
              <button
                onClick={() => { impact('light'); setIsDescribeModalOpen(true) }}
                className="flex-1 h-9 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <ImageIcon size={14} />
                {t('studio.promptHelper.describe')}
              </button>
            </div>
          )}
        </div>}



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
                  {uploadedImages.length < (['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) ? 1 : 8) && (
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
                      disabled={isUploadingImage}
                      className="w-full py-2.5 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors active:scale-95 disabled:opacity-50"
                    >
                      {isUploadingImage ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-xs font-medium">{t('studio.upload.loading', 'Загрузка...')}</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon size={16} />
                          <span className="text-xs font-medium">{t('studio.upload.selectPhoto')}</span>
                        </>
                      )}
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
        {generationMode === 'image' && mediaType === 'video' && selectedModel !== 'kling-mc' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className={`grid gap-3 ${['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {/* Start Frame / Reference Image */}
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-1">
                  {['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) ? t('studio.kling.referenceImage', 'Референс фото') : t('studio.video.startFrame')}
                </label>
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

              {/* End Frame - только для Seedance, Kling не поддерживает */}
              {!['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) && (
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
              )}
            </div>
            {!['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) && (
              <p className="text-[10px] text-zinc-500 mt-2 px-1">{t('studio.video.framesHint')}</p>
            )}
          </div>
        )}

        {/* 5. Aspect Ratio Selector (Emojis) — скрыть для Kling Motion Control */}
        {selectedModel !== 'kling-mc' && (true || generationMode === 'text') && (
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
        {mediaType === 'video' && selectedModel === 'seedance-1.5-pro' && (
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

        {/* 5.3 Kling T2V/I2V Parameters */}
        {mediaType === 'video' && (selectedModel === 'kling-t2v' || selectedModel === 'kling-i2v') && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Duration */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.kling.duration')}</label>
                <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                  {(['5', '10'] as KlingDuration[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => { setKlingDuration(d); impact('light') }}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${klingDuration === d ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.kling.sound')}</label>
                <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                  <button
                    onClick={() => { setKlingSound(false); impact('light') }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${!klingSound ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <VolumeX size={12} />
                    {t('studio.video.audioOff')}
                  </button>
                  <button
                    onClick={() => { setKlingSound(true); impact('light') }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${klingSound ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <Volume2 size={12} />
                    {t('studio.video.audioOn')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5.4 Kling Motion Control Parameters */}
        {mediaType === 'video' && selectedModel === 'kling-mc' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
            {/* Step 1: Image — использует существующий image upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">1</span>
                {t('studio.kling.mc.uploadImage')}
              </label>
              <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>{t('studio.kling.mc.imageHint')}</span>
              </div>

              {/* Image Upload Area */}
              {uploadedImages[0] ? (
                <div className="border-2 border-dashed border-white/10 rounded-xl aspect-[4/3] bg-zinc-900/20 relative overflow-hidden">
                  <img src={uploadedImages[0]} alt="character-ref" className="w-full h-full object-cover" />
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
                          // Напрямую устанавливаем массив с фото (для MC нужно только 1 фото)
                          setUploadedImages([base64])
                        }
                      }
                      input.click()
                    }}
                    className="w-full py-4 rounded-xl border-2 border-dashed border-white/10 bg-zinc-900/50 text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-all flex items-center justify-center gap-2"
                  >
                    <ImageIcon size={20} />
                    <span>{t('studio.upload.selectPhoto')} 👇</span>
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
                            // Напрямую устанавливаем массив (для MC нужно только 1 фото)
                            setUploadedImages([base64])
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

            {/* Step 2: Character Orientation */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">2</span>
                {t('studio.kling.mc.orientation')}
              </label>
              <div className="flex items-start gap-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-300 text-xs">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>{t('studio.kling.mc.orientationHint')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setCharacterOrientation('image'); impact('light') }}
                  className={`p-3 rounded-xl border transition-all ${characterOrientation === 'image' ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/10 bg-zinc-900/50'}`}
                >
                  <ImageIcon size={20} className={`mx-auto mb-1 ${characterOrientation === 'image' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  <div className={`text-xs font-bold ${characterOrientation === 'image' ? 'text-white' : 'text-zinc-400'}`}>🖼 {t('studio.kling.mc.asImage')}</div>
                  <div className="text-[10px] text-zinc-500">{t('studio.kling.mc.asImageDesc1')}</div>
                  <div className="text-[10px] text-cyan-400/70">• {t('studio.kling.mc.max10s')}</div>
                </button>
                <button
                  onClick={() => { setCharacterOrientation('video'); impact('light') }}
                  className={`p-3 rounded-xl border transition-all ${characterOrientation === 'video' ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/10 bg-zinc-900/50'}`}
                >
                  <Video size={20} className={`mx-auto mb-1 ${characterOrientation === 'video' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  <div className={`text-xs font-bold ${characterOrientation === 'video' ? 'text-white' : 'text-zinc-400'}`}>🎬 {t('studio.kling.mc.asVideo')}</div>
                  <div className="text-[10px] text-zinc-500">{t('studio.kling.mc.asVideoDesc1')}</div>
                  <div className="text-[10px] text-cyan-400/70">• {t('studio.kling.mc.max30s')}</div>
                </button>
              </div>
            </div>

            {/* Step 3: Video Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">3</span>
                {t('studio.kling.mc.uploadVideo')}
              </label>
              <div className="flex items-start gap-2 p-2 bg-violet-500/10 border border-violet-500/20 rounded-lg text-violet-300 text-xs">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>{t('studio.kling.mc.videoHint')}</span>
              </div>

              <input
                type="file"
                accept="video/mp4,video/quicktime,video/mov"
                ref={videoInputRef}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  setIsUploadingVideo(true)
                  // Получить длительность видео
                  const video = document.createElement('video')
                  video.preload = 'metadata'
                  video.onloadedmetadata = () => {
                    const duration = Math.round(video.duration)
                    setVideoDurationSeconds(duration)

                    // Конвертировать в base64 для отправки
                    const reader = new FileReader()
                    reader.onload = () => {
                      setUploadedVideoUrl(reader.result as string)
                      setIsUploadingVideo(false)
                      // Валидация происходит в useEffect
                    }
                    reader.onerror = () => setIsUploadingVideo(false)
                    reader.readAsDataURL(file)
                  }
                  video.onerror = () => setIsUploadingVideo(false)
                  video.src = URL.createObjectURL(file)
                }}
              />

              <button
                onClick={() => videoInputRef.current?.click()}
                disabled={isUploadingVideo}
                className="w-full py-4 rounded-xl border-2 border-dashed border-white/10 bg-zinc-900/50 text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isUploadingVideo ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {t('studio.upload.loading')}
                  </>
                ) : (
                  <>
                    <Video size={20} />
                    {uploadedVideoUrl ? t('studio.kling.mc.changeVideo') : <>{t('studio.kling.mc.selectVideo')} 👇</>}
                  </>
                )}
              </button>

              {uploadedVideoUrl && (
                <div className={`flex items-center gap-2 p-2 rounded-lg border ${(characterOrientation === 'image' ? videoDurationSeconds <= 10 : videoDurationSeconds <= 30)
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                  <Video size={16} className={(characterOrientation === 'image' ? videoDurationSeconds <= 10 : videoDurationSeconds <= 30) ? 'text-green-400' : 'text-rose-400'} />
                  <div className="flex-1 flex flex-col">
                    <span className={`text-xs ${(characterOrientation === 'image' ? videoDurationSeconds <= 10 : videoDurationSeconds <= 30) ? 'text-green-200' : 'text-rose-200'}`}>
                      {videoDurationSeconds}s {t('studio.media.video', 'video')}
                    </span>
                    <span className="text-[10px] text-white/50">
                      {(characterOrientation === 'image' ? videoDurationSeconds <= 10 : videoDurationSeconds <= 30)
                        ? t('studio.kling.mc.validDuration')
                        : t('studio.kling.mc.invalidDuration')}
                    </span>
                  </div>
                  <button
                    onClick={() => { setUploadedVideoUrl(null); setVideoDurationSeconds(0); setError(null) }}
                    className="text-white/50 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Step 4: Quality */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">4</span>
                {t('studio.kling.mc.quality')}
              </label>
              <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                <button
                  onClick={() => { setKlingMCQuality('720p'); impact('light') }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${klingMCQuality === '720p' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  720p · 6⚡/{t('studio.kling.mc.perSec')}
                </button>
                <button
                  onClick={() => { setKlingMCQuality('1080p'); impact('light') }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${klingMCQuality === '1080p' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  1080p · 9⚡/{t('studio.kling.mc.perSec')}
                </button>
              </div>
            </div>

            {/* Step 5: Prompt (Optional) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/50 text-white flex items-center justify-center text-[10px]">5</span>
                {t('studio.kling.mc.optionalPrompt')}
                <span className="text-[10px] text-zinc-500 font-normal">({t('studio.kling.mc.optional')})</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('studio.kling.mc.promptPlaceholder')}
                className="w-full min-h-[80px] bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-3 text-white placeholder-zinc-500 text-sm resize-none focus:border-cyan-500/30 focus:outline-none transition-colors"
              />
              <div className="flex items-start gap-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-300 text-[10px]">
                <Info size={12} className="mt-0.5 shrink-0" />
                <span>{t('studio.kling.mc.promptHint')}</span>
              </div>
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


        {/* Active Generations Panel */}
        <ActiveGenerationsPanel onViewResult={handleViewGenerationResult} />

        {/* 6. Generate Button with Image Count Selector */}
        <div className="">
          <div className="flex gap-2">
            {/* Image Count Selector - only for images, not video */}
            {mediaType === 'image' && (() => {
              const maxAvailable = Math.min(4, Math.max(1, availableSlots)) as ImageCount

              return (
                <div className="relative">
                  <button
                    onClick={() => { setShowCountSelector(!showCountSelector); impact('light') }}
                    className="h-full px-4 rounded-xl bg-zinc-800 border border-white/10 text-white font-bold flex items-center gap-1.5 hover:bg-zinc-700 transition-colors min-w-[56px] justify-center"
                  >
                    <span className="text-lg">{Math.min(imageCount, maxAvailable)}</span>
                    <span className="text-[10px] text-zinc-400">×</span>
                  </button>

                  {/* Dropdown menu - opens upward */}
                  {showCountSelector && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowCountSelector(false)}
                      />
                      <div className="absolute bottom-full left-0 mb-2 bg-zinc-800 border border-white/10 rounded-xl overflow-hidden shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        {([1, 2, 3, 4] as ImageCount[]).map((count) => {
                          const isDisabled = count > availableSlots
                          return (
                            <button
                              key={count}
                              disabled={isDisabled}
                              onClick={() => {
                                if (!isDisabled) {
                                  setImageCount(count)
                                  setShowCountSelector(false)
                                  impact('light')
                                }
                              }}
                              className={`w-full px-5 py-2.5 text-sm font-medium flex items-center justify-center gap-1 transition-colors ${isDisabled
                                ? 'text-zinc-600 cursor-not-allowed'
                                : imageCount === count
                                  ? 'bg-violet-600 text-white'
                                  : 'text-zinc-300 hover:bg-zinc-700'
                                }`}
                            >
                              <span className="text-lg">{count}</span>
                              <span className="text-[10px] text-zinc-400">×</span>
                              {isDisabled && <span className="text-[9px] ml-1">🔒</span>}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={(!prompt.trim() && selectedModel !== 'kling-mc' && !(isPromptPrivate && parentGenerationId)) || (aspectRatio === 'Auto' && selectedModel !== 'kling-mc') || (generationMode === 'image' && uploadedImages.length === 0) || (selectedModel === 'kling-mc' && (!uploadedVideoUrl || (characterOrientation === 'image' && videoDurationSeconds > 10) || (characterOrientation === 'video' && videoDurationSeconds > 30)))}
              className="flex-1 py-6 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-[0.98] relative overflow-hidden group bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-violet-500/25 border border-white/10"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <div className="relative flex items-center gap-2">
                <Sparkles size={20} />
                <span>{t('studio.generate.button')}</span>
                <span className="bg-black/20 px-2 py-0.5 rounded text-xs font-normal ml-1">
                  {(() => {
                    let basePrice: number
                    if (selectedModel === 'seedance-1.5-pro') {
                      basePrice = calculateVideoCost(videoResolution, videoDuration, generateAudio)
                    } else if (['kling-t2v', 'kling-i2v'].includes(selectedModel)) {
                      basePrice = calculateKlingCost(klingVideoMode, klingDuration, klingSound)
                    } else if (selectedModel === 'kling-mc') {
                      basePrice = calculateKlingCost('motion-control', '5', false, klingMCQuality, videoDurationSeconds)
                    } else if (selectedModel === 'nanobanana-pro' && resolution === '2K') {
                      basePrice = 10
                    } else if (selectedModel === 'gpt-image-1.5') {
                      basePrice = GPT_IMAGE_PRICES[gptImageQuality]
                    } else {
                      basePrice = MODEL_PRICES[selectedModel]
                    }
                    const totalPrice = mediaType === 'video' ? basePrice : basePrice * imageCount
                    return `${totalPrice} ${t('studio.tokens')}`
                  })()}
                </span>
              </div>
            </Button>
          </div>
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
      <DescribeImageModal
        isOpen={isDescribeModalOpen}
        onClose={() => setIsDescribeModalOpen(false)}
        onPromptGenerated={(generatedPrompt) => {
          setPrompt(generatedPrompt)
        }}
      />

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


