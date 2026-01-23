import { useTranslation } from 'react-i18next'
import type { AspectRatio, GptImageQuality, ModelType } from '@/store/generationStore'

type TranslationFn = ReturnType<typeof useTranslation>['t']

type SettingsPanelProps = {
  t: TranslationFn
  selectedModel: ModelType
  ratios: AspectRatio[]
  aspectRatio: AspectRatio
  ratioEmojis: Record<AspectRatio, string>
  ratioDisplayNames: Record<string, string>
  gptImageQuality: GptImageQuality
  gptImagePrices: Record<GptImageQuality, number>
  resolution: '2K' | '4K'
  onSetAspectRatio: (value: AspectRatio) => void
  onSetResolution: (value: '2K' | '4K') => void
  onSetGptImageQuality: (value: GptImageQuality) => void
  onImpact: (style: 'light' | 'medium' | 'heavy') => void
}

export function SettingsPanel({
  t,
  selectedModel,
  ratios,
  aspectRatio,
  ratioEmojis,
  ratioDisplayNames,
  gptImageQuality,
  gptImagePrices,
  resolution,
  onSetAspectRatio,
  onSetResolution,
  onSetGptImageQuality,
  onImpact,
}: SettingsPanelProps) {
  return (
    <>
      {selectedModel !== 'kling-mc' && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.aspectRatio')}</label>
          <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar -mx-2 px-2">
            {ratios.map(r => (
              <button
                key={r}
                onClick={() => { onSetAspectRatio(r); onImpact('light') }}
                className={`flex-shrink-0 w-14 h-14 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all overflow-hidden ${aspectRatio === r ? 'bg-white text-black border-white shadow-lg shadow-white/10 scale-105' : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:bg-zinc-800'}`}
              >
                <span className="text-lg leading-none">{ratioEmojis[r]}</span>
                <span className={`leading-none ${aspectRatio === r ? 'opacity-100' : 'opacity-60'}`}>{ratioDisplayNames[r] || r}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedModel === 'nanobanana-pro' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.quality.label')}</label>
          <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-xl border border-white/5">
            <button
              onClick={() => { onSetResolution('2K'); onImpact('light') }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${resolution === '2K' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              2K · 10 ⚡
            </button>
            <button
              onClick={() => { onSetResolution('4K'); onImpact('light') }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${resolution === '4K' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              4K · 15 ⚡
            </button>
          </div>
        </div>
      )}

      {selectedModel === 'gpt-image-1.5' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.quality.label')}</label>
          <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-xl border border-white/5">
            <button
              onClick={() => { onSetGptImageQuality('medium'); onImpact('light') }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${gptImageQuality === 'medium' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Medium · {gptImagePrices.medium} ⚡
            </button>
            <button
              onClick={() => { onSetGptImageQuality('high'); onImpact('light') }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${gptImageQuality === 'high' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              High · {gptImagePrices.high} ⚡
            </button>
          </div>
        </div>
      )}
    </>
  )
}
