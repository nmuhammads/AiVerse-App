import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowUp, Bot, ImageIcon, ChevronRight } from 'lucide-react'

const STORAGE_KEY = 'has_seen_chat_features_v1'

const STEPS = [
    {
        targetId: 'chat-model-selector',
        title: 'Модель Чата',
        description: 'Здесь вы можете выбрать модель ИИ для общения. Доступны разные модели: от быстрых до самых умных.',
        icon: <Bot size={20} />
    },
    {
        targetId: 'image-model-selector',
        title: 'Генерация',
        description: 'Выберите модель для рисования. Z-Image Turbo для скорости или Qwen Image для сложных сцен (поддерживает редактирование фото i2i).',
        icon: <ImageIcon size={20} />
    }
]

export function ChatFeaturesOnboarding() {
    const [stepIndex, setStepIndex] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

    // Initial check
    useEffect(() => {
        const hasSeen = localStorage.getItem(STORAGE_KEY)
        if (!hasSeen) {
            // Wait a bit for layout to settle, but faster now
            setTimeout(() => setIsVisible(true), 300)
        }
    }, [])

    // Target tracking loop
    useEffect(() => {
        if (!isVisible) return

        const currentStep = STEPS[stepIndex]
        if (!currentStep) return

        let animationFrameId: number
        let startTime = Date.now()

        const updateRect = () => {
            const element = document.getElementById(currentStep.targetId)
            if (element) {
                const rect = element.getBoundingClientRect()
                if (rect.width > 0 && rect.height > 0) {
                    setTargetRect(rect)
                }
            }

            // Continue tracking for a few seconds to handle animations
            if (Date.now() - startTime < 3000) {
                animationFrameId = requestAnimationFrame(updateRect)
            }
        }

        updateRect()

        // Also update on scroll/resize
        window.addEventListener('resize', updateRect)
        window.addEventListener('scroll', updateRect, true)

        return () => {
            cancelAnimationFrame(animationFrameId)
            window.removeEventListener('resize', updateRect)
            window.removeEventListener('scroll', updateRect, true)
        }
    }, [isVisible, stepIndex])

    const handleNext = () => {
        if (stepIndex < STEPS.length - 1) {
            setStepIndex(prev => prev + 1)
            setTargetRect(null) // Reset rect to trigger re-search
        } else {
            handleClose()
        }
    }

    const handleClose = () => {
        setIsVisible(false)
        localStorage.setItem(STORAGE_KEY, 'true')
    }

    if (!isVisible || !targetRect) return null

    const step = STEPS[stepIndex]

    return createPortal(
        <div className="fixed inset-0 z-[200] font-sans">
            {/* Click listener for backdrop */}
            <div
                className="absolute inset-0 z-[100]"
                onClick={handleClose}
            />

            {/* Target Highlight & Visual Backdrop (The Hole) */}
            <div
                className="absolute pointer-events-none z-[105] transition-all duration-300 ease-out"
                style={{
                    top: targetRect.top - 4,
                    left: targetRect.left - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 8,
                }}
            >
                {/* The Backdrop Hole */}
                <div className="absolute inset-0 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />

                {/* Solid Border */}
                <div className="absolute inset-0 rounded-lg border-2 border-violet-500" />
            </div>

            {/* Arrow */}
            <div
                className="absolute z-[110] text-violet-500 pointer-events-none animate-bounce transition-all duration-300 ease-out"
                style={{
                    top: targetRect.bottom + 12,
                    left: targetRect.left + targetRect.width / 2,
                    transform: 'translateX(-50%)'
                }}
            >
                <ArrowUp size={32} strokeWidth={2.5} />
            </div>

            {/* Modal */}
            <div
                className="absolute z-[110] transition-all duration-300 ease-out"
                style={{
                    top: targetRect.bottom + 50,
                    left: Math.max(16, Math.min(window.innerWidth - 316, targetRect.left + targetRect.width / 2 - 150)),
                }}
            >
                <div className="w-[300px] bg-zinc-900 border border-violet-500/30 rounded-2xl p-5 shadow-2xl relative animate-in fade-in slide-in-from-top-4 duration-300">
                    <button
                        onClick={handleClose}
                        className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400">
                            {step.icon}
                        </div>
                        <h3 className="font-bold text-white text-lg">{step.title}</h3>
                    </div>

                    <p className="text-white/80 text-sm leading-relaxed mb-4 min-h-[60px]">
                        {step.description}
                    </p>

                    <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                            {STEPS.map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === stepIndex ? 'bg-violet-500' : 'bg-white/20'}`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl text-sm transition-colors flex items-center gap-1.5"
                        >
                            <span>{stepIndex === STEPS.length - 1 ? 'Понятно' : 'Далее'}</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
