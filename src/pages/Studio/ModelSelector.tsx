import { useTranslation } from 'react-i18next'
import { ChevronRight, Image as ImageIcon, Layers, Type, Video, Zap } from 'lucide-react'
import type { KlingVideoMode, ModelType } from '@/store/generationStore'

type TranslationFn = ReturnType<typeof useTranslation>['t']
type ImpactFn = (style: 'light' | 'medium' | 'heavy') => void

type ImageModel = {
  id: ModelType
  icon: string
}

type VideoModel = {
  id: ModelType
  color: string
  icon: string
}

type ModelSelectorProps = {
  t: TranslationFn
  mediaType: 'image' | 'video'
  selectedModel: ModelType
  generationMode: 'text' | 'image'
  klingVideoMode: KlingVideoMode
  impact: ImpactFn
  imageModels: ImageModel[]
  videoModels: VideoModel[]
  setMediaType: (value: 'image' | 'video') => void
  setSelectedModel: (value: ModelType) => void
  setGenerationMode: (value: 'text' | 'image') => void
  setUploadedImages: (value: string[]) => void
  setUploadedVideoUrl: (value: string | null) => void
  setKlingVideoMode: (value: KlingVideoMode) => void
  onOpenMultiGeneration: () => void
}

export function ModelSelector({
  t,
  mediaType,
  selectedModel,
  generationMode,
  klingVideoMode,
  impact,
  imageModels,
  videoModels,
  setMediaType,
  setSelectedModel,
  setGenerationMode,
  setUploadedImages,
  setUploadedVideoUrl,
  setKlingVideoMode,
  onOpenMultiGeneration,
}: ModelSelectorProps) {
  return (
    <>
      <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
        <button
          onClick={() => {
            setMediaType('image')
            if (selectedModel === 'seedance-1.5-pro') {
              setSelectedModel('nanobanana-pro')
            }
            impact('light')
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-sm font-bold transition-all ${mediaType === 'image' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <ImageIcon size={16} />
          <span>{t('studio.mediaType.image')}</span>
        </button>
        <button
          onClick={() => {
            setMediaType('video')
            setSelectedModel('seedance-1.5-pro')
            impact('light')
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-sm font-bold transition-all ${mediaType === 'video' ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Video size={16} />
          <span>{t('studio.mediaType.video')}</span>
        </button>
      </div>

      {mediaType === 'image' && (
        <div className="grid grid-cols-4 gap-2">
          {imageModels.map(m => {
            const isSelected = selectedModel === m.id
            return (
              <button
                key={m.id}
                onClick={() => { setSelectedModel(m.id); impact('light') }}
                className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all duration-200 ${isSelected
                  ? 'bg-zinc-800 shadow-lg'
                  : 'bg-zinc-900/40 hover:bg-zinc-800/60'
                  }`}
              >
                <div className={`w-10 h-10 rounded-xl overflow-hidden shadow-md transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}>
                  <img src={m.icon} alt={t(`studio.models.${m.id}.name`)} className="w-full h-full object-cover" />
                </div>
                <span className={`text-[10px] font-semibold text-center leading-tight ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                  {t(`studio.models.${m.id}.name`)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {mediaType === 'image' && (
        <button
          onClick={onOpenMultiGeneration}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 flex items-center justify-between group active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
              <Layers size={20} />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-white group-hover:text-pink-200 transition-colors">
                {t('multiGeneration.title')}
              </div>
              <div className="text-[10px] text-zinc-400">
                {t('multiGeneration.desc')}
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
        </button>
      )}

      {mediaType === 'video' && (
        <div className="grid grid-cols-2 gap-3">
          {videoModels.map(m => {
            const isKlingModel = m.id === 'kling-t2v'
            const isSelected = isKlingModel
              ? ['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel)
              : selectedModel === m.id
            return (
              <button
                key={m.id}
                onClick={() => {
                  if (isKlingModel) {
                    const klingModel = klingVideoMode === 'motion-control' ? 'kling-mc' : klingVideoMode === 'i2v' ? 'kling-i2v' : 'kling-t2v'
                    setSelectedModel(klingModel)
                    if (klingVideoMode === 't2v') setGenerationMode('text')
                    else setGenerationMode('image')
                  } else {
                    setSelectedModel(m.id as ModelType)
                  }
                  impact('light')
                }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isSelected
                  ? `bg-gradient-to-r ${m.color} shadow-lg`
                  : 'bg-zinc-900/50 border border-white/5 hover:bg-zinc-800/60'
                  }`}
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md">
                  <img src={m.icon} alt={t(`studio.models.${m.id}.name`)} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 text-left">
                  <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{t(`studio.models.${m.id}.name`)}</div>
                  <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-zinc-500'}`}>{t(`studio.models.${m.id}.desc`)}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {mediaType === 'image' && (
        <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
          <button
            onClick={() => { setGenerationMode('text'); impact('light') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${generationMode === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Type size={14} />
            <span>{t('studio.mode.textToImage')}</span>
          </button>
          <button
            onClick={() => { setGenerationMode('image'); impact('light') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${generationMode === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <ImageIcon size={14} />
            <span>{t('studio.mode.imageToImage')}</span>
          </button>
        </div>
      )}

      {mediaType === 'video' && selectedModel === 'seedance-1.5-pro' && (
        <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
          <button
            onClick={() => { setGenerationMode('text'); setUploadedImages([]); impact('light') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${generationMode === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Type size={14} />
            <span>{t('studio.mode.textToVideo')}</span>
          </button>
          <button
            onClick={() => { setGenerationMode('image'); impact('light') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${generationMode === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <ImageIcon size={14} />
            <span>{t('studio.mode.imageToVideo')}</span>
          </button>
        </div>
      )}

      {mediaType === 'video' && ['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) && (
        <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
          <button
            onClick={() => {
              setKlingVideoMode('t2v')
              setSelectedModel('kling-t2v')
              setGenerationMode('text')
              setUploadedImages([])
              setUploadedVideoUrl(null)
              impact('light')
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${klingVideoMode === 't2v' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Type size={14} />
            <span>{t('studio.kling.t2v', 'T2V')}</span>
          </button>
          <button
            onClick={() => {
              setKlingVideoMode('i2v')
              setSelectedModel('kling-i2v')
              setGenerationMode('image')
              setUploadedVideoUrl(null)
              impact('light')
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${klingVideoMode === 'i2v' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <ImageIcon size={14} />
            <span>{t('studio.kling.i2v', 'I2V')}</span>
          </button>
          <button
            onClick={() => {
              setKlingVideoMode('motion-control')
              setSelectedModel('kling-mc')
              setGenerationMode('image')
              impact('light')
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${klingVideoMode === 'motion-control' ? 'bg-zinc-800 text-white shadow-sm' : 'text-purple-400 hover:text-purple-300'}`}
            style={klingVideoMode !== 'motion-control' ? { textShadow: '0 0 10px rgba(168, 85, 247, 0.5)' } : undefined}
          >
            <Zap size={14} />
            <span>{t('studio.kling.motionControl', 'Motion Control')}</span>
          </button>
        </div>
      )}
    </>
  )
}
