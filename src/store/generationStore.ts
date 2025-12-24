import { create } from 'zustand'

export type ModelType = 'nanobanana-pro' | 'seedream4' | 'nanobanana' | 'seedream4-5' | 'p-image-edit'

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '16:21' | 'Auto' | 'square_hd' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9'

export interface GenerationState {
  // Текущая выбранная модель
  selectedModel: ModelType
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
  // Результат генерации
  generatedImage: string | null
  // Состояние загрузки
  isGenerating: boolean
  // Ошибка
  error: string | null
  // ID родительской генерации (для ремиксов)
  parentGenerationId: number | null
  // Имя автора родительской генерации
  parentAuthorUsername: string | null
  // Текущий экран
  currentScreen: 'form' | 'result'
}

export interface GenerationActions {
  // Установить модель
  setSelectedModel: (model: ModelType) => void
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
  // Установить результат
  setGeneratedImage: (image: string | null) => void
  // Установить состояние загрузки
  setIsGenerating: (isGenerating: boolean) => void
  // Установить ошибку
  setError: (error: string | null) => void
  // Переключить экран
  setCurrentScreen: (screen: 'form' | 'result') => void
  // Установить родительскую генерацию
  setParentGeneration: (id: number | null, username: string | null) => void
  // Сбросить состояние
  reset: () => void
}

const initialState: GenerationState = {
  selectedModel: 'nanobanana-pro',
  prompt: '',
  negativePrompt: '',
  uploadedImages: [],
  aspectRatio: 'Auto',
  generationMode: 'text',
  generatedImage: null,
  isGenerating: false,
  error: null,
  currentScreen: 'form',
  parentGenerationId: null,
  parentAuthorUsername: null
}

export const useGenerationStore = create<GenerationState & GenerationActions>()(
  (set) => ({
    ...initialState,

    setSelectedModel: (model) => set({ selectedModel: model }),
    setPrompt: (prompt) => set({ prompt }),
    setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
    setUploadedImages: (images) => set({ uploadedImages: images }),
    addUploadedImage: (image) => set((state) => ({ uploadedImages: [...state.uploadedImages, image] })),
    removeUploadedImage: (index) => set((state) => ({ uploadedImages: state.uploadedImages.filter((_, i) => i !== index) })),
    setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
    setGenerationMode: (mode) => set({ generationMode: mode }),
    setGeneratedImage: (image) => set({ generatedImage: image }),
    setIsGenerating: (isGenerating) => set({ isGenerating }),
    setError: (error) => set({ error }),
    setCurrentScreen: (screen) => set({ currentScreen: screen }),
    setParentGeneration: (id, username) => set({ parentGenerationId: id, parentAuthorUsername: username }),

    reset: () => set({
      prompt: '',
      negativePrompt: '',
      uploadedImages: [],
      generationMode: 'text',
      generatedImage: null,
      isGenerating: false,
      error: null,
      currentScreen: 'form',
      parentGenerationId: null,
      parentAuthorUsername: null
    })
  })
)
