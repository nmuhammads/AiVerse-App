import { create } from 'zustand'
import { ModelType, AspectRatio, GptImageQuality } from './generationStore'

// Конфигурация отдельной модели в мульти-генерации
export interface ModelConfig {
    modelId: ModelType
    aspectRatio: AspectRatio
    resolution?: '2K' | '4K'           // Для NanoBanana Pro
    gptImageQuality?: GptImageQuality  // Для GPT Image 1.5
    status: 'idle' | 'generating' | 'success' | 'error'
    result: string | null              // URL изображения
    error: string | null               // Сообщение об ошибке
    generationId?: number              // ID записи в БД
}

// Цены моделей (дублируем для расчёта на фронте)
const MODEL_PRICES: Record<ModelType, number> = {
    nanobanana: 3,
    'nanobanana-pro': 15,
    seedream4: 4,
    'seedream4-5': 7,
    'p-image-edit': 2,
    'seedance-1.5-pro': 42,
    'gpt-image-1.5': 5,
    'test-model': 0,
    'kling-t2v': 55,
    'kling-i2v': 55,
    'kling-mc': 30,
}

// Цены GPT Image по качеству
const GPT_IMAGE_PRICES: Record<GptImageQuality, number> = {
    medium: 5,
    high: 15,
}

// Поддерживаемые соотношения сторон для каждой модели
export const SUPPORTED_RATIOS: Record<ModelType, AspectRatio[]> = {
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

// Дефолтные соотношения для моделей
const DEFAULT_RATIOS: Record<ModelType, AspectRatio> = {
    'nanobanana-pro': 'Auto',
    seedream4: '3:4',
    nanobanana: 'Auto',
    'seedream4-5': '3:4',
    'p-image-edit': 'Auto',
    'seedance-1.5-pro': '16:9',
    'gpt-image-1.5': '2:3',
    'test-model': '1:1',
    'kling-t2v': '16:9',
    'kling-i2v': '16:9',
    'kling-mc': '16:9',
}

export interface MultiGenerationState {
    // Выбранные модели (до 3х)
    selectedModels: ModelConfig[]

    // Общий промпт
    prompt: string

    // Загруженные референсы
    uploadedImages: string[]

    // Режим генерации (T2I / I2I)
    generationMode: 'text' | 'image'

    // Флаг что хотя бы одна модель в процессе генерации
    isGenerating: boolean
}

export interface MultiGenerationActions {
    // Переключить модель (добавить/удалить)
    toggleModel: (modelId: ModelType) => boolean

    // Проверить выбрана ли модель
    isModelSelected: (modelId: ModelType) => boolean

    // Обновить параметры модели
    updateModelConfig: (modelId: ModelType, config: Partial<ModelConfig>) => void

    // Установить промпт
    setPrompt: (prompt: string) => void

    // Управление референсами
    setUploadedImages: (images: string[]) => void
    addUploadedImage: (image: string) => void
    removeUploadedImage: (index: number) => void

    // Установить режим генерации
    setGenerationMode: (mode: 'text' | 'image') => void

    // Начать генерацию — устанавливает все модели в 'generating'
    startGeneration: () => void

    // Установить результат для конкретной модели
    setModelResult: (modelId: ModelType, result: string | null, error: string | null, generationId?: number) => void

    // Подсчитать общую стоимость
    calculateTotalCost: () => number

    // Получить цену модели
    getModelPrice: (modelId: ModelType, gptQuality?: GptImageQuality, resolution?: string) => number

    // Сброс состояния
    reset: () => void

    // Сброс только результатов (оставить выбранные модели)
    resetResults: () => void
}

const initialState: MultiGenerationState = {
    selectedModels: [],
    prompt: '',
    uploadedImages: [],
    generationMode: 'text',
    isGenerating: false,
}

export const useMultiGenerationStore = create<MultiGenerationState & MultiGenerationActions>()(
    (set, get) => ({
        ...initialState,

        toggleModel: (modelId: ModelType) => {
            const { selectedModels } = get()
            const existingIndex = selectedModels.findIndex(m => m.modelId === modelId)

            if (existingIndex >= 0) {
                // Удалить модель
                set({
                    selectedModels: selectedModels.filter(m => m.modelId !== modelId)
                })
                return true
            } else {
                // Добавить модель (если < 3)
                if (selectedModels.length >= 3) {
                    return false // Лимит достигнут
                }

                const newModel: ModelConfig = {
                    modelId,
                    aspectRatio: DEFAULT_RATIOS[modelId] || '1:1',
                    resolution: modelId === 'nanobanana-pro' ? '4K' : undefined,
                    gptImageQuality: modelId === 'gpt-image-1.5' ? 'medium' : undefined,
                    status: 'idle',
                    result: null,
                    error: null,
                }

                set({
                    selectedModels: [...selectedModels, newModel]
                })
                return true
            }
        },

        isModelSelected: (modelId: ModelType) => {
            return get().selectedModels.some(m => m.modelId === modelId)
        },

        updateModelConfig: (modelId: ModelType, config: Partial<ModelConfig>) => {
            set(state => ({
                selectedModels: state.selectedModels.map(m =>
                    m.modelId === modelId ? { ...m, ...config } : m
                )
            }))
        },

        setPrompt: (prompt: string) => set({ prompt }),

        setUploadedImages: (images: string[]) => set({ uploadedImages: images }),

        addUploadedImage: (image: string) => set(state => ({
            uploadedImages: [...state.uploadedImages, image]
        })),

        removeUploadedImage: (index: number) => set(state => ({
            uploadedImages: state.uploadedImages.filter((_, i) => i !== index)
        })),

        setGenerationMode: (mode: 'text' | 'image') => {
            set({ generationMode: mode })
            // Очистить референсы при переключении на T2I
            if (mode === 'text') {
                set({ uploadedImages: [] })
            }
        },

        startGeneration: () => {
            set(state => ({
                isGenerating: true,
                selectedModels: state.selectedModels.map(m => ({
                    ...m,
                    status: 'generating' as const,
                    result: null,
                    error: null,
                }))
            }))
        },

        setModelResult: (modelId: ModelType, result: string | null, error: string | null, generationId?: number) => {
            set(state => {
                const updatedModels = state.selectedModels.map(m =>
                    m.modelId === modelId
                        ? {
                            ...m,
                            status: (error ? 'error' : 'success') as 'error' | 'success',
                            result,
                            error,
                            generationId,
                        }
                        : m
                )

                // Проверить, все ли модели завершили генерацию
                const stillGenerating = updatedModels.some(m => m.status === 'generating')

                return {
                    selectedModels: updatedModels,
                    isGenerating: stillGenerating,
                }
            })
        },

        getModelPrice: (modelId: ModelType, gptQuality?: GptImageQuality, resolution?: string) => {
            if (modelId === 'gpt-image-1.5') {
                return GPT_IMAGE_PRICES[gptQuality || 'medium']
            }
            if (modelId === 'nanobanana-pro' && resolution === '2K') {
                return 10
            }
            return MODEL_PRICES[modelId] || 0
        },

        calculateTotalCost: () => {
            const { selectedModels, getModelPrice } = get()
            return selectedModels.reduce((total, m) => {
                return total + getModelPrice(m.modelId, m.gptImageQuality, m.resolution)
            }, 0)
        },

        reset: () => set(initialState),

        resetResults: () => {
            set(state => ({
                selectedModels: state.selectedModels.map(m => ({
                    ...m,
                    status: 'idle' as const,
                    result: null,
                    error: null,
                    generationId: undefined,
                })),
                isGenerating: false,
            }))
        },
    })
)
