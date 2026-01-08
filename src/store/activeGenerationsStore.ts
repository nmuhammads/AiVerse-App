import { create } from 'zustand'
import type { ModelType } from './generationStore'

export interface ActiveGeneration {
    id: string
    prompt: string
    model: ModelType
    status: 'processing' | 'completed' | 'error'
    startedAt: number
    imageUrl?: string         // Первое изображение (для обратной совместимости)
    imageUrls?: string[]      // Все изображения при 2x/3x/4x генерации
    videoUrl?: string
    error?: string
    mediaType: 'image' | 'video'
    imageCount: number // Количество изображений в этой генерации
}

interface ActiveGenerationsState {
    generations: ActiveGeneration[]
}

interface ActiveGenerationsActions {
    addGeneration: (gen: Omit<ActiveGeneration, 'id' | 'startedAt'>) => string
    updateGeneration: (id: string, updates: Partial<ActiveGeneration>) => void
    removeGeneration: (id: string) => void
    getActiveImageCount: () => number
    getAvailableSlots: () => number
    clearCompleted: () => void
}

// Максимум 4 изображения параллельно
const MAX_ACTIVE_IMAGES = 4

export const useActiveGenerationsStore = create<ActiveGenerationsState & ActiveGenerationsActions>()(
    (set, get) => ({
        generations: [],

        addGeneration: (gen) => {
            const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
            set((state) => ({
                generations: [
                    { ...gen, id, startedAt: Date.now() },
                    ...state.generations
                ].slice(0, 10) // Keep some extra for completed
            }))
            return id
        },

        updateGeneration: (id, updates) => {
            set((state) => ({
                generations: state.generations.map((g) =>
                    g.id === id ? { ...g, ...updates } : g
                )
            }))
        },

        removeGeneration: (id) => {
            set((state) => ({
                generations: state.generations.filter((g) => g.id !== id)
            }))
        },

        // Подсчитывает общее количество изображений в активных генерациях
        getActiveImageCount: () => {
            return get().generations
                .filter((g) => g.status === 'processing')
                .reduce((sum, g) => sum + g.imageCount, 0)
        },

        // Возвращает количество доступных слотов для новых изображений
        getAvailableSlots: () => {
            const activeCount = get().getActiveImageCount()
            return Math.max(0, MAX_ACTIVE_IMAGES - activeCount)
        },

        clearCompleted: () => {
            set((state) => ({
                generations: state.generations.filter((g) => g.status === 'processing')
            }))
        }
    })
)

export { MAX_ACTIVE_IMAGES }

