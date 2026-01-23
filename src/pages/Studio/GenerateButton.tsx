import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ImageCount } from '@/store/generationStore'

type TranslationFn = ReturnType<typeof useTranslation>['t']

type GenerateButtonProps = {
  t: TranslationFn
  mediaType: 'image' | 'video'
  imageCount: ImageCount
  availableSlots: number
  showCountSelector: boolean
  isDisabled: boolean
  priceLabel: string
  onToggleCountSelector: () => void
  onCloseCountSelector: () => void
  onSelectImageCount: (value: ImageCount) => void
  onImpact: (style: 'light' | 'medium' | 'heavy') => void
  onGenerate: () => void
}

export function GenerateButton({
  t,
  mediaType,
  imageCount,
  availableSlots,
  showCountSelector,
  isDisabled,
  priceLabel,
  onToggleCountSelector,
  onCloseCountSelector,
  onSelectImageCount,
  onImpact,
  onGenerate,
}: GenerateButtonProps) {
  return (
    <div className="">
      <div className="flex gap-2">
        {mediaType === 'image' && (() => {
          const maxAvailable = Math.min(4, Math.max(1, availableSlots)) as ImageCount

          return (
            <div className="relative">
              <button
                onClick={() => { onToggleCountSelector(); onImpact('light') }}
                className="h-full px-4 rounded-xl bg-zinc-800 border border-white/10 text-white font-bold flex items-center gap-1.5 hover:bg-zinc-700 transition-colors min-w-[56px] justify-center"
              >
                <span className="text-lg">{Math.min(imageCount, maxAvailable)}</span>
                <span className="text-[10px] text-zinc-400">×</span>
              </button>

              {showCountSelector && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={onCloseCountSelector}
                  />
                  <div className="absolute bottom-full left-0 mb-2 bg-zinc-800 border border-white/10 rounded-xl overflow-hidden shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    {([1, 2, 3, 4] as ImageCount[]).map((count) => {
                      const isDisabled = count > availableSlots
                      return (
                        <button
                          key={count}
                          disabled={isDisabled}
                          onClick={() => {
                            if (!isDisabled) {
                              onSelectImageCount(count)
                              onCloseCountSelector()
                              onImpact('light')
                            }
                          }}
                          className={`w-full px-5 py-2.5 text-sm font-medium flex items-center justify-center gap-1 transition-colors ${isDisabled
                            ? 'text-zinc-600 cursor-not-allowed'
                            : imageCount === count
                              ? 'bg-violet-600 text-white'
                              : 'text-zinc-300 hover:bg-zinc-700'
                            }`}
                        >
                          <span className="text-lg">{count}</span>
                          <span className="text-[10px] text-zinc-400">×</span>
                          {isDisabled && <span className="text-[9px] ml-1">🔒</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )
        })()}

        <Button
          onClick={onGenerate}
          disabled={isDisabled}
          className="flex-1 py-6 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-[0.98] relative overflow-hidden group bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-violet-500/25 border border-white/10"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          <div className="relative flex items-center gap-2">
            <Sparkles size={20} />
            <span>{t('studio.generate.button')}</span>
            <span className="bg-black/20 px-2 py-0.5 rounded text-xs font-normal ml-1">
              {priceLabel}
            </span>
          </div>
        </Button>
      </div>
    </div>
  )
}
