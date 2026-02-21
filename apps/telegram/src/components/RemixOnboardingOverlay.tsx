import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Image as ImageIcon, ArrowUpRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useGenerationStore } from '@/store/generationStore'
import { useSearchParams } from 'react-router-dom'

declare global {
    interface Window {
        __remixScrollTriggered?: boolean;
    }
}

const STORAGE_KEY = 'has_seen_remix_onboarding_v1'
const CHAT_ONBOARDING_KEY = 'has_seen_chat_onboarding_v1'

export function RemixOnboardingOverlay() {
    const { t } = useTranslation()
    const { generationMode, uploadedImages } = useGenerationStore()
    const [searchParams] = useSearchParams()
    const isRemix = searchParams.get('remix') !== null

    const [isVisible, setIsVisible] = useState(false)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    const [retryCount, setRetryCount] = useState(0)

    useEffect(() => {
        // Only show for remix deep links
        if (!isRemix) {
            console.log('[RemixOnboarding] Not a remix deeplink')
            return
        }

        // Only show if the user is in 'image' mode and hasn't uploaded any images yet
        if (generationMode !== 'image' || uploadedImages.length > 0) {
            console.log(`[RemixOnboarding] Wrong mode or images present. Mode: ${generationMode}, Images: ${uploadedImages.length}`)
            setIsVisible(false)
            return
        }

        // Check if already seen
        const hasSeen = localStorage.getItem(STORAGE_KEY)
        if (hasSeen) {
            console.log('[RemixOnboarding] Already seen, aborting')
            return
        }

        // Check if chat onboarding is done (we don't want to show two overlays at once)
        const hasSeenChatOnboarding = localStorage.getItem(CHAT_ONBOARDING_KEY)
        if (!hasSeenChatOnboarding) {
            console.log(`[RemixOnboarding] Waiting for chat onboarding to finish... Retry: ${retryCount}`)
            // Wait for chat onboarding to finish, retry every second
            const waitTimer = setTimeout(() => setRetryCount(prev => prev + 1), 1000)
            return () => clearTimeout(waitTimer)
        }

        console.log(`[RemixOnboarding] Conditions met, checking target. Retry: ${retryCount}`)

        // Try to find the target element (the upload box)
        const checkTarget = () => {
            const element = document.getElementById('remix-upload-target')
            if (element) {
                const rect = element.getBoundingClientRect()
                console.log(`[RemixOnboarding] Target found: rect=${JSON.stringify(rect)}`)
                // Ensure the element has dimension
                if (rect.width > 0 && rect.height > 0) {
                    // Check if element is out of viewport (too low OR too high)
                    if (rect.top > window.innerHeight - 100 || rect.bottom < 50) {
                        console.log('[RemixOnboarding] Element is outside viewport, scrolling...')

                        // Use a flag to prevent multiple scroll commands overlapping too quickly
                        if (!window.__remixScrollTriggered) {
                            window.__remixScrollTriggered = true
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            setTimeout(() => { window.__remixScrollTriggered = false }, 1000)
                        }

                        // Wait for scroll to progress
                        setTimeout(() => setRetryCount(prev => prev + 1), 600)
                    } else {
                        console.log('[RemixOnboarding] Element is visible! Setting visibility to true.')
                        setTargetRect(rect)
                        setIsVisible(true)
                    }
                } else if (retryCount < 50) {
                    // Retry more times if element is not fully rendered
                    console.log('[RemixOnboarding] Element has 0 dimension, retrying...')
                    setTimeout(() => setRetryCount(prev => prev + 1), 500)
                }
            } else if (retryCount < 50) {
                // Retry if element not found immediately
                console.log('[RemixOnboarding] Element not found in DOM, retrying...')
                setTimeout(() => setRetryCount(prev => prev + 1), 500)
            }
        }

        const timer = setTimeout(checkTarget, 500)
        return () => clearTimeout(timer)
    }, [retryCount, generationMode, uploadedImages.length, isRemix])

    const handleClose = () => {
        setIsVisible(false)
        localStorage.setItem(STORAGE_KEY, 'true')
    }

    if (!isVisible || !targetRect) return null

    // Create portal to attach to body to avoid z-index issues
    return createPortal(
        <div className="fixed inset-0 z-[100] font-sans">
            {/* Click listener for backdrop */}
            <div
                className="absolute inset-0 z-[100]"
                onClick={handleClose}
            />

            {/* Target Highlight & Visual Backdrop */}
            <div
                className="absolute pointer-events-none z-[105] transition-all duration-300"
                style={{
                    top: targetRect.top - 8,
                    left: targetRect.left - 8,
                    width: targetRect.width + 16,
                    height: targetRect.height + 16,
                }}
            >
                {/* The Backdrop Hole */}
                <div className="absolute inset-0 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]" />

                {/* Solid Border */}
                <div className="absolute inset-0 rounded-2xl border-2 border-lime-400" />
            </div>

            {/* Arrow */}
            <div
                className="absolute z-[110] text-lime-400 pointer-events-none animate-bounce"
                style={{
                    top: targetRect.top - 40,
                    left: targetRect.left + targetRect.width / 2,
                    transform: 'translateX(-50%)'
                }}
            >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" />
                    <path d="M19 12l-7 7-7-7" />
                </svg>
            </div>

            {/* Modal */}
            <div
                className="absolute z-[110]"
                style={{
                    bottom: window.innerHeight - targetRect.top + 50, // Positioned above the target
                    left: Math.max(16, Math.min(window.innerWidth - 316, targetRect.left + targetRect.width / 2 - 150)),
                }}
            >
                <div className="w-[300px] bg-zinc-900 border border-lime-400/30 rounded-2xl p-5 shadow-2xl relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <button
                        onClick={handleClose}
                        className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-lime-400/20 flex items-center justify-center text-lime-400">
                            <ImageIcon size={20} />
                        </div>
                        <h3 className="font-bold text-white text-lg">{t('remixOnboarding.title', 'Добавьте референс')}</h3>
                    </div>

                    <p className="text-white/80 text-sm leading-relaxed mb-4">
                        {t('remixOnboarding.description', 'Загрузите ваше фото в эту область, а затем нажмите кнопку Сгенерировать, чтобы применить промпт к вашему изображению.')}
                    </p>

                    <div className="flex justify-end">
                        <button
                            onClick={handleClose}
                            className="px-5 py-2.5 bg-lime-400 hover:bg-lime-500 text-black font-bold rounded-xl text-sm transition-colors flex items-center gap-2"
                        >
                            <span>{t('remixOnboarding.button', 'Понятно')}</span>
                            <ArrowUpRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
