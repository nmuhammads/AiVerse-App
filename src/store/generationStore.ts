import { create } from 'zustand'

export type ModelType = 'nanobanana-pro' | 'seedream4' | 'nanobanana' | 'seedream4-5' | 'p-image-edit' | 'seedance-1.5-pro' | 'gpt-image-1.5' | 'test-model' | 'kling-t2v' | 'kling-i2v' | 'kling-mc'

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '16:21' | 'Auto' | 'square_hd' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9' | '2:3' | '3:2'

export type MediaType = 'image' | 'video'

export type VideoDuration = '4' | '8' | '12'

export type VideoResolution = '480p' | '720p'

export type GptImageQuality = 'medium' | 'high'

export type ImageCount = 1 | 2 | 3 | 4

// === Типы для Kling AI ===
export type KlingVideoMode = 't2v' | 'i2v' | 'motion-control'
export type KlingDuration = '5' | '10'
export type KlingMCQuality = '720p' | '1080p'
export type CharacterOrientation = 'image' | 'video'

export interface GenerationState {
  // Текущая выбранная модель
  selectedModel: ModelType
  // Тип медиа: изображение или видео
  mediaType: MediaType
  // Промпт для генерации
  prompt: string
  // Негативный промпт (для Qwen)
  negativePrompt: string
  // Загруженные изображения
  uploadedImages: string[]
  // Соотношение сторон
  aspectRatio: AspectRatio
  // Режим генерации
  generationMode: 'text' | 'image'
  // Результат генерации (изображение)
  generatedImage: string | null
  // Результат генерации (видео)
  generatedVideo: string | null
  // Состояние загрузки
  isGenerating: boolean
  // Ошибка
  error: string | null
  // Количество генерируемых изображений (1-4)
  imageCount: ImageCount
  // Массив сгенерированных изображений (для множественной генерации)
  generatedImages: string[]
  // ID родительской генерации (для ремиксов)
  parentGenerationId: number | null
  // Имя автора родительской генерации
  parentAuthorUsername: string | null
  // Флаг приватности промпта родительской генерации (для слепого ремикса)
  isPromptPrivate: boolean
  // Текущий экран
  currentScreen: 'form' | 'result'

  // === Параметры для видео (Seedance 1.5 Pro) ===
  // Длительность видео (секунды)
  videoDuration: VideoDuration
  // Разрешение видео
  videoResolution: VideoResolution
  // Статичная камера (true) или динамичная (false)
  fixedLens: boolean
  // Генерация аудио (удваивает стоимость!)
  generateAudio: boolean

  // === Параметры для GPT Image 1.5 ===
  // Качество генерации (medium=5 токенов, high=15 токенов)
  gptImageQuality: GptImageQuality

  // === Параметры для Kling AI ===
  // Режим генерации Kling (T2V, I2V, Motion Control)
  klingVideoMode: KlingVideoMode
  // Длительность видео Kling (5 или 10 секунд)
  klingDuration: KlingDuration
  // Генерация звука для Kling
  klingSound: boolean
  // Качество Motion Control (720p или 1080p)
  klingMCQuality: KlingMCQuality
  // Ориентация персонажа (как на фото или как в видео)
  characterOrientation: CharacterOrientation
  // URL загруженного референсного видео (для Motion Control)
  uploadedVideoUrl: string | null
  // Длительность загруженного видео в секундах
  videoDurationSeconds: number
}

export interface GenerationActions {
  // Установить модель
  setSelectedModel: (model: ModelType) => void
  // Установить тип медиа
  setMediaType: (type: MediaType) => void
  // Установить промпт
  setPrompt: (prompt: string) => void
  // Установить негативный промпт
  setNegativePrompt: (prompt: string) => void
  // Установить загруженные изображения
  setUploadedImages: (images: string[]) => void
  // Добавить изображение
  addUploadedImage: (image: string) => void
  // Удалить изображение по индексу
  removeUploadedImage: (index: number) => void
  // Установить соотношение сторон
  setAspectRatio: (ratio: AspectRatio) => void
  // Установить режим генерации
  setGenerationMode: (mode: 'text' | 'image') => void
  // Установить результат (изображение)
  setGeneratedImage: (image: string | null) => void
  // Установить результат (видео)
  setGeneratedVideo: (video: string | null) => void
  // Установить состояние загрузки
  setIsGenerating: (isGenerating: boolean) => void
  // Установить ошибку
  setError: (error: string | null) => void
  // Установить количество изображений
  setImageCount: (count: ImageCount) => void
  // Установить массив сгенерированных изображений
  setGeneratedImages: (images: string[]) => void
  // Переключить экран
  setCurrentScreen: (screen: 'form' | 'result') => void
  // Установить родительскую генерацию
  setParentGeneration: (id: number | null, username: string | null, isPrivate?: boolean) => void

  // === Actions для видео ===
  // Установить длительность видео
  setVideoDuration: (duration: VideoDuration) => void
  // Установить разрешение видео
  setVideoResolution: (resolution: VideoResolution) => void
  // Установить режим камеры
  setFixedLens: (fixed: boolean) => void
  // Установить генерацию аудио
  setGenerateAudio: (generate: boolean) => void

  // === Actions для GPT Image 1.5 ===
  // Установить качество генерации
  setGptImageQuality: (quality: GptImageQuality) => void

  // === Actions для Kling AI ===
  // Установить режим Kling
  setKlingVideoMode: (mode: KlingVideoMode) => void
  // Установить длительность Kling
  setKlingDuration: (duration: KlingDuration) => void
  // Установить звук Kling
  setKlingSound: (sound: boolean) => void
  // Установить качество Motion Control
  setKlingMCQuality: (quality: KlingMCQuality) => void
  // Установить ориентацию персонажа
  setCharacterOrientation: (orientation: CharacterOrientation) => void
  // Установить URL загруженного видео
  setUploadedVideoUrl: (url: string | null) => void
  // Установить длительность загруженного видео
  setVideoDurationSeconds: (seconds: number) => void

  // Сбросить состояние
  reset: () => void
}

const initialState: GenerationState = {
  selectedModel: 'nanobanana-pro',
  mediaType: 'image',
  prompt: '',
  negativePrompt: '',
  uploadedImages: [],
  aspectRatio: '1:1',
  generationMode: 'text',
  generatedImage: null,
  generatedVideo: null,
  isGenerating: false,
  error: null,
  currentScreen: 'form',
  parentGenerationId: null,
  parentAuthorUsername: null,
  isPromptPrivate: false,
  imageCount: 1,
  generatedImages: [],
  // Видео параметры по умолчанию (первые пункты)
  videoDuration: '4',
  videoResolution: '480p',
  fixedLens: true,
  generateAudio: false,
  // GPT Image 1.5 параметры
  gptImageQuality: 'medium',
  // Kling AI параметры
  klingVideoMode: 't2v',
  klingDuration: '5',
  klingSound: false,
  klingMCQuality: '720p',
  characterOrientation: 'video',
  uploadedVideoUrl: null,
  videoDurationSeconds: 0
}

export const useGenerationStore = create<GenerationState & GenerationActions>()(
  (set) => ({
    ...initialState,

    setSelectedModel: (model) => set({ selectedModel: model }),
    setMediaType: (type) => set({ mediaType: type }),
    setPrompt: (prompt) => set({ prompt }),
    setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
    setUploadedImages: (images) => set({ uploadedImages: images }),
    addUploadedImage: (image) => set((state) => ({ uploadedImages: [...state.uploadedImages, image] })),
    removeUploadedImage: (index) => set((state) => ({ uploadedImages: state.uploadedImages.filter((_, i) => i !== index) })),
    setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
    setGenerationMode: (mode) => set({ generationMode: mode }),
    setGeneratedImage: (image) => set({ generatedImage: image }),
    setGeneratedVideo: (video) => set({ generatedVideo: video }),
    setIsGenerating: (isGenerating) => set({ isGenerating }),
    setError: (error) => set({ error }),
    setImageCount: (count) => set({ imageCount: count }),
    setGeneratedImages: (images) => set({ generatedImages: images }),
    setCurrentScreen: (screen) => set({ currentScreen: screen }),
    setParentGeneration: (id, username, isPrivate = false) => set({ parentGenerationId: id, parentAuthorUsername: username, isPromptPrivate: isPrivate }),

    // Видео actions
    setVideoDuration: (duration) => set({ videoDuration: duration }),
    setVideoResolution: (resolution) => set({ videoResolution: resolution }),
    setFixedLens: (fixed) => set({ fixedLens: fixed }),
    setGenerateAudio: (generate) => set({ generateAudio: generate }),

    // GPT Image 1.5 actions
    setGptImageQuality: (quality) => set({ gptImageQuality: quality }),

    // Kling AI actions
    setKlingVideoMode: (mode) => set({ klingVideoMode: mode }),
    setKlingDuration: (duration) => set({ klingDuration: duration }),
    setKlingSound: (sound) => set({ klingSound: sound }),
    setKlingMCQuality: (quality) => set({ klingMCQuality: quality }),
    setCharacterOrientation: (orientation) => set({ characterOrientation: orientation }),
    setUploadedVideoUrl: (url) => set({ uploadedVideoUrl: url }),
    setVideoDurationSeconds: (seconds) => set({ videoDurationSeconds: seconds }),

    reset: () => set({
      prompt: '',
      negativePrompt: '',
      uploadedImages: [],
      generationMode: 'text',
      generatedImage: null,
      generatedVideo: null,
      isGenerating: false,
      error: null,
      currentScreen: 'form',
      parentGenerationId: null,
      parentAuthorUsername: null,
      isPromptPrivate: false,
      imageCount: 1,
      generatedImages: [],
      videoDuration: '8',
      videoResolution: '720p',
      fixedLens: false,
      generateAudio: false,
      gptImageQuality: 'medium',
      // Kling reset
      klingVideoMode: 't2v',
      klingDuration: '5',
      klingSound: false,
      klingMCQuality: '720p',
      characterOrientation: 'video',
      uploadedVideoUrl: null,
      videoDurationSeconds: 0
    })
  })
)

