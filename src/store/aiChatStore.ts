/**
 * AI Chat Store
 * Управление состоянием чата с ИИ
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ChatModel =
    | 'deepseek/deepseek-v3.2'
    | 'zai-org/glm-4.7'
    | 'minimax/minimax-m2.1'
    | 'Qwen/Qwen3-235B-A22B'
    | 'openai/gpt-oss-20b'
    | 'openai/gpt-oss-120b'

export type ImageModel = 'z-image-turbo' | 'qwen-image'

export interface PendingImageGeneration {
    prompt: string
    model: ImageModel
    size: string
    cost: number
}

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    // Для изображений
    imageUrl?: string
    imagePrompt?: string
    isGenerating?: boolean
}

interface AIChatState {
    isOpen: boolean
    isMinimized: boolean
    messages: ChatMessage[]
    selectedModel: ChatModel
    isLoading: boolean
    // Для генерации изображений
    pendingGeneration: PendingImageGeneration | null
    isGeneratingImage: boolean

    openChat: () => void
    closeChat: () => void
    minimizeChat: () => void
    restoreChat: () => void
    addMessage: (role: 'user' | 'assistant', content: string) => string
    addImageMessage: (imageUrl: string, prompt: string) => string
    updateMessage: (id: string, content: string) => void
    clearMessages: () => void
    setModel: (model: ChatModel) => void
    setLoading: (loading: boolean) => void
    // Для генерации изображений
    setPendingGeneration: (pending: PendingImageGeneration | null) => void
    setGeneratingImage: (generating: boolean) => void
}

export const useAIChatStore = create<AIChatState>()(
    persist(
        (set, get) => ({
            isOpen: false,
            isMinimized: false,
            messages: [],
            selectedModel: 'openai/gpt-oss-120b',
            isLoading: false,
            pendingGeneration: null,
            isGeneratingImage: false,

            openChat: () => set({ isOpen: true, isMinimized: false }),

            closeChat: () => set({ isOpen: false, isMinimized: false }),

            minimizeChat: () => set({ isOpen: false, isMinimized: true }),

            restoreChat: () => set({ isOpen: true, isMinimized: false }),

            addMessage: (role, content) => {
                const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
                set(state => ({
                    messages: [...state.messages, {
                        id,
                        role,
                        content,
                        timestamp: Date.now()
                    }]
                }))
                return id
            },

            addImageMessage: (imageUrl, prompt) => {
                const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
                set(state => ({
                    messages: [...state.messages, {
                        id,
                        role: 'assistant',
                        content: '',
                        timestamp: Date.now(),
                        imageUrl,
                        imagePrompt: prompt
                    }]
                }))
                return id
            },

            updateMessage: (id, content) => {
                set(state => ({
                    messages: state.messages.map(msg =>
                        msg.id === id ? { ...msg, content } : msg
                    )
                }))
            },

            clearMessages: () => set({ messages: [], pendingGeneration: null }),

            setModel: (model) => set({ selectedModel: model }),

            setLoading: (loading) => set({ isLoading: loading }),

            setPendingGeneration: (pending) => set({ pendingGeneration: pending }),

            setGeneratingImage: (generating) => set({ isGeneratingImage: generating })
        }),
        {
            name: 'aiverse-chat',
            partialize: (state) => ({
                messages: state.messages.slice(-50), // Храним последние 50 сообщений
                selectedModel: state.selectedModel,
                isMinimized: state.isMinimized
            })
        }
    )
)

// Селекторы
export const selectIsOpen = (state: AIChatState) => state.isOpen
export const selectIsMinimized = (state: AIChatState) => state.isMinimized
export const selectMessages = (state: AIChatState) => state.messages
export const selectModel = (state: AIChatState) => state.selectedModel
export const selectIsLoading = (state: AIChatState) => state.isLoading
