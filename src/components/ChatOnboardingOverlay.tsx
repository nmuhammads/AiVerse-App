import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, MessageSquare, ArrowUpRight } from 'lucide-react'

const STORAGE_KEY = 'has_seen_chat_onboarding_v1'

export function ChatOnboardingOverlay() {
    const [isVisible, setIsVisible] = useState(false)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    const [retryCount, setRetryCount] = useState(0)

    useEffect(() => {
        // Check if already seen
        const hasSeen = localStorage.getItem(STORAGE_KEY)
        if (hasSeen) return

        // Try to find the target element
        const checkTarget = () => {
            const element = document.getElementById('chat-mode-toggle')
            if (element) {
                const rect = element.getBoundingClientRect()
                // Ensure the element is visible and has dimension
                if (rect.width > 0 && rect.height > 0) {
                    setTargetRect(rect)
                    setIsVisible(true)
                }
            } else if (retryCount < 5) {
                // Retry a few times if element not found immediately (e.g. animation/loading)
                setTimeout(() => setRetryCount(prev => prev + 1), 500)
            }
        }

        // Small delay to ensure layout is stable
        const timer = setTimeout(checkTarget, 500)
        return () => clearTimeout(timer)
    }, [retryCount])

    const handleClose = () => {
        setIsVisible(false)
        localStorage.setItem(STORAGE_KEY, 'true')
    }

    if (!isVisible || !targetRect) return null

    // Create portal to attach to body to avoid z-index issues
    return createPortal(
        <div className="fixed inset-0 z-[100] font-sans">
            {/* Click listener for backdrop (transparent, just handles clicks) */}
            <div
                className="absolute inset-0 z-[100]"
                onClick={handleClose}
            />

            {/* Target Highlight & Visual Backdrop (The Hole) */}
            <div
                className="absolute pointer-events-none z-[105] transition-all duration-300"
                style={{
                    top: targetRect.top - 4,
                    left: targetRect.left - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 8,
                }}
            >
                {/* The Backdrop Hole: Massive shadow creates the dimming outside */}
                <div className="absolute inset-0 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />

                {/* Solid Border (No blur/glow) */}
                <div className="absolute inset-0 rounded-lg border-2 border-violet-500" />
            </div>

            {/* Arrow */}
            <div
                className="absolute z-[110] text-violet-500 pointer-events-none animate-bounce"
                style={{
                    top: targetRect.bottom + 12,
                    left: targetRect.left + targetRect.width / 2,
                    transform: 'translateX(-50%)'
                }}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5" />
                    <path d="M5 12l7-7 7 7" />
                </svg>
            </div>

            {/* Modal - Positioned below arrow, clamped to screen */}
            <div
                className="absolute z-[110]"
                style={{
                    top: targetRect.bottom + 45, // Target bottom + arrow height + spacing
                    left: Math.max(16, Math.min(window.innerWidth - 316, targetRect.left + targetRect.width / 2 - 150)),
                }}
            >
                <div className="w-[300px] bg-zinc-900 border border-violet-500/30 rounded-2xl p-5 shadow-2xl relative animate-in fade-in slide-in-from-top-4 duration-500">
                    <button
                        onClick={handleClose}
                        className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400">
                            <MessageSquare size={20} />
                        </div>
                        <h3 className="font-bold text-white text-lg">Режим Чата</h3>
                    </div>

                    <p className="text-white/80 text-sm leading-relaxed mb-4">
                        Нажмите на выделенную кнопку <b>Chat</b>, чтобы переключиться в режим общения с AI-ассистентом.
                    </p>

                    <div className="flex justify-end">
                        <button
                            onClick={handleClose}
                            className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl text-sm transition-colors flex items-center gap-2"
                        >
                            <span>Понятно</span>
                            <ArrowUpRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
