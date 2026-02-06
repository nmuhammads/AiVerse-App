import { Share, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface IOSInstallPromptProps {
  onClose: () => void
}

export function IOSInstallPrompt({ onClose }: IOSInstallPromptProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger animation after mount
    setTimeout(() => setIsVisible(true), 10)
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-end justify-center transition-all duration-300 ${
        isVisible ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`w-full max-w-lg bg-zinc-900 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 border-b border-white/10">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
          <h2 className="text-xl font-bold text-white">Установить AiVerse</h2>
          <p className="text-sm text-zinc-400 mt-1">Добавьте приложение на главный экран</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold">1</span>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium mb-2">Нажмите кнопку "Поделиться"</p>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800 border border-white/10">
                <Share size={20} className="text-blue-500" />
                <span className="text-sm text-zinc-300">Найдите внизу экрана</span>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold">2</span>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium mb-2">Выберите "На экран Домой"</p>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-800 border border-white/10">
                <Plus size={20} className="text-white" />
                <span className="text-sm text-zinc-300">На экран "Домой"</span>
              </div>
            </div>
          </div>

          {/* Visual indicator */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-blue-600/20 rounded-2xl blur-xl" />
            <div className="relative p-4 rounded-2xl bg-zinc-800/50 border border-white/10 backdrop-blur-sm">
              <p className="text-xs text-zinc-400 text-center">
                После установки приложение будет работать как обычное приложение с главного экрана
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold transition-colors"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  )
}
