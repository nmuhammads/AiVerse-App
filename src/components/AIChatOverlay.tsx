/**
 * AI Chat Overlay
 * Полноэкранный интерфейс чата с ИИ
 */

import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Minimize2, Send, Loader2, ChevronDown, Bot, User, Trash2, ImageIcon, Check, XCircle } from 'lucide-react'
import { useAIChatStore, type ChatModel, type ImageModel, type PendingImageGeneration } from '@/store/aiChatStore'
import WebApp from '@twa-dev/sdk'

const MODELS: { id: ChatModel; name: string }[] = [
    { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek v3.2' },
    { id: 'zai-org/glm-4.7', name: 'GLM-4.7' },
    { id: 'minimax/minimax-m2.1', name: 'MiniMax M2.1' },
    { id: 'Qwen/Qwen3-235B-A22B', name: 'Qwen3 235B' },
    { id: 'openai/gpt-oss-20b', name: 'GPT 4 mini' },
    { id: 'openai/gpt-oss-120b', name: 'GPT 4' }
]

// Модели для генерации изображений
const IMAGE_MODELS: { id: ImageModel; name: string; price: number }[] = [
    { id: 'z-image-turbo', name: 'Z-Image Turbo', price: 2 },
    { id: 'qwen-image', name: 'Qwen Image', price: 2 }
]

/**
 * Парсинг JSON команды генерации из текста ответа AI
 * Ищет блок ```json:generate_image {...} ```
 */
function parseImageCommand(text: string): PendingImageGeneration | null {
    // Ищем блок json:generate_image
    const regex = /```json:generate_image\s*\n?([\s\S]*?)```/i
    const match = text.match(regex)

    if (!match) return null

    try {
        const json = JSON.parse(match[1].trim())
        if (!json.prompt || !json.model) return null

        // Валидация модели
        const validModel = IMAGE_MODELS.find(m => m.id === json.model)
        if (!validModel) return null

        return {
            prompt: json.prompt,
            model: json.model as ImageModel,
            size: json.size || '1024x1024',
            cost: validModel.price
        }
    } catch {
        return null
    }
}

/**
 * Удаляет JSON команду из текста для отображения
 */
function removeImageCommand(text: string): string {
    return text.replace(/```json:generate_image\s*\n?[\s\S]*?```/gi, '').trim()
}

/**
 * Простой парсер Markdown для чата
 */
function parseMarkdown(text: string): React.ReactNode[] {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []

    lines.forEach((line, lineIndex) => {
        // Заголовки
        if (line.startsWith('### ')) {
            elements.push(<h4 key={lineIndex} className="font-semibold text-white/90 mt-2 mb-1">{parseInline(line.slice(4))}</h4>)
            return
        }
        if (line.startsWith('## ')) {
            elements.push(<h3 key={lineIndex} className="font-bold text-white mt-3 mb-1">{parseInline(line.slice(3))}</h3>)
            return
        }
        if (line.startsWith('# ')) {
            elements.push(<h2 key={lineIndex} className="font-bold text-lg text-white mt-3 mb-2">{parseInline(line.slice(2))}</h2>)
            return
        }

        // Списки
        if (line.match(/^[\-\*] /)) {
            elements.push(<li key={lineIndex} className="ml-4 list-disc">{parseInline(line.slice(2))}</li>)
            return
        }
        if (line.match(/^\d+\. /)) {
            const match = line.match(/^(\d+)\. (.*)$/)
            if (match) {
                elements.push(<li key={lineIndex} className="ml-4 list-decimal">{parseInline(match[2])}</li>)
            }
            return
        }

        // Пустая строка
        if (line.trim() === '') {
            elements.push(<br key={lineIndex} />)
            return
        }

        // Обычный текст
        elements.push(<p key={lineIndex} className="mb-1">{parseInline(line)}</p>)
    })

    return elements
}

/**
 * Парсинг inline-форматирования (**bold**, *italic*, `code`, эмодзи)
 */
function parseInline(text: string): React.ReactNode {
    // Регулярка для **bold**, *italic*, `code`
    const parts: React.ReactNode[] = []
    let remaining = text
    let keyCounter = 0

    while (remaining.length > 0) {
        // **bold**
        const boldMatch = remaining.match(/^(.*)\*\*(.+?)\*\*(.*)$/s)
        if (boldMatch) {
            if (boldMatch[1]) parts.push(parseInline(boldMatch[1]))
            parts.push(<strong key={keyCounter++} className="font-semibold">{boldMatch[2]}</strong>)
            remaining = boldMatch[3]
            continue
        }

        // `code`
        const codeMatch = remaining.match(/^(.*)`(.+?)`(.*)$/s)
        if (codeMatch) {
            if (codeMatch[1]) parts.push(codeMatch[1])
            parts.push(<code key={keyCounter++} className="bg-white/20 px-1 py-0.5 rounded text-xs font-mono">{codeMatch[2]}</code>)
            remaining = codeMatch[3]
            continue
        }

        // Ничего не нашли - выходим
        parts.push(remaining)
        break
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>
}

interface AIChatOverlayProps {
    variant?: 'overlay' | 'inline'
}

export function AIChatOverlay({ variant = 'overlay' }: AIChatOverlayProps) {
    const { t } = useTranslation()
    const {
        isOpen,
        messages,
        selectedModel,
        isLoading,
        pendingGeneration,
        isGeneratingImage,
        selectedImageModel,
        closeChat,
        minimizeChat,
        addMessage,
        addImageMessage,
        updateMessage,
        clearMessages,
        setModel,
        setImageModel,
        setLoading,
        setPendingGeneration,
        setGeneratingImage
    } = useAIChatStore()

    const [input, setInput] = useState('')
    const [showModelSelector, setShowModelSelector] = useState(false)
    const [showImageModelSelector, setShowImageModelSelector] = useState(false)
    const [showModelConfirm, setShowModelConfirm] = useState(false)
    const [pendingModel, setPendingModel] = useState<ChatModel | null>(null)
    const isInline = variant === 'inline'
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
        const container = messagesContainerRef.current
        if (!container) return
        container.scrollTo({ top: container.scrollHeight, behavior })
    }

    useEffect(() => {
        scrollToBottom('smooth')
    }, [messages.length])

    useEffect(() => {
        const id = requestAnimationFrame(() => scrollToBottom('auto'))
        return () => cancelAnimationFrame(id)
    }, [isInline])

    // Фокус на input при открытии
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isOpen])

    if (!isOpen && variant !== 'inline') return null
    const containerClasses = isInline
        ? 'relative w-full h-full flex flex-col bg-black'
        : 'fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-xl'

    const handleSend = async () => {
        const text = input.trim()
        if (!text || isLoading) return

        setInput('')
        setLoading(true)

        // Добавить сообщение пользователя
        addMessage('user', text)

        // Добавить пустое сообщение ассистента для стриминга
        const assistantMsgId = addMessage('assistant', '')

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, { role: 'user', content: text }].map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    model: selectedModel,
                    stream: true
                })
            })

            if (!response.ok) {
                throw new Error('Chat request failed')
            }

            const reader = response.body?.getReader()
            if (!reader) throw new Error('No response body')

            const decoder = new TextDecoder()
            let fullContent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split('\n')

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const data = line.slice(6).trim()
                    if (data === '[DONE]') continue

                    try {
                        const parsed = JSON.parse(data)
                        if (parsed.content) {
                            fullContent += parsed.content
                            updateMessage(assistantMsgId, fullContent)
                        }
                        if (parsed.error) {
                            throw new Error(parsed.error)
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }

            // Проверяем есть ли команда генерации в ответе
            const imageCommand = parseImageCommand(fullContent)
            if (imageCommand) {
                // Убираем JSON блок из отображаемого текста
                const cleanContent = removeImageCommand(fullContent)
                updateMessage(assistantMsgId, cleanContent)
                // Сохраняем pending generation
                setPendingGeneration(imageCommand)
            }

        } catch (error) {
            console.error('[AIChatOverlay] Error:', error)
            updateMessage(assistantMsgId, t('aiChat.error', 'Произошла ошибка. Попробуйте ещё раз.'))
        } finally {
            setLoading(false)
        }
    }

    // Подтверждение генерации изображения
    const handleConfirmGeneration = async () => {
        if (!pendingGeneration) return

        setGeneratingImage(true)

        try {
            // Используем выбранную пользователем модель вместо предложенной AI
            const modelToUse = selectedImageModel
            // В dev режиме WebApp.initDataUnsafe.user может быть undefined
            const userId = WebApp.initDataUnsafe?.user?.id || (import.meta.env.DEV ? 817308975 : null)

            if (!userId) {
                throw new Error('User not authenticated')
            }

            const response = await fetch('/api/chat/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: pendingGeneration.prompt,
                    model: modelToUse,
                    size: pendingGeneration.size,
                    user_id: userId
                })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Generation failed')
            }

            // Добавляем изображение в чат
            if (data.imageUrl) {
                addImageMessage(data.imageUrl, pendingGeneration.prompt)
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error('[AIChatOverlay] Generation error:', errorMessage, error)
            addMessage('assistant', `❌ ${errorMessage || t('aiChat.generationError', 'Ошибка генерации. Попробуйте ещё раз.')}`)
        } finally {
            setGeneratingImage(false)
            setPendingGeneration(null)
        }
    }

    // Отмена генерации
    const handleCancelGeneration = () => {
        setPendingGeneration(null)
        addMessage('assistant', t('aiChat.generationCancelled', 'Генерация отменена.'))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const platform = WebApp.platform
    // Оффсет для Header: safe-area + 60px для Header + небольшой отступ
    const headerOffset = isInline ? '0px' : (platform === 'ios' ? 'calc(env(safe-area-inset-top) + 65px)' : 'calc(env(safe-area-inset-top) + 90px)')
    // Для inline режима НЕ нужен дополнительный отступ - родитель (Studio.tsx) уже добавляет pb-[84px] для таб бара
    // Для overlay режима нужен отступ safe-area
    const bottomPadding = isInline ? '' : (platform === 'ios' ? 'pb-[env(safe-area-inset-bottom)]' : 'pb-4')

    // Обработчики для модального окна подтверждения смены модели
    const handleModelChangeKeepHistory = () => {
        if (pendingModel) {
            setModel(pendingModel)
        }
        setShowModelConfirm(false)
        setPendingModel(null)
    }

    const handleModelChangeClearHistory = () => {
        if (pendingModel) {
            clearMessages()
            setModel(pendingModel)
        }
        setShowModelConfirm(false)
        setPendingModel(null)
    }

    const handleModelChangeCancel = () => {
        setShowModelConfirm(false)
        setPendingModel(null)
    }

    return (
        <>
            {/* Model Change Confirmation Modal */}
            {showModelConfirm && pendingModel && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-sm bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                        <div className="p-5">
                            <h3 className="text-lg font-semibold text-white mb-2">
                                {t('aiChat.modelChangeTitle', 'Сменить модель?')}
                            </h3>
                            <p className="text-sm text-white/60">
                                {t('aiChat.modelChangeMessage', 'Вы переключаетесь на модель {{model}}. Что сделать с текущей историей чата?', {
                                    model: MODELS.find(m => m.id === pendingModel)?.name || pendingModel
                                })}
                            </p>
                        </div>
                        <div className="flex flex-col gap-2 p-4 pt-0">
                            <button
                                onClick={handleModelChangeKeepHistory}
                                className="w-full py-3 px-4 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors"
                            >
                                {t('aiChat.keepHistory', 'Сохранить историю')}
                            </button>
                            <button
                                onClick={handleModelChangeClearHistory}
                                className="w-full py-3 px-4 rounded-xl bg-white/10 text-white/80 font-medium hover:bg-white/15 transition-colors"
                            >
                                {t('aiChat.clearHistory', 'Очистить историю')}
                            </button>
                            <button
                                onClick={handleModelChangeCancel}
                                className="w-full py-3 px-4 rounded-xl text-white/50 font-medium hover:text-white/70 transition-colors"
                            >
                                {t('aiChat.cancel', 'Отмена')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Full-screen black backdrop - only for overlay */}
            {!isInline && <div className="fixed inset-0 z-[45] bg-black" />}

            {/* Chat Overlay */}
            <div
                className={isInline
                    ? "relative flex flex-col w-full h-full min-h-0 bg-black border-t-0"
                    : "fixed left-0 right-0 bottom-0 z-[60] bg-black flex flex-col min-h-0 border-t border-white/10 rounded-t-2xl"
                }
                style={isInline ? {} : { top: headerOffset }}
            >
                {/* Chat Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-violet-400" />
                        <span className="font-semibold text-white">{t('aiChat.title', 'AI Ассистент')}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Model Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowModelSelector(!showModelSelector)}
                                className="h-8 flex items-center gap-1 px-2.5 rounded-lg bg-white/10 text-[13px] font-medium text-white/80 hover:bg-white/15 transition-colors"
                            >
                                <span className="max-w-[90px] truncate">
                                    {MODELS.find(m => m.id === selectedModel)?.name || 'Model'}
                                </span>
                                <ChevronDown size={12} className="opacity-40" />
                            </button>

                            {showModelSelector && (
                                <div className="absolute left-0 top-full mt-1 w-48 bg-zinc-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-10">
                                    {MODELS.map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => {
                                                if (model.id !== selectedModel && messages.length > 0) {
                                                    // Показываем подтверждение если есть история
                                                    setPendingModel(model.id)
                                                    setShowModelConfirm(true)
                                                } else {
                                                    setModel(model.id)
                                                }
                                                setShowModelSelector(false)
                                            }}
                                            className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${selectedModel === model.id
                                                ? 'bg-violet-600 text-white'
                                                : 'text-white/80 hover:bg-white/10'
                                                }`}
                                        >
                                            {model.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Image Model Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowImageModelSelector(!showImageModelSelector)}
                                className="h-8 flex items-center gap-1 px-2.5 rounded-lg bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30 text-[13px] font-medium text-violet-300 hover:bg-violet-600/30 transition-colors"
                            >
                                <ImageIcon size={12} />
                                <span className="max-w-[60px] truncate">
                                    {IMAGE_MODELS.find(m => m.id === selectedImageModel)?.name.split(' ')[0] || 'Image'}
                                </span>
                                <span className="text-[9px] text-violet-400/70 font-bold bg-violet-400/10 px-1 rounded-sm">
                                    {IMAGE_MODELS.find(m => m.id === selectedImageModel)?.price || 2}т
                                </span>
                                <ChevronDown size={12} className="opacity-40" />
                            </button>

                            {showImageModelSelector && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-violet-500/30 rounded-lg shadow-xl overflow-hidden z-10">
                                    <div className="px-3 py-2 text-xs text-white/40 border-b border-white/10">
                                        {t('aiChat.selectImageModel', 'Модель генерации')}
                                    </div>
                                    {IMAGE_MODELS.map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => {
                                                setImageModel(model.id)
                                                setShowImageModelSelector(false)
                                            }}
                                            className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${selectedImageModel === model.id
                                                ? 'bg-violet-600 text-white'
                                                : 'text-white/80 hover:bg-white/10'
                                                }`}
                                        >
                                            <span>{model.name}</span>
                                            <span className={`text-xs ${selectedImageModel === model.id ? 'text-white/80' : 'text-white/50'}`}>
                                                {model.price} {t('aiChat.tokens', 'токен')}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Clear Chat */}
                        {messages.length > 0 && (
                            <button
                                onClick={clearMessages}
                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 text-white/50 hover:text-white hover:bg-white/15 transition-colors"
                                title={t('aiChat.clear', 'Очистить чат')}
                            >
                                <Trash2 size={16} />
                            </button>
                        )}

                        {/* Minimize */}
                        {!isInline && (
                            <button
                                onClick={minimizeChat}
                                className="p-2 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/15 transition-colors"
                            >
                                <Minimize2 size={18} />
                            </button>
                        )}

                        {/* Close */}
                        {!isInline && (
                            <button
                                onClick={closeChat}
                                className="p-2 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/15 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div
                    ref={messagesContainerRef}
                    className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4"
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
                >
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-white/40">
                            <Bot className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-lg font-medium">{t('aiChat.welcome', 'Привет! Я AI-ассистент AiVerse')}</p>
                            <p className="text-sm mt-2">{t('aiChat.welcomeHint', 'Спроси меня о генерации изображений или промптах')}</p>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <div
                                key={msg.id}
                                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center">
                                        <Bot size={16} className="text-white" />
                                    </div>
                                )}

                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-white/10 text-white'
                                        }`}
                                >
                                    {/* Изображение если есть */}
                                    {msg.imageUrl && (
                                        <div className="mb-2">
                                            <img
                                                src={msg.imageUrl}
                                                alt={msg.imagePrompt || 'Generated image'}
                                                className="rounded-xl max-w-full"
                                            />
                                            {msg.imagePrompt && (
                                                <p className="text-xs text-white/50 mt-2 italic">
                                                    {msg.imagePrompt}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {msg.content ? (
                                        msg.role === 'assistant' ? (
                                            <div className="text-sm leading-relaxed">
                                                {parseMarkdown(msg.content)}
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                                                {msg.content}
                                            </p>
                                        )
                                    ) : (isLoading && msg.role === 'assistant' && !msg.imageUrl ? (
                                        <span className="flex items-center gap-2 text-sm">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {t('aiChat.thinking', 'Думаю...')}
                                        </span>
                                    ) : null)}
                                </div>

                                {msg.role === 'user' && (
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                        <User size={16} className="text-white" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Pending Generation Confirmation */}
                {pendingGeneration && (
                    <div className="mx-4 mb-2 p-4 rounded-xl bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center">
                                <ImageIcon size={20} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white mb-1">
                                    {t('aiChat.confirmGeneration', 'Сгенерировать изображение?')}
                                </p>
                                <p className="text-xs text-white/60 truncate mb-2">
                                    {pendingGeneration.prompt.slice(0, 100)}...
                                </p>
                                <div className="flex items-center gap-2 text-xs text-white/50">
                                    <span className="px-2 py-0.5 rounded bg-white/10">{IMAGE_MODELS.find(m => m.id === selectedImageModel)?.name}</span>
                                    <span>•</span>
                                    <span>{IMAGE_MODELS.find(m => m.id === selectedImageModel)?.price || 1} {t('aiChat.tokens', 'токен(ов)')}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleConfirmGeneration}
                                disabled={isGeneratingImage}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            >
                                {isGeneratingImage ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('aiChat.generating', 'Генерация...')}
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} />
                                        {t('aiChat.generate', 'Сгенерировать')}
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleCancelGeneration}
                                disabled={isGeneratingImage}
                                className="py-2.5 px-4 rounded-xl bg-white/10 text-white/70 text-sm font-medium hover:bg-white/15 disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                <XCircle size={16} />
                                {t('aiChat.cancelGeneration', 'Отмена')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Input */}
                <div className={`px-4 py-3 border-t border-white/10 bg-black/80 backdrop-blur-xl ${bottomPadding}`}>
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('aiChat.placeholder', 'Напишите сообщение...')}
                            rows={1}
                            className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent min-h-[48px] max-h-[120px]"
                            style={{ height: 'auto' }}
                            onInput={e => {
                                const target = e.target as HTMLTextAreaElement
                                target.style.height = 'auto'
                                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="flex-shrink-0 w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-500 transition-colors"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

        </>
    )
}
