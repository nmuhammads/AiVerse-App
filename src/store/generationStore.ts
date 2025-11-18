import { create } from 'zustand'

export type ModelType = 'flux' | 'seedream4' | 'nanobanana' | 'qwen-edit'

export type AspectRatio = '1:1' | '16:9' | '9:16'

export interface GenerationState {
  // Текущая выбранная модель
  selectedModel: ModelType
  // Промпт для генерации
  prompt: string
  // Загруженное изображение (для Qwen Edit)
  uploadedImage: string | null
  // Соотношение сторон
  aspectRatio: AspectRatio
  // Результат генерации
  generatedImage: string | null
  // Состояние загрузки
  isGenerating: boolean
  // Ошибка
  error: string | null
  // Текущий экран
  currentScreen: 'form' | 'result'
}

export interface GenerationActions {
  // Установить модель
  setSelectedModel: (model: ModelType) => void
  // Установить промпт
  setPrompt: (prompt: string) => void
  // Установить загруженное изображение
  setUploadedImage: (image: string | null) => void
  // Установить соотношение сторон
  setAspectRatio: (ratio: AspectRatio) => void
  // Установить результат
  setGeneratedImage: (image: string | null) => void
  // Установить состояние загрузки
  setIsGenerating: (isGenerating: boolean) => void
  // Установить ошибку
  setError: (error: string | null) => void
  // Переключить экран
  setCurrentScreen: (screen: 'form' | 'result') => void
  // Сбросить состояние
  reset: () => void
}

const initialState: GenerationState = {
  selectedModel: 'flux',
  prompt: '',
  uploadedImage: null,
  aspectRatio: '1:1',
  generatedImage: null,
  isGenerating: false,
  error: null,
  currentScreen: 'form'
}

export const useGenerationStore = create<GenerationState & GenerationActions>()(
  (set) => ({
    ...initialState,
    
    setSelectedModel: (model) => set({ selectedModel: model }),
    setPrompt: (prompt) => set({ prompt }),
    setUploadedImage: (image) => set({ uploadedImage: image }),
    setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
    setGeneratedImage: (image) => set({ generatedImage: image }),
    setIsGenerating: (isGenerating) => set({ isGenerating }),
    setError: (error) => set({ error }),
    setCurrentScreen: (screen) => set({ currentScreen: screen }),
    
    reset: () => set({
      prompt: '',
      uploadedImage: null,
      generatedImage: null,
      isGenerating: false,
      error: null,
      currentScreen: 'form'
    })
  })
)