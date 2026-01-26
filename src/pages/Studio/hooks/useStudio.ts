import { useRef, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useGenerationStore, type ModelType, type AspectRatio } from '@/store/generationStore'
import { useActiveGenerationsStore, MAX_ACTIVE_IMAGES } from '@/store/activeGenerationsStore'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'
import { compressImage } from '@/utils/imageCompression'
import {
    GPT_IMAGE_PRICES,
    VIDEO_PRICES,
    KLING_VIDEO_PRICES,
    KLING_MC_PRICES,
    MODEL_PRICES,
    calculateVideoCost,
    calculateKlingCost
} from '@/pages/Studio/constants'

export function useStudio() {
    const { t } = useTranslation()
    const {
        selectedModel,
        mediaType,
        prompt,
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
        studioMode,
        // Видео параметры
        videoDuration,
        videoResolution,
        fixedLens,
        generateAudio,
        setSelectedModel,
        setMediaType,
        setPrompt,
        setUploadedImages,
        addUploadedImage,
        removeUploadedImage,
        setAspectRatio,
        setGenerationMode,
        setGeneratedImage,
        setGeneratedVideo,
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
        setStudioMode,
    } = useGenerationStore()

    const { shareImage, saveToGallery, user, platform, tg } = useTelegram()
    const { impact, notify } = useHaptics()
    const navigate = useNavigate()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const videoInputRef = useRef<HTMLInputElement>(null)

    const [showBalancePopup, setShowBalancePopup] = useState(false)
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [balance, setBalance] = useState<number | null>(null)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [isMuted, setIsMuted] = useState(true)
    const [resolution, setResolution] = useState<'2K' | '4K'>('4K')
    const [searchParams] = useSearchParams()
    const [contestEntryId, setContestEntryId] = useState<number | null>(null)
    const [inputKey, setInputKey] = useState(0)
    const [showTimeoutModal, setShowTimeoutModal] = useState(false)
    const [showCountSelector, setShowCountSelector] = useState(false)
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [isUploadingVideo, setIsUploadingVideo] = useState(false)
    const [isOptimizing, setIsOptimizing] = useState(false)
    const [isDescribeModalOpen, setIsDescribeModalOpen] = useState(false)

    // Реактивно отслеживаем доступные слоты
    const availableSlots = useActiveGenerationsStore(
        (state) => MAX_ACTIVE_IMAGES - state.generations
            .filter((g) => g.status === 'processing')
            .reduce((sum, g) => sum + g.imageCount, 0)
    )

    // Kling Motion Control validation
    useEffect(() => {
        if (selectedModel === 'kling-mc' && uploadedVideoUrl && videoDurationSeconds > 0) {
            const maxDuration = characterOrientation === 'image' ? 10 : 30
            if (videoDurationSeconds > maxDuration) {
                setError(t('studio.kling.mc.durationError', { max: maxDuration, defaultValue: `Видео слишком длинное. Максимум: ${maxDuration} сек` }))
            } else {
                if (error?.includes('Видео слишком длинное')) {
                    setError(null)
                }
            }
        }
    }, [selectedModel, uploadedVideoUrl, videoDurationSeconds, characterOrientation, t, error, setError])

    // Handle iOS Face ID / app resume
    useEffect(() => {
        const handleActivated = () => {
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
    }, [user?.id, isPaymentModalOpen, isGenerating])

    // Handle Remix & Contest Entry
    useEffect(() => {
        const remixId = searchParams.get('remix')
        const contestEntry = searchParams.get('contest_entry')
        const mode = searchParams.get('mode')

        if (mode === 'chat') {
            setStudioMode('chat')
        } else if (mode === 'studio') {
            setStudioMode('studio')
        }

        if (contestEntry) {
            setContestEntryId(Number(contestEntry))
        }

        if (remixId) {
            console.log('[Remix] Starting fetch for remixId:', remixId)
            fetch(`/api/generation/${remixId}`)
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        setPrompt(data.prompt || '')
                        if (data.model) setSelectedModel(data.model as ModelType)
                        if (data.aspect_ratio && data.aspect_ratio !== '1:1') {
                            setAspectRatio(data.aspect_ratio as AspectRatio)
                        }
                        if (data.input_images && Array.isArray(data.input_images) && data.input_images.length > 0) {
                            setUploadedImages(data.input_images)
                            setGenerationMode('image')
                        }
                        if (data.media_type === 'video') {
                            setMediaType('video')
                            if (!data.model || data.model === 'seedance-1.5-pro') {
                                setSelectedModel('seedance-1.5-pro')
                            }
                        } else {
                            setMediaType('image')
                        }
                        setParentGeneration(data.id, data.users?.username || 'Unknown', !!data.is_prompt_private)
                    } else {
                        console.error('[Remix] API returned error:', data?.error)
                    }
                })
                .catch(err => console.error('[Remix] Failed to load remix data:', err))
        }
    }, [searchParams, setPrompt, setSelectedModel, setParentGeneration, setAspectRatio, setUploadedImages, setGenerationMode, setMediaType])

    // Default ratio logic
    useEffect(() => {
        if (parentGenerationId) return

        if (selectedModel === 'seedream4') {
            setAspectRatio('3:4')
        } else if (selectedModel === 'seedream4-5') {
            setAspectRatio('3:4')
        } else if (selectedModel === 'gpt-image-1.5') {
            setAspectRatio('2:3')
        } else if (selectedModel === 'nanobanana-pro' && aspectRatio === '16:21') {
            setAspectRatio('Auto')
        }
    }, [selectedModel, setAspectRatio, parentGenerationId, aspectRatio])

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

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
                    const reader = new FileReader()
                    reader.readAsDataURL(file)
                    reader.onload = (ev) => {
                        if (ev.target?.result) addUploadedImage(ev.target.result as string)
                    }
                }
            }

            newImages.forEach(img => addUploadedImage(img))
            if (newImages.length > 0) {
                setGenerationMode('image')
            }
            impact('light')
            setIsUploadingImage(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }

        processFiles().catch(() => setIsUploadingImage(false))
    }

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
        const { addGeneration, updateGeneration, removeGeneration, getAvailableSlots } = useActiveGenerationsStore.getState()
        const requestImageCount = mediaType === 'video' ? 1 : imageCount
        const availableSlots = getAvailableSlots()

        if (availableSlots < requestImageCount) {
            setError(t('activeGenerations.maxReached'))
            notify('error')
            return
        }

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
        setGeneratedImage(null)
        setGeneratedVideo(null)
        setGeneratedImages([])
        impact('medium')

        const generationId = addGeneration({
            prompt: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
            model: selectedModel,
            status: 'processing',
            mediaType,
            imageCount: requestImageCount
        })

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
            klingDuration,
            klingSound,
            klingMCQuality,
            characterOrientation,
            uploadedVideoUrl,
            videoDurationSeconds
        }

            // Async generation
            ; (async () => {
                const controller = new AbortController()
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

                    if (currentParams.selectedModel === 'seedance-1.5-pro') {
                        requestBody.video_duration = currentParams.videoDuration
                        requestBody.video_resolution = currentParams.videoResolution
                        requestBody.fixed_lens = currentParams.fixedLens
                        requestBody.generate_audio = currentParams.generateAudio
                    }

                    if (currentParams.selectedModel === 'kling-t2v' || currentParams.selectedModel === 'kling-i2v') {
                        requestBody.kling_duration = currentParams.klingDuration
                        requestBody.kling_sound = currentParams.klingSound
                    }

                    if (currentParams.selectedModel === 'kling-mc') {
                        requestBody.kling_mc_quality = currentParams.klingMCQuality
                        requestBody.character_orientation = currentParams.characterOrientation
                        requestBody.video_url = currentParams.uploadedVideoUrl
                        requestBody.video_duration_seconds = currentParams.videoDurationSeconds
                    }

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
                        removeGeneration(generationId)
                        notify('success')
                        toast.success(t('studio.generation.backgroundStarted', 'Запущено в фоне'))
                        return
                    }

                    if (!res.ok) {
                        throw new Error(data.error || t('studio.errors.generationError'))
                    }

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

                    try {
                        const modelName = currentParams.mediaType === 'video' ? 'Seedance Pro' : t(`studio.models.${currentParams.selectedModel}.name`)
                        const item = { id: Date.now(), url: data.image, prompt: currentParams.prompt, model: modelName, ratio: currentParams.aspectRatio, date: new Date().toLocaleDateString(), mediaType: currentParams.mediaType }
                        const prev = JSON.parse(localStorage.getItem('img_gen_history_v2') || '[]')
                        const next = [item, ...prev]
                        localStorage.setItem('img_gen_history_v2', JSON.stringify(next))
                    } catch { void 0 }

                    notify('success')

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

        setParentGeneration(null, null)
    }

    const handleViewGenerationResult = (gen: { imageUrl?: string; imageUrls?: string[]; videoUrl?: string; mediaType: 'image' | 'video' }) => {
        if (gen.mediaType === 'video' && gen.videoUrl) {
            setGeneratedVideo(gen.videoUrl)
            setGeneratedImage(null)
            setGeneratedImages([])
        } else if (gen.imageUrls && gen.imageUrls.length > 1) {
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

    // Result View Logic
    const hasMultipleImages = generatedImages.length > 1
    const isVideoResult = !!generatedVideo
    const resultUrl = isVideoResult
        ? generatedVideo
        : hasMultipleImages
            ? generatedImages[currentImageIndex] || generatedImages[0]
            : (generatedImage || '')

    useEffect(() => {
        if (currentScreen === 'result' && !generatedImage && !generatedVideo && generatedImages.length === 0) {
            console.warn('[Studio] Screen is "result" but no data present, resetting to form')
            setCurrentScreen('form')
        }
    }, [currentScreen, generatedImage, generatedVideo, generatedImages, setCurrentScreen])

    const hasResult = currentScreen === 'result' && !!resultUrl

    const handleCloseResult = () => {
        setCurrentScreen('form')
        setGeneratedImage(null)
        setGeneratedVideo(null)
        setGeneratedImages([])
        setCurrentImageIndex(0)
        setError(null)
    }

    const handleSaveResult = () => {
        const ext = isVideoResult ? 'mp4' : 'jpg'
        saveToGallery(resultUrl, `ai-${Date.now()}.${ext}`)
    }

    const handleSendToChat = async () => {
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
    }

    const handleEditResult = () => navigate(`/editor?image=${encodeURIComponent(resultUrl)}`)
    const handlePrevImage = () => {
        impact('light')
        setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : generatedImages.length - 1))
    }
    const handleNextImage = () => {
        impact('light')
        setCurrentImageIndex((prev) => (prev < generatedImages.length - 1 ? prev + 1 : 0))
    }
    const handleSelectImage = (index: number) => {
        impact('light')
        setCurrentImageIndex(index)
    }

    // Price Calculation
    const priceLabel = (() => {
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
    })()

    const isGenerateDisabled = (!prompt.trim() && selectedModel !== 'kling-mc' && !(isPromptPrivate && parentGenerationId))
        || (aspectRatio === 'Auto' && selectedModel !== 'kling-mc')
        || (generationMode === 'image' && uploadedImages.length === 0)
        || (selectedModel === 'kling-mc' && (!uploadedVideoUrl || (characterOrientation === 'image' && videoDurationSeconds > 10) || (characterOrientation === 'video' && videoDurationSeconds > 30)))

    return {
        // State
        t,
        platform,
        balance,
        selectedModel,
        mediaType,
        prompt,
        uploadedImages,
        uploadedVideoUrl,
        aspectRatio,
        generationMode,
        error,
        currentScreen,
        parentAuthorUsername,
        parentGenerationId,
        isPromptPrivate,
        showBalancePopup,
        showTimeoutModal,
        showCountSelector,
        isPaymentModalOpen,
        isFullScreen,
        isMuted,
        isOptimizing,
        isDescribeModalOpen,
        isUploadingImage,
        isUploadingVideo,
        availableSlots,
        priceLabel,
        isGenerateDisabled,
        inputKey,

        // Refs
        fileInputRef,
        cameraInputRef,
        videoInputRef,

        // Result State
        hasResult,
        resultUrl,
        isVideoResult,
        hasMultipleImages,
        generatedImages,
        currentImageIndex,

        // Setters
        setShowBalancePopup,
        setIsPaymentModalOpen,
        setShowTimeoutModal,
        setShowCountSelector,
        setIsFullScreen,
        setIsMuted,
        setIsDescribeModalOpen,
        setIsUploadingVideo,

        setPrompt,
        setMediaType,
        setSelectedModel,
        setGenerationMode,
        setUploadedImages,
        addUploadedImage,
        removeUploadedImage,
        setUploadedVideoUrl,
        setAspectRatio,
        setError,
        setImageCount,
        setVideoDuration,
        setVideoResolution,
        setFixedLens,
        setGenerateAudio,
        setKlingVideoMode,
        setKlingDuration,
        setKlingSound,
        setKlingMCQuality,
        setCharacterOrientation,
        setVideoDurationSeconds,
        setResolution,
        setGptImageQuality,
        setParentGeneration,

        // Handlers
        impact,
        navigate,
        handleGenerate,
        handleOptimizePrompt,
        handleImageUpload,
        processPastedFiles,
        handleViewGenerationResult,

        // Result Handlers
        handleCloseResult,
        handleSaveResult,
        handleSendToChat,
        handleEditResult,
        handlePrevImage,
        handleNextImage,
        handleSelectImage,

        // Additional data for sub-components (Settings, etc)
        gptImageQuality,
        resolution,
        videoDuration,
        videoResolution,
        fixedLens,
        generateAudio,
        klingDuration,
        klingSound,
        klingMCQuality,
        characterOrientation,
        videoDurationSeconds,
        klingVideoMode,
        imageCount,
        studioMode,
        setStudioMode,
    }
}
