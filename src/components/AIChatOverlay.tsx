import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Minimize2, Send, Loader2, ChevronDown, Bot, User, Trash2, ImageIcon, Check, XCircle, Plus, Menu, Copy, Lock } from 'lucide-react'
import {
    useAIChatStore,
    type ChatModel,
    type ImageModel,
    type PendingImageGeneration,
    selectMessages,
    selectSessions,
    selectActiveSessionId
} from '@/store/aiChatStore'
import { ChatFeaturesOnboarding } from '@/components/ChatFeaturesOnboarding'
import WebApp from '@twa-dev/sdk'
import { getAuthHeaders } from '@/hooks/useTelegram'
import { resolvedPlatform } from '@/utils/platform'

const MODELS: { id: ChatModel; name: string; shortName: string }[] = [
    { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek v3.2', shortName: 'DeepSeek' },
    { id: 'zai-org/glm-4.7', name: 'GLM-4.7', shortName: 'GLM 4' },
    { id: 'minimax/minimax-m2.1', name: 'MiniMax M2.1', shortName: 'MiniMax' },
    { id: 'Qwen/Qwen3-235B-A22B', name: 'Qwen3 235B', shortName: 'Qwen 3' },
    { id: 'openai/gpt-oss-20b', name: 'GPT 4 mini', shortName: 'GPT 4m' },
    { id: 'openai/gpt-oss-120b', name: 'GPT 4', shortName: 'GPT 4' }
]

// Модели для генерации изображений
const IMAGE_MODELS: { id: ImageModel; name: string; price: number; shortName: string }[] = [
    { id: 'z-image-turbo', name: 'Z-Image Turbo', price: 2, shortName: 'Z-Image' },
    { id: 'qwen-image', name: 'Qwen Image', price: 2, shortName: 'Qwen' },
    { id: 'qwen-image-plus', name: 'Qwen Image +', price: 3, shortName: 'Qwen +' }
]

// Модели поддерживающие i2i
const I2I_COMPATIBLE_MODELS: ImageModel[] = ['qwen-image', 'qwen-image-plus']

// Подсказки для начала диалога
const SUGGESTIONS = [
    { text: 'Как генерировать фото?', icon: '🎨' },
    { text: 'Как изменить фото?', icon: '🖼️' },
    { text: 'Что ты умеешь?', icon: 'ℹ️' },
    { text: 'Как создать видео?', icon: '📹' }
]

/**
 * Парсинг JSON команды генерации из текста ответа AI
 */
function parseImageCommand(text: string): PendingImageGeneration | null {
    const regex = /```json:generate_image\s*\n?([\s\S]*?)```/i
    const match = text.match(regex)
    if (!match) return null

    try {
        const json = JSON.parse(match[1].trim())
        if (!json.prompt || !json.model) return null

        const validModel = IMAGE_MODELS.find(m => m.id === json.model)
        if (!validModel) return null

        return {
            prompt: json.prompt,
            model: json.model as ImageModel,
            size: json.size || json.resolution || '1024x1024',
            cost: validModel.price,
            image: json.image
        }
    } catch {
        return null
    }
}

function removeImageCommand(text: string): string {
    return text.replace(/```json:generate_image\s*\n?[\s\S]*?```/gi, '').trim()
}

function getMessageText(content: string | any[]): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
        return content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('')
    }
    return ''
}

function getMessageImage(content: string | any[]): string | undefined {
    if (Array.isArray(content)) {
        const imagePart = content.find(part => part.type === 'image_url')
        return imagePart?.image_url?.url
    }
    return undefined
}

const CodeBlock = ({ language, code }: { language: string, code: string }) => {
    const [copied, setCopied] = useState(false)
    const handleCopy = () => {
        navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="my-2 rounded-lg overflow-hidden bg-black/30 border border-white/10 group">
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
                <span className="text-xs text-white/50 font-mono">{language || 'code'}</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors">
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    <span className="text-[10px] uppercase tracking-wider">{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
            </div>
            <div className="relative">
                <pre className="p-3 overflow-x-auto text-sm font-mono text-white/90 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                    <code>{code}</code>
                </pre>
            </div>
        </div>
    )
}

function parseMarkdown(text: string): React.ReactNode {
    if (!text) return null
    const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g)
    const elements: React.ReactNode[] = []

    for (let i = 0; i < parts.length; i++) {
        if (i % 3 === 0) {
            const textPart = parts[i]
            if (textPart) {
                const lines = textPart.split('\n')
                let currentPara: React.ReactNode[] = []
                lines.forEach((line, lineIdx) => {
                    const listItem = line.match(/^(\d+\.|-|\*)\s+(.*)$/)
                    const heading = line.match(/^(#{1, 6})\s+(.*)$/)
                    if (heading) {
                        if (currentPara.length > 0) {
                            elements.push(<p key={`p-${i}-${lineIdx}-prev`} className="mb-2 whitespace-pre-wrap">{currentPara}</p>)
                            currentPara = []
                        }
                        const level = heading[1].length
                        const fontSize = level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base'
                        elements.push(<div key={`h-${i}-${lineIdx}`} className={`${fontSize} font-bold text-white mt-4 mb-2`}>{parseInline(heading[2])}</div>)
                    } else if (listItem) {
                        if (currentPara.length > 0) {
                            elements.push(<p key={`p-${i}-${lineIdx}-prev`} className="mb-2 whitespace-pre-wrap">{currentPara}</p>)
                            currentPara = []
                        }
                        elements.push(
                            <div key={`li-${i}-${lineIdx}`} className="flex gap-2 mb-1 ml-1">
                                <span className="text-white/60 min-w-[1.2em]">{listItem[1]}</span>
                                <div>{parseInline(listItem[2])}</div>
                            </div>
                        )
                    } else if (line.trim() === '') {
                        if (currentPara.length > 0) {
                            elements.push(<p key={`p-${i}-${lineIdx}`} className="mb-2 whitespace-pre-wrap">{currentPara}</p>)
                            currentPara = []
                        }
                    } else {
                        if (currentPara.length > 0) currentPara.push(<br key={`br-${i}-${lineIdx}`} />)
                        currentPara.push(parseInline(line))
                    }
                })
                if (currentPara.length > 0) {
                    elements.push(<p key={`p-${i}-end`} className="mb-2 whitespace-pre-wrap last:mb-0">{currentPara}</p>)
                }
            }
        } else if (i % 3 === 1) {
            elements.push(<CodeBlock key={`code-${i}`} language={parts[i]} code={parts[i + 1]} />)
            i++
        }
    }
    return <div className="space-y-1 text-[15px] leading-relaxed select-text">{elements}</div>
}

function parseInline(text: string): React.ReactNode {
    return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, idx) => {
        if (part.startsWith('`') && part.endsWith('`')) return <code key={idx} className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-mono text-violet-100">{part.slice(1, -1)}</code>
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>
        return part
    })
}

interface AIChatOverlayProps {
    variant?: 'overlay' | 'inline'
}

export function AIChatOverlay({ variant = 'overlay' }: AIChatOverlayProps) {
    const { t } = useTranslation()
    const isOpen = useAIChatStore(state => state.isOpen)
    const selectedModel = useAIChatStore(state => state.selectedModel)
    const isLoading = useAIChatStore(state => state.isLoading)
    const pendingGeneration = useAIChatStore(state => state.pendingGeneration)
    const isGeneratingImage = useAIChatStore(state => state.isGeneratingImage)
    const selectedImageModel = useAIChatStore(state => state.selectedImageModel)

    const closeChat = useAIChatStore(state => state.closeChat)
    const minimizeChat = useAIChatStore(state => state.minimizeChat)
    const addMessage = useAIChatStore(state => state.addMessage)
    const addImageMessage = useAIChatStore(state => state.addImageMessage)
    const updateMessage = useAIChatStore(state => state.updateMessage)
    const clearMessages = useAIChatStore(state => state.clearMessages)
    const setModel = useAIChatStore(state => state.setModel)
    const setImageModel = useAIChatStore(state => state.setImageModel)
    const setLoading = useAIChatStore(state => state.setLoading)
    const setPendingGeneration = useAIChatStore(state => state.setPendingGeneration)
    const setGeneratingImage = useAIChatStore(state => state.setGeneratingImage)
    const createSession = useAIChatStore(state => state.createSession)
    const switchSession = useAIChatStore(state => state.switchSession)
    const deleteSession = useAIChatStore(state => state.deleteSession)

    const messages = useAIChatStore(selectMessages)
    const sessions = useAIChatStore(selectSessions)
    const activeSessionId = useAIChatStore(selectActiveSessionId)

    const [input, setInput] = useState('')
    const [showHistory, setShowHistory] = useState(false)
    const [showModelSelector, setShowModelSelector] = useState(false)
    const [showImageModelSelector, setShowImageModelSelector] = useState(false)
    const [showModelConfirm, setShowModelConfirm] = useState(false)
    const [pendingModel, setPendingModel] = useState<ChatModel | null>(null)
    const [attachedImage, setAttachedImage] = useState<string | null>(null)
    const [isProcessingImage, setIsProcessingImage] = useState(false)
    const [expandedImage, setExpandedImage] = useState<string | null>(null)
    const isInline = variant === 'inline'

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

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

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isOpen])

    if (!isOpen && variant !== 'inline') return null

    const handleSend = async () => {
        const text = input.trim()
        if (!text || isLoading) return

        setInput('')
        setLoading(true)

        const userMsgId = addMessage('user', attachedImage ? [
            { type: 'text', text: text },
            { type: 'image_url', image_url: { url: attachedImage } }
        ] : text)

        const assistantMsgId = addMessage('assistant', attachedImage ? t('aiChat.requestSent', 'Запрос отправлен, начинаю обработку...') : '')

        try {
            let messageContent: any = text
            if (attachedImage) {
                let imageUrl = attachedImage
                if (attachedImage.startsWith('data:image/')) {
                    const uploadRes = await fetch('/api/chat/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                        body: JSON.stringify({ image: attachedImage })
                    })

                    if (!uploadRes.ok) {
                        throw new Error(t('aiChat.uploadError', 'Ошибка загрузки изображения'))
                    }

                    const uploadData = await uploadRes.json()
                    imageUrl = uploadData.url

                    // Update user message with the public URL instead of base64 to save storage space
                    updateMessage(userMsgId, [
                        { type: 'text', text: text },
                        { type: 'image_url', image_url: { url: imageUrl } }
                    ])
                }

                messageContent = [
                    { type: 'text', text: text },
                    { type: 'image_url', image_url: { url: imageUrl } }
                ]
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    messages: [...messages, { role: 'user', content: messageContent }].map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    model: selectedModel,
                    stream: true
                })
            })

            setAttachedImage(null)

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

            const imageCommand = parseImageCommand(fullContent)
            if (imageCommand) {
                const cleanContent = removeImageCommand(fullContent)
                updateMessage(assistantMsgId, cleanContent || t('aiChat.requestSent', 'Запрос отправлен, начинаю обработку...'))
                setPendingGeneration(imageCommand)
            }

        } catch (error) {
            console.error('[AIChatOverlay] Error:', error)
            updateMessage(assistantMsgId, t('aiChat.error', 'Произошла ошибка. Попробуйте ещё раз.'))
        } finally {
            setLoading(false)
        }
    }

    const handleConfirmGeneration = async () => {
        if (!pendingGeneration) return
        setGeneratingImage(true)

        try {
            const modelToUse = selectedImageModel
            const userId = WebApp.initDataUnsafe?.user?.id || (import.meta.env.DEV ? 817308975 : null)
            if (!userId) throw new Error('User not authenticated')

            let sourceImage = pendingGeneration.image
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
            const lastUserImage = lastUserMsg ? getMessageImage(lastUserMsg.content) : undefined
            if (lastUserImage) sourceImage = lastUserImage

            const response = await fetch('/api/chat/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    prompt: pendingGeneration.prompt,
                    model: modelToUse,
                    size: pendingGeneration.size,
                    user_id: userId,
                    image: sourceImage
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Generation failed')
            if (data.imageUrl) {
                addImageMessage(data.imageUrl, pendingGeneration.prompt)
                try {
                    const sendResp = await fetch('/api/telegram/sendDocument', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: userId,
                            file_url: data.imageUrl,
                            caption: pendingGeneration.prompt
                        })
                    })
                    const sendData = await sendResp.json().catch(() => null)
                    if (!sendResp.ok || !sendData?.ok) {
                        console.error('[AIChatOverlay] Send to Telegram failed:', sendData?.error || sendResp.statusText)
                        addMessage('assistant', t('aiChat.sendToTelegramError', 'Не удалось отправить файл в Telegram.'))
                    }
                } catch (sendError) {
                    console.error('[AIChatOverlay] Send to Telegram error:', sendError)
                    addMessage('assistant', t('aiChat.sendToTelegramError', 'Не удалось отправить файл в Telegram.'))
                }
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

    const handleCancelGeneration = () => {
        setPendingGeneration(null)
        addMessage('assistant', t('aiChat.generationCancelled', 'Генерация отменена.'))
    }

    const compressImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = (event) => {
                const img = new Image()
                img.src = event.target?.result as string
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    let width = img.width
                    let height = img.height

                    // Resize if too large (max 2048px)
                    const MAX_SIZE = 2048
                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        if (width > height) {
                            height = Math.round((height * MAX_SIZE) / width)
                            width = MAX_SIZE
                        } else {
                            width = Math.round((width * MAX_SIZE) / height)
                            height = MAX_SIZE
                        }
                    }

                    canvas.width = width
                    canvas.height = height
                    const ctx = canvas.getContext('2d')
                    if (!ctx) {
                        reject(new Error('Canvas context not available'))
                        return
                    }
                    ctx.drawImage(img, 0, 0, width, height)

                    // Compress to JPEG 0.8
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
                    resolve(dataUrl)
                }
                img.onerror = (e) => reject(e)
            }
            reader.onerror = (e) => reject(e)
        })
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            alert(t('aiChat.onlyImages', 'Можно прикреплять только изображения'))
            return
        }

        if (file.size > 20 * 1024 * 1024) {
            alert(t('aiChat.imageTooLarge', 'Файл слишком большой (>20MB)'))
            return
        }

        setIsProcessingImage(true)
        try {
            let resultDataUrl: string

            if (file.size > 3 * 1024 * 1024) {
                try {
                    resultDataUrl = await compressImage(file)
                } catch (e) {
                    console.error('Compression failed:', e)
                    resultDataUrl = await new Promise((resolve) => {
                        const reader = new FileReader()
                        reader.onloadend = () => resolve(reader.result as string)
                        reader.readAsDataURL(file)
                    })
                }
            } else {
                resultDataUrl = await new Promise((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(file)
                })
            }

            if (resultDataUrl.length > 7 * 1024 * 1024) {
                alert(t('aiChat.imageTooLarge', 'После сжатия изображение всё ещё слишком большое'))
                setIsProcessingImage(false)
                return
            }

            setAttachedImage(resultDataUrl)
            setIsProcessingImage(false)
            if (!I2I_COMPATIBLE_MODELS.includes(selectedImageModel)) {
                setImageModel('qwen-image')
            }
            if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (error) {
            console.error('Error reading/processing file:', error)
            setIsProcessingImage(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const platform = resolvedPlatform
    const headerOffset = isInline ? '0px' : (platform === 'ios' ? 'calc(env(safe-area-inset-top) + 65px)' : 'calc(env(safe-area-inset-top) + 90px)')
    const bottomPadding = isInline ? '' : (platform === 'ios' ? 'pb-[env(safe-area-inset-bottom)]' : 'pb-4')

    const handleModelChangeContinue = () => {
        if (pendingModel) setModel(pendingModel)
        setShowModelConfirm(false)
        setPendingModel(null)
    }

    const handleModelChangeNewChat = () => {
        if (pendingModel) {
            createSession()
            setModel(pendingModel)
        }
        setShowModelConfirm(false)
        setPendingModel(null)
    }

    const handleModelChangeCancel = () => {
        setShowModelConfirm(false)
        setPendingModel(null)
    }

    const handleNewChat = () => {
        createSession()
        setShowHistory(false)
        if (isInline) {
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }

    return (
        <>
            {/* Image Viewer Overlay */}
            {expandedImage && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setExpandedImage(null)}
                >
                    <button
                        onClick={() => setExpandedImage(null)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors z-[210]"
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={expandedImage}
                        alt="Full view"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

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
                            <button onClick={handleModelChangeNewChat} className="w-full py-3 px-4 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors">
                                {t('aiChat.newChat', 'Новый чат')}
                            </button>
                            <button onClick={handleModelChangeContinue} className="w-full py-3 px-4 rounded-xl bg-white/10 text-white/80 font-medium hover:bg-white/15 transition-colors">
                                {t('aiChat.continueChat', 'Продолжить в данном чате')}
                            </button>
                            <button onClick={handleModelChangeCancel} className="w-full py-3 px-4 rounded-xl text-white/50 font-medium hover:text-white/70 transition-colors">
                                {t('aiChat.cancel', 'Отмена')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {(isOpen || isInline) && <ChatFeaturesOnboarding />}

            {!isInline && <div className="fixed inset-0 z-[45] bg-black" />}

            <div
                className={isInline
                    ? "relative flex flex-col w-full h-full min-h-0 bg-black border-t-0"
                    : "fixed left-0 right-0 bottom-0 z-[60] bg-black flex flex-col min-h-0 border-t border-white/10 rounded-t-2xl"
                }
                style={isInline ? {} : { top: headerOffset }}
            >
                <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0 -ml-2">
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <Menu size={20} />
                            </button>
                            <button
                                onClick={handleNewChat}
                                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                                title={t('aiChat.newChat', 'Новый чат')}
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button
                                id="chat-model-selector"
                                onClick={() => setShowModelSelector(!showModelSelector)}
                                className="h-8 flex items-center gap-1 px-2.5 rounded-lg bg-white/10 text-[13px] font-medium text-white/80 hover:bg-white/15 transition-colors"
                            >
                                <span className="max-w-[90px] truncate">
                                    {MODELS.find(m => m.id === selectedModel)?.shortName || 'Model'}
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
                                                    setPendingModel(model.id)
                                                    setShowModelConfirm(true)
                                                } else {
                                                    setModel(model.id)
                                                }
                                                setShowModelSelector(false)
                                            }}
                                            className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${selectedModel === model.id ? 'bg-violet-600 text-white' : 'text-white/80 hover:bg-white/10'}`}
                                        >
                                            {model.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <button
                                id="image-model-selector"
                                onClick={() => setShowImageModelSelector(!showImageModelSelector)}
                                className="h-8 flex items-center gap-1 px-2.5 rounded-lg bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30 text-[13px] font-medium text-violet-300 hover:bg-violet-600/30 transition-colors"
                            >
                                <ImageIcon size={12} />
                                <span className="max-w-[80px] truncate">
                                    {IMAGE_MODELS.find(m => m.id === selectedImageModel)?.shortName || 'Image'}
                                </span>
                                <span className="text-[9px] text-violet-400/70 font-bold bg-violet-400/10 px-1 rounded-sm">
                                    {IMAGE_MODELS.find(m => m.id === selectedImageModel)?.price || 2}т
                                </span>
                                <ChevronDown size={12} className="opacity-40" />
                            </button>

                            {showImageModelSelector && (
                                <div className="absolute right-0 top-full mt-1 w-60 bg-zinc-900 border border-violet-500/30 rounded-lg shadow-xl overflow-hidden z-10">
                                    <div className="px-3 py-2 text-xs text-white/40 border-b border-white/10 flex justify-between items-center">
                                        <span>{t('aiChat.selectImageModel', 'Модель генерации')}</span>
                                        <span className="text-[10px] text-white/30">Цена</span>
                                    </div>
                                    {IMAGE_MODELS.map(model => {
                                        const isCompatible = !attachedImage || I2I_COMPATIBLE_MODELS.includes(model.id)
                                        return (
                                            <button
                                                key={model.id}
                                                disabled={!isCompatible}
                                                onClick={() => {
                                                    setImageModel(model.id)
                                                    setShowImageModelSelector(false)
                                                }}
                                                className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-3 ${selectedImageModel === model.id
                                                    ? 'bg-violet-600 text-white'
                                                    : isCompatible ? 'text-white/80 hover:bg-white/10' : 'text-white/30 cursor-not-allowed'
                                                    }`}
                                            >
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium truncate">{model.name}</span>
                                                    {!isCompatible && <span className="text-[10px] text-red-400 leading-none mt-0.5">Не для фото-редактора</span>}
                                                </div>
                                                <div className={`flex flex-col items-end shrink-0 ${selectedImageModel === model.id ? 'text-white/90' : 'text-white/50'}`}>
                                                    <span className="text-xs font-bold font-mono bg-white/10 px-1.5 py-0.5 rounded">
                                                        {model.price}т
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {messages.length > 0 && (
                            <button onClick={clearMessages} className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/10 text-white/50 hover:text-white hover:bg-white/15 transition-colors" title={t('aiChat.clear', 'Очистить чат')}>
                                <Trash2 size={16} />
                            </button>
                        )}

                        {!isInline && (
                            <button onClick={minimizeChat} className="p-2 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/15 transition-colors">
                                <Minimize2 size={18} />
                            </button>
                        )}

                        {!isInline && (
                            <button onClick={closeChat} className="p-2 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/15 transition-colors">
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* History Sidebar (Inside Container) */}
                {showHistory && (
                    <div className="absolute inset-x-0 bottom-0 top-[60px] z-50 flex overflow-hidden">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)} />

                        <div className="relative w-72 h-full bg-zinc-900 border-r border-white/10 flex flex-col animate-in slide-in-from-left duration-200">
                            <div className="p-4 border-b border-white/10">
                                <span className="font-semibold text-white">История чатов</span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {sessions.map(session => (
                                    <button
                                        key={session.id}
                                        onClick={() => {
                                            switchSession(session.id)
                                            setShowHistory(false)
                                        }}
                                        className={`w-full p-3 rounded-xl text-left text-sm transition-colors group relative ${activeSessionId === session.id
                                            ? 'bg-white/10 text-white'
                                            : 'text-white/60 hover:bg-white/5 hover:text-white'
                                            }`}
                                    >
                                        <div className="pr-6 truncate font-medium">{session.title || 'Новый чат'}</div>
                                        <div className="text-xs text-white/30 mt-1">
                                            {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(session.updatedAt)}
                                        </div>
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (confirm('Удалить этот чат?')) deleteSession(session.id)
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-red-400"
                                        >
                                            <Trash2 size={14} />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Bottom New Chat Button */}
                            <div className="p-4 border-t border-white/10 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                                <button
                                    onClick={handleNewChat}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors shadow-lg shadow-violet-500/20"
                                >
                                    <Plus size={20} />
                                    <span>Новый чат</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div
                    ref={messagesContainerRef}
                    className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4"
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
                >
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-white/40">
                            <Bot className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-lg font-medium">{t('aiChat.welcome', 'Привет! Я AI-ассистент AiVerse')}</p>
                            <p className="text-sm mt-2 mb-8">{t('aiChat.welcomeHint', 'Спроси меня о генерации изображений или промптах')}</p>

                            <div className="grid grid-cols-2 gap-2 max-w-sm px-4 w-full">
                                {SUGGESTIONS.map((suggestion, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            if (inputRef.current) {
                                                setInput(suggestion.text)
                                                inputRef.current.focus()
                                            }
                                        }}
                                        className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-sm text-white/70 hover:text-white"
                                    >
                                        <span className="text-xl">{suggestion.icon}</span>
                                        <span className="font-medium">{suggestion.text}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'assistant' && (
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center">
                                        <Bot size={16} className="text-white" />
                                    </div>
                                )}
                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-white/10 text-white'}`}>
                                    {(msg.imageUrl || getMessageImage(msg.content)) && (
                                        <div className="mb-2">
                                            <img
                                                src={msg.imageUrl || getMessageImage(msg.content)}
                                                alt={msg.imagePrompt || 'Attached image'}
                                                className="rounded-xl max-w-full cursor-zoom-in hover:brightness-110 transition-all"
                                                onClick={() => setExpandedImage(msg.imageUrl || getMessageImage(msg.content) || null)}
                                            />
                                            {msg.imagePrompt && <p className="text-xs text-white/50 mt-2 italic">{msg.imagePrompt}</p>}
                                        </div>
                                    )}
                                    {msg.content ? (
                                        msg.role === 'assistant' ? (
                                            <div className="text-sm leading-relaxed">{parseMarkdown(getMessageText(msg.content))}</div>
                                        ) : (
                                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{getMessageText(msg.content)}</p>
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

                {pendingGeneration && (
                    <div className="mx-4 mb-2 p-4 rounded-xl bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center">
                                <ImageIcon size={20} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white mb-1">{t('aiChat.confirmGeneration', 'Сгенерировать изображение?')}</p>
                                <p className="text-xs text-white/60 truncate mb-2">{pendingGeneration.prompt.slice(0, 100)}...</p>
                                <div className="flex items-center gap-2 text-xs text-white/50">
                                    <span className="px-2 py-0.5 rounded bg-white/10">{IMAGE_MODELS.find(m => m.id === selectedImageModel)?.name}</span>
                                    <span>•</span>
                                    <span>{IMAGE_MODELS.find(m => m.id === selectedImageModel)?.price || 1} {t('aiChat.tokens', 'токен(ов)')}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button onClick={handleConfirmGeneration} disabled={isGeneratingImage} className="flex-1 py-2.5 px-4 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                {isGeneratingImage ? <><Loader2 className="w-4 h-4 animate-spin" />{t('aiChat.generating', 'Генерация...')}</> : <><Check size={16} />{t('aiChat.generate', 'Сгенерировать')}</>}
                            </button>
                            <button onClick={handleCancelGeneration} disabled={isGeneratingImage} className="py-2.5 px-4 rounded-xl bg-white/10 text-white/70 text-sm font-medium hover:bg-white/15 disabled:opacity-50 transition-colors flex items-center gap-2">
                                <XCircle size={16} />
                                {t('aiChat.cancelGeneration', 'Отмена')}
                            </button>
                        </div>
                    </div>
                )}

                <div className={`px-4 py-3 border-t border-white/10 bg-black/80 backdrop-blur-xl ${bottomPadding}`}>
                    {attachedImage && (
                        <div className="mb-3 flex items-start">
                            <div className="relative group">
                                <img src={attachedImage} alt="Attachment" className="h-20 w-auto rounded-lg border border-white/10 object-cover" />
                                <button onClick={() => setAttachedImage(null)} className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-zinc-800 text-white/70 border border-white/20 hover:text-white transition-colors shadow-lg">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex items-end gap-2">
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                        <button onClick={() => fileInputRef.current?.click()} disabled={isLoading || isProcessingImage} className="flex-shrink-0 w-10 h-10 mb-1 rounded-xl bg-white/5 text-white/50 flex items-center justify-center hover:bg-white/10 hover:text-white/80 transition-colors disabled:opacity-30">
                            {isProcessingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
                        </button>
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
                        <button onClick={handleSend} disabled={!input.trim() || isLoading} className="flex-shrink-0 w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-500 transition-colors">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
