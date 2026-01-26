/**
 * AI Chat Store
 * Управление состоянием чата с ИИ
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ChatModel =
    | 'deepseek/deepseek-v3.2'
    | 'zai-org/glm-4.7'
    | 'minimax/minimax-m2.1'
    | 'Qwen/Qwen3-235B-A22B'
    | 'openai/gpt-oss-20b'
    | 'openai/gpt-oss-120b'

export type ImageModel = 'z-image-turbo' | 'qwen-image' | 'qwen-image-plus'

export interface PendingImageGeneration {
    prompt: string
    model: ImageModel
    size: string
    cost: number
    image?: string
}

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
    timestamp: number
    // Для изображений
    imageUrl?: string
    imagePrompt?: string
    isGenerating?: boolean
}

export interface ChatSession {
    id: string
    title: string
    messages: ChatMessage[]
    createdAt: number
    updatedAt: number
}

interface AIChatState {
    isOpen: boolean
    isMinimized: boolean

    // Multi-chat state
    sessions: ChatSession[]
    activeSessionId: string | null

    selectedModel: ChatModel
    selectedImageModel: ImageModel
    isLoading: boolean
    pendingGeneration: PendingImageGeneration | null
    isGeneratingImage: boolean

    // Computeds (helper to get current messages)
    // We sadly can't have getters on the state object easily with simple zustand usage without middleware
    // So we will select messages dynamically or keep a sync

    openChat: () => void
    closeChat: () => void
    minimizeChat: () => void
    restoreChat: () => void

    // Chat Management
    createSession: () => string
    deleteSession: (id: string) => void
    switchSession: (id: string) => void
    renameSession: (id: string, newTitle: string) => void

    addMessage: (role: 'user' | 'assistant', content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>) => string
    addImageMessage: (imageUrl: string, prompt: string) => string
    updateMessage: (id: string, content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>) => void
    clearMessages: () => void // Clear CURRENT chat messages
    setModel: (model: ChatModel) => void
    setImageModel: (model: ImageModel) => void
    setLoading: (loading: boolean) => void
    setPendingGeneration: (pending: PendingImageGeneration | null) => void
    setGeneratingImage: (generating: boolean) => void
}

const safeLocalStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key)
        } catch (e) {
            console.error('Failed to get item from localStorage:', e)
            return null
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value)
        } catch (e) {
            console.error('Failed to set item in localStorage:', e)
            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                console.warn('LocalStorage quota exceeded. Preventing crash.')
            }
        }
    },
    removeItem: (key: string): void => {
        try {
            localStorage.removeItem(key)
        } catch (e) {
            console.error('Failed to remove item from localStorage:', e)
        }
    },
}

export const useAIChatStore = create<AIChatState>()(
    persist(
        (set, get) => ({
            isOpen: false,
            isMinimized: false,

            sessions: [],
            activeSessionId: null,

            selectedModel: 'Qwen/Qwen3-235B-A22B',
            selectedImageModel: 'qwen-image' as ImageModel,
            isLoading: false,
            pendingGeneration: null,
            isGeneratingImage: false,

            openChat: () => {
                const state = get()
                if (state.sessions.length === 0) {
                    state.createSession()
                }
                set({ isOpen: true, isMinimized: false })
            },

            closeChat: () => set({ isOpen: false, isMinimized: false }),

            minimizeChat: () => set({ isOpen: false, isMinimized: true }),

            restoreChat: () => set({ isOpen: true, isMinimized: false }),

            createSession: () => {
                const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
                const newSession: ChatSession = {
                    id,
                    title: 'Новый чат',
                    messages: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }
                set(state => ({
                    sessions: [newSession, ...state.sessions],
                    activeSessionId: id,
                    messages: [] // Clear legacy messages view if any exists (compatibility fix handled in persist onRehydrate normally, but here we just manage sessions)
                }))
                return id
            },

            deleteSession: (id) => {
                set(state => {
                    const newSessions = state.sessions.filter(s => s.id !== id)
                    // If we deleted the active session, switch to the first one available, or create new
                    let newActiveId = state.activeSessionId
                    if (state.activeSessionId === id) {
                        newActiveId = newSessions.length > 0 ? newSessions[0].id : null
                    }

                    // If we deleted the last session, create a new one immediately if chat is open? 
                    // Or allow empty state. Let's allow empty state but create on next action.

                    return {
                        sessions: newSessions,
                        activeSessionId: newActiveId
                    }
                })
            },

            switchSession: (id) => set({ activeSessionId: id }),

            renameSession: (id, newTitle) => set(state => ({
                sessions: state.sessions.map(s => s.id === id ? { ...s, title: newTitle } : s)
            })),

            addMessage: (role, content) => {
                const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
                set(state => {
                    let { activeSessionId, sessions } = state

                    // Auto-create session if none exists
                    if (!activeSessionId || sessions.length === 0) {
                        const newId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
                        activeSessionId = newId
                        sessions = [{
                            id: newId,
                            title: 'Новый чат',
                            messages: [],
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        }, ...sessions]
                    }

                    const newMessage: ChatMessage = {
                        id,
                        role,
                        content,
                        timestamp: Date.now()
                    }

                    const updatedSessions = sessions.map(session => {
                        if (session.id === activeSessionId) {
                            // Update title if it's the first message and title is default
                            let title = session.title
                            if (session.messages.length === 0 && role === 'user') {
                                const text = typeof content === 'string' ? content : (content.find(p => p.type === 'text') as any)?.text || 'Image'
                                title = text.slice(0, 30) + (text.length > 30 ? '...' : '')
                            }

                            return {
                                ...session,
                                messages: [...session.messages, newMessage],
                                title,
                                updatedAt: Date.now()
                            }
                        }
                        return session
                    })

                    return {
                        sessions: updatedSessions,
                        activeSessionId
                    }
                })
                return id
            },

            addImageMessage: (imageUrl, prompt) => {
                const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
                set(state => {
                    if (!state.activeSessionId) return state

                    const updatedSessions = state.sessions.map(session => {
                        if (session.id === state.activeSessionId) {
                            return {
                                ...session,
                                messages: [...session.messages, {
                                    id,
                                    role: 'assistant' as const,
                                    content: '',
                                    timestamp: Date.now(),
                                    imageUrl,
                                    imagePrompt: prompt
                                }],
                                updatedAt: Date.now()
                            }
                        }
                        return session
                    })

                    return { sessions: updatedSessions }
                })
                return id
            },

            updateMessage: (id, content) => {
                set(state => ({
                    sessions: state.sessions.map(session => {
                        if (session.id === state.activeSessionId) {
                            return {
                                ...session,
                                messages: session.messages.map(msg =>
                                    msg.id === id ? { ...msg, content } : msg
                                )
                            }
                        }
                        return session
                    })
                }))
            },

            clearMessages: () => set(state => ({
                sessions: state.sessions.map(session =>
                    session.id === state.activeSessionId
                        ? { ...session, messages: [], pendingGeneration: null }
                        : session
                ),
                pendingGeneration: null
            })),

            setModel: (model) => set({ selectedModel: model }),
            setImageModel: (model) => set({ selectedImageModel: model }),
            setLoading: (loading) => set({ isLoading: loading }),
            setPendingGeneration: (pending) => set({ pendingGeneration: pending }),
            setGeneratingImage: (generating) => set({ isGeneratingImage: generating })
        }),
        {
            name: 'aiverse-chat',
            storage: createJSONStorage(() => safeLocalStorage),
            partialize: (state) => ({
                // Persist sessions and settings
                sessions: state.sessions,
                activeSessionId: state.activeSessionId,
                selectedModel: state.selectedModel,
                isMinimized: state.isMinimized
            }),
            onRehydrateStorage: () => (state) => {
                if (state && state.sessions.length === 0) {
                    state.createSession()
                }
            }
        }
    )
)

// Selectors
export const selectIsOpen = (state: AIChatState) => state.isOpen
export const selectIsMinimized = (state: AIChatState) => state.isMinimized
// Derived selector for current messages
const EMPTY_MESSAGES: ChatMessage[] = []
export const selectMessages = (state: AIChatState) => {
    const session = state.sessions.find(s => s.id === state.activeSessionId)
    return session?.messages || EMPTY_MESSAGES
}
export const selectSessions = (state: AIChatState) => state.sessions
export const selectActiveSessionId = (state: AIChatState) => state.activeSessionId
export const selectModel = (state: AIChatState) => state.selectedModel
export const selectIsLoading = (state: AIChatState) => state.isLoading
