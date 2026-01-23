import { useTranslation } from 'react-i18next'
import { Clipboard, Image as ImageIcon, Info, Loader2, Lock, Unlock, Video, Volume2, VolumeX, X } from 'lucide-react'
import type { KlingDuration, KlingMCQuality, ModelType, VideoDuration } from '@/store/generationStore'
import type { RefObject } from 'react'

type TranslationFn = ReturnType<typeof useTranslation>['t']

type VideoSettingsProps = {
  t: TranslationFn
  mediaType: 'image' | 'video'
  selectedModel: ModelType
  videoDuration: VideoDuration
  videoResolution: string
  fixedLens: boolean
  generateAudio: boolean
  klingDuration: KlingDuration
  klingSound: boolean
  klingMCQuality: KlingMCQuality
  characterOrientation: 'image' | 'video'
  uploadedImages: string[]
  uploadedVideoUrl: string | null
  videoDurationSeconds: number
  isUploadingVideo: boolean
  videoInputRef: RefObject<HTMLInputElement>
  prompt: string
  onSetVideoDuration: (value: VideoDuration) => void
  onSetVideoResolution: (value: string) => void
  onSetFixedLens: (value: boolean) => void
  onSetGenerateAudio: (value: boolean) => void
  onSetKlingDuration: (value: KlingDuration) => void
  onSetKlingSound: (value: boolean) => void
  onSetKlingMCQuality: (value: KlingMCQuality) => void
  onSetCharacterOrientation: (value: 'image' | 'video') => void
  onSetUploadedImages: (images: string[]) => void
  onSetUploadedVideoUrl: (value: string | null) => void
  onSetVideoDurationSeconds: (value: number) => void
  onSetIsUploadingVideo: (value: boolean) => void
  onSetPrompt: (value: string) => void
  onSetError: (value: string | null) => void
  onImpact: (style: 'light' | 'medium' | 'heavy') => void
}

export function VideoSettings({
  t,
  mediaType,
  selectedModel,
  videoDuration,
  videoResolution,
  fixedLens,
  generateAudio,
  klingDuration,
  klingSound,
  klingMCQuality,
  characterOrientation,
  uploadedImages,
  uploadedVideoUrl,
  videoDurationSeconds,
  isUploadingVideo,
  videoInputRef,
  prompt,
  onSetVideoDuration,
  onSetVideoResolution,
  onSetFixedLens,
  onSetGenerateAudio,
  onSetKlingDuration,
  onSetKlingSound,
  onSetKlingMCQuality,
  onSetCharacterOrientation,
  onSetUploadedImages,
  onSetUploadedVideoUrl,
  onSetVideoDurationSeconds,
  onSetIsUploadingVideo,
  onSetPrompt,
  onSetError,
  onImpact,
}: VideoSettingsProps) {
  return (
    <>
      {mediaType === 'video' && selectedModel === 'seedance-1.5-pro' && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.duration')}</label>
              <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                {(['4', '8', '12'] as VideoDuration[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => { onSetVideoDuration(d); onImpact('light') }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${videoDuration === d ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.resolution')}</label>
              <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                <button
                  onClick={() => { onSetVideoResolution('480p'); onImpact('light') }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${videoResolution === '480p' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  480p
                </button>
                <button
                  onClick={() => { onSetVideoResolution('720p'); onImpact('light') }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${videoResolution === '720p' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  720p
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.camera')}</label>
              <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                <button
                  onClick={() => { onSetFixedLens(true); onImpact('light') }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${fixedLens ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Lock size={12} />
                  {t('studio.video.cameraStatic')}
                </button>
                <button
                  onClick={() => { onSetFixedLens(false); onImpact('light') }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${!fixedLens ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Unlock size={12} />
                  {t('studio.video.cameraDynamic')}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.audio')}</label>
              <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                <button
                  onClick={() => { onSetGenerateAudio(false); onImpact('light') }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${!generateAudio ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <VolumeX size={12} />
                  {t('studio.video.audioOff')}
                </button>
                <button
                  onClick={() => { onSetGenerateAudio(true); onImpact('light') }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${generateAudio ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Volume2 size={12} />
                  {t('studio.video.audioOn')}
                </button>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-zinc-500 px-1">
            {fixedLens ? t('studio.video.cameraStaticHint') : t('studio.video.cameraDynamicHint')}
          </p>
        </div>
      )}

      {mediaType === 'video' && (selectedModel === 'kling-t2v' || selectedModel === 'kling-i2v') && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.kling.duration')}</label>
              <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                {(['5', '10'] as KlingDuration[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => { onSetKlingDuration(d); onImpact('light') }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${klingDuration === d ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.kling.sound')}</label>
              <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
                <button
                  onClick={() => { onSetKlingSound(false); onImpact('light') }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${!klingSound ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <VolumeX size={12} />
                  {t('studio.video.audioOff')}
                </button>
                <button
                  onClick={() => { onSetKlingSound(true); onImpact('light') }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${klingSound ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Volume2 size={12} />
                  {t('studio.video.audioOn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mediaType === 'video' && selectedModel === 'kling-mc' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">1</span>
              {t('studio.kling.mc.uploadImage')}
            </label>
            <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>{t('studio.kling.mc.imageHint')}</span>
            </div>

            {uploadedImages[0] ? (
              <div className="border-2 border-dashed border-white/10 rounded-xl aspect-[4/3] bg-zinc-900/20 relative overflow-hidden">
                <img src={uploadedImages[0]} alt="character-ref" className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    const newImages = [...uploadedImages]
                    newImages[0] = ''
                    onSetUploadedImages(newImages.filter(Boolean))
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*'
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) {
                        const base64 = await new Promise<string>((resolve) => {
                          const reader = new FileReader()
                          reader.onloadend = () => resolve(reader.result as string)
                          reader.readAsDataURL(file)
                        })
                        onSetUploadedImages([base64])
                      }
                    }
                    input.click()
                  }}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-white/10 bg-zinc-900/50 text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-all flex items-center justify-center gap-2"
                >
                  <ImageIcon size={20} />
                  <span>{t('studio.upload.selectPhoto')} 👇</span>
                </button>

                <div
                  contentEditable
                  suppressContentEditableWarning
                  onPaste={async (e) => {
                    e.preventDefault()
                    const items = e.clipboardData?.items
                    if (!items) return
                    for (const item of Array.from(items)) {
                      if (item.type.startsWith('image/')) {
                        const file = item.getAsFile()
                        if (file) {
                          const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader()
                            reader.onloadend = () => resolve(reader.result as string)
                            reader.readAsDataURL(file)
                          })
                          onSetUploadedImages([base64])
                          break
                        }
                      }
                    }
                    e.currentTarget.innerHTML = ''
                  }}
                  onInput={(e) => { e.currentTarget.innerHTML = '' }}
                  className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 flex items-center justify-center gap-2 text-violet-300 text-[10px] font-medium cursor-text select-none focus:outline-none focus:border-violet-500/50"
                >
                  <Clipboard size={14} />
                  <span>{t('studio.upload.paste')}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">2</span>
              {t('studio.kling.mc.orientation')}
            </label>
            <div className="flex items-start gap-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-300 text-xs">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>{t('studio.kling.mc.orientationHint')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { onSetCharacterOrientation('image'); onImpact('light') }}
                className={`p-3 rounded-xl border transition-all ${characterOrientation === 'image' ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/10 bg-zinc-900/50'}`}
              >
                <ImageIcon size={20} className={`mx-auto mb-1 ${characterOrientation === 'image' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                <div className={`text-xs font-bold ${characterOrientation === 'image' ? 'text-white' : 'text-zinc-400'}`}>🖼 {t('studio.kling.mc.asImage')}</div>
                <div className="text-[10px] text-zinc-500">{t('studio.kling.mc.asImageDesc1')}</div>
                <div className="text-[10px] text-cyan-400/70">• {t('studio.kling.mc.max10s')}</div>
              </button>
              <button
                onClick={() => { onSetCharacterOrientation('video'); onImpact('light') }}
                className={`p-3 rounded-xl border transition-all ${characterOrientation === 'video' ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/10 bg-zinc-900/50'}`}
              >
                <Video size={20} className={`mx-auto mb-1 ${characterOrientation === 'video' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                <div className={`text-xs font-bold ${characterOrientation === 'video' ? 'text-white' : 'text-zinc-400'}`}>🎬 {t('studio.kling.mc.asVideo')}</div>
                <div className="text-[10px] text-zinc-500">{t('studio.kling.mc.asVideoDesc1')}</div>
                <div className="text-[10px] text-cyan-400/70">• {t('studio.kling.mc.max30s')}</div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">3</span>
              {t('studio.kling.mc.uploadVideo')}
            </label>
            <div className="flex items-start gap-2 p-2 bg-violet-500/10 border border-violet-500/20 rounded-lg text-violet-300 text-xs">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>{t('studio.kling.mc.videoHint')}</span>
            </div>

            <input
              type="file"
              accept="video/mp4,video/quicktime,video/mov"
              ref={videoInputRef}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return

                onSetIsUploadingVideo(true)
                const video = document.createElement('video')
                video.preload = 'metadata'
                video.onloadedmetadata = () => {
                  const duration = Math.round(video.duration)
                  onSetVideoDurationSeconds(duration)

                  const reader = new FileReader()
                  reader.onload = () => {
                    onSetUploadedVideoUrl(reader.result as string)
                    onSetIsUploadingVideo(false)
                  }
                  reader.onerror = () => onSetIsUploadingVideo(false)
                  reader.readAsDataURL(file)
                }
                video.onerror = () => onSetIsUploadingVideo(false)
                video.src = URL.createObjectURL(file)
              }}
            />

            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploadingVideo}
              className="w-full py-4 rounded-xl border-2 border-dashed border-white/10 bg-zinc-900/50 text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploadingVideo ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  {t('studio.upload.loading')}
                </>
              ) : (
                <>
                  <Video size={20} />
                  {uploadedVideoUrl ? t('studio.kling.mc.changeVideo') : <>{t('studio.kling.mc.selectVideo')} 👇</>}
                </>
              )}
            </button>

            {uploadedVideoUrl && (
              <div className={`flex items-center gap-2 p-2 rounded-lg border ${(characterOrientation === 'image' ? videoDurationSeconds <= 10 : videoDurationSeconds <= 30)
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-rose-500/10 border-rose-500/30'
                }`}>
                <Video size={16} className={(characterOrientation === 'image' ? videoDurationSeconds <= 10 : videoDurationSeconds <= 30) ? 'text-green-400' : 'text-rose-400'} />
                <div className="flex-1 flex flex-col">
                  <span className={`text-xs ${(characterOrientation === 'image' ? videoDurationSeconds <= 10 : videoDurationSeconds <= 30) ? 'text-green-200' : 'text-rose-200'}`}>
                    {videoDurationSeconds}s {t('studio.media.video', 'video')}
                  </span>
                  <span className="text-[10px] text-white/50">
                    {(characterOrientation === 'image' ? videoDurationSeconds <= 10 : videoDurationSeconds <= 30)
                      ? t('studio.kling.mc.validDuration')
                      : t('studio.kling.mc.invalidDuration')}
                  </span>
                </div>
                <button
                  onClick={() => { onSetUploadedVideoUrl(null); onSetVideoDurationSeconds(0); onSetError(null) }}
                  className="text-white/50 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px]">4</span>
              {t('studio.kling.mc.quality')}
            </label>
            <div className="flex gap-1 p-0.5 bg-zinc-900/50 rounded-xl border border-white/5">
              <button
                onClick={() => { onSetKlingMCQuality('720p'); onImpact('light') }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${klingMCQuality === '720p' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                720p · 6⚡/{t('studio.kling.mc.perSec')}
              </button>
              <button
                onClick={() => { onSetKlingMCQuality('1080p'); onImpact('light') }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${klingMCQuality === '1080p' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                1080p · 9⚡/{t('studio.kling.mc.perSec')}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500/50 text-white flex items-center justify-center text-[10px]">5</span>
              {t('studio.kling.mc.optionalPrompt')}
              <span className="text-[10px] text-zinc-500 font-normal">({t('studio.kling.mc.optional')})</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => onSetPrompt(e.target.value)}
              placeholder={t('studio.kling.mc.promptPlaceholder')}
              className="w-full min-h-[80px] bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-3 text-white placeholder-zinc-500 text-sm resize-none focus:border-cyan-500/30 focus:outline-none transition-colors"
            />
            <div className="flex items-start gap-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-300 text-[10px]">
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>{t('studio.kling.mc.promptHint')}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
