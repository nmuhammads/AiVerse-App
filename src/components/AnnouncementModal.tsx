import { useState, useEffect } from 'react'
import { X, Zap } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'

// Configuration for the current announcement
const ANNOUNCEMENT = {
    id: 'announcement_nanobanana_fix_v2', // Change this ID to show a new announcement to everyone
    title: 'NanoBanana Pro Исправлен + Скидки!',
    description: 'Мы исправили ошибки в генерации NanoBanana Pro. Также добавили возможность выбора качества: теперь доступна 2K генерация всего за 10 токенов! Если вы теряли токены из-за ошибок, пишите в поддержку.',
    image: 'https://cdn.midjourney.com/0c609677-440d-4056-a8a2-201804193556/0_0.png', // Placeholder image
    buttonText: 'Попробовать',
    link: '', // Close modal on click
    secondaryButtonText: 'Написать в поддержку',
    secondaryLink: 'https://t.me/aiversebots'
}

export function AnnouncementModal() {
    const [isOpen, setIsOpen] = useState(false)
    const { impact } = useHaptics()

    useEffect(() => {
        // Check if this specific announcement has been seen
        const seen = localStorage.getItem(`seen_${ANNOUNCEMENT.id}`)
        if (!seen) {
            // Small delay for better UX
            const timer = setTimeout(() => {
                setIsOpen(true)
                impact('light')
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleClose = () => {
        impact('light')
        setIsOpen(false)
        // Mark as seen
        localStorage.setItem(`seen_${ANNOUNCEMENT.id}`, 'true')
    }

    const handleAction = () => {
        impact('medium')
        if (ANNOUNCEMENT.link) {
            window.open(ANNOUNCEMENT.link, '_blank')
        }
        handleClose()
    }

    const handleSecondaryAction = () => {
        impact('medium')
        if (ANNOUNCEMENT.secondaryLink) {
            window.open(ANNOUNCEMENT.secondaryLink, '_blank')
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300 flex flex-col">

                {/* Image Header */}
                <div className="relative h-48 bg-zinc-800 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent z-10" />
                    <img
                        src="/announcement_bg.png"
                        alt="Announcement"
                        className="w-full h-full object-cover"
                    />

                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 pt-2 flex flex-col items-center text-center relative z-20 -mt-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/30 mb-4 border border-white/10">
                        <Zap size={24} className="text-white" fill="currentColor" />
                    </div>

                    <h2 className="text-xl font-bold text-white mb-2">
                        {ANNOUNCEMENT.title}
                    </h2>

                    <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                        {ANNOUNCEMENT.description}
                    </p>

                    <div className="w-full space-y-3">
                        <button
                            onClick={handleAction}
                            className="w-full py-3.5 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5 active:scale-[0.98] transition-transform"
                        >
                            {ANNOUNCEMENT.buttonText}
                        </button>

                        {ANNOUNCEMENT.secondaryButtonText && (
                            <button
                                onClick={handleSecondaryAction}
                                className="w-full py-3.5 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors border border-white/5 active:scale-[0.98] transition-transform"
                            >
                                {ANNOUNCEMENT.secondaryButtonText}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
