import { useGenerationStore } from '@/store/generationStore'
import { cn } from '@/lib/utils'

export function StudioModeToggle() {
    const { studioMode, setStudioMode } = useGenerationStore()

    return (
        <div className="flex items-center gap-1.5 select-none">
            <button
                id="studio-mode-toggle"
                onClick={() => setStudioMode('studio')}
                className={cn(
                    "text-xl transition-all duration-300",
                    studioMode === 'studio'
                        ? "text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400"
                        : "font-bold text-zinc-600 hover:text-zinc-400"
                )}
            >
                Studio
            </button>
            <span className="text-2xl text-zinc-600 font-light">|</span>
            <button
                id="chat-mode-toggle"
                onClick={() => setStudioMode('chat')}
                className={cn(
                    "text-xl transition-all duration-300",
                    studioMode === 'chat'
                        ? "text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400"
                        : "font-bold text-zinc-600 hover:text-zinc-400"
                )}
            >
                Chat
            </button>
        </div>
    )
}
