import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Image as ImageIcon, Loader2, Sparkles, Wand2, X, Info } from 'lucide-react'
import { type ModelType } from '@/store/generationStore'

type TranslationFn = ReturnType<typeof useTranslation>['t']

type PromptInputProps = {
  t: TranslationFn
  prompt: string
  isPromptPrivate: boolean
  parentAuthorUsername: string | null
  isOptimizing: boolean
  onPromptChange: (value: string) => void
  onClearPrompt: () => void
  onClearParent: () => void
  onOptimize: () => void
  onDescribe: () => void
  selectedModel: ModelType
}

export function PromptInput({
  t,
  prompt,
  isPromptPrivate,
  parentAuthorUsername,
  isOptimizing,
  onPromptChange,
  onClearPrompt,
  onClearParent,
  onOptimize,
  onDescribe,
  selectedModel,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleFocus = () => {
    // Небольшая задержка для корректной работы с виртуальной клавиатурой
    setTimeout(() => {
      if (!textareaRef.current) return

      const rect = textareaRef.current.getBoundingClientRect()
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      // Позиционируем поле в верхней трети видимой области (примерно 30% от верха)
      const targetPosition = viewportHeight * 0.25
      const scrollOffset = rect.top - targetPosition

      window.scrollBy({
        top: scrollOffset,
        behavior: 'smooth'
      })
    }, 300)
  }

  return (
    <div className="relative mt-1">
      {parentAuthorUsername && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-violet-400 animate-in fade-in slide-in-from-bottom-2 mb-1 px-1">
          <Sparkles size={12} />
          <span>{t('studio.prompt.from', { username: parentAuthorUsername })}</span>

          <button
            onClick={onClearParent}
            className="ml-1 p-0.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      )}
      <div className="prompt-container group relative">
        {isPromptPrivate && parentAuthorUsername ? (
          <>
            <div className="prompt-input min-h-[120px] bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-amber-500/30 !flex items-center justify-center">
              <span className="text-zinc-400 italic">{t('profile.preview.hiddenByAuthor')}</span>
            </div>
          </>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onFocus={handleFocus}
              placeholder={t('studio.prompt.placeholder')}
              style={{ scrollMarginTop: '100px' }}
              className={`prompt-input min-h-[120px] bg-zinc-900/30 backdrop-blur-sm no-scrollbar ${parentAuthorUsername ? 'border-violet-500/30 focus:border-violet-500/50' : ''}`}
            />
            {prompt && (
              <button
                onClick={onClearPrompt}
                className="absolute top-3 right-3 p-1.5 bg-zinc-800/50 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors z-10"
              >
                <X size={14} />
              </button>
            )}
          </>
        )}
      </div>

      {selectedModel === 'qwen-image' && (
        <div className="flex items-center gap-2 mt-2 px-1 animate-in fade-in slide-in-from-top-1">
          <Info size={14} className="text-violet-400 shrink-0" />
          <p className="text-xs text-violet-300 font-medium">
            Подсказка: эта модель лучше понимает запросы на английском языке
          </p>
        </div>
      )}

      {!isPromptPrivate && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={onOptimize}
            disabled={isOptimizing || !prompt.trim()}
            className={`flex-1 h-9 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${prompt.trim() && !isOptimizing
              ? 'bg-gradient-to-r from-violet-600/80 to-purple-600/80 hover:from-violet-600 hover:to-purple-600 text-white'
              : 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed'
              }`}
          >
            {isOptimizing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t('studio.promptHelper.optimizing')}
              </>
            ) : (
              <>
                <Wand2 size={14} />
                {t('studio.promptHelper.optimize')}
              </>
            )}
          </button>
          <button
            onClick={onDescribe}
            className="flex-1 h-9 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <ImageIcon size={14} />
            {t('studio.promptHelper.describe')}
          </button>
        </div>
      )}
    </div>
  )
}
