import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Download as DownloadIcon, Maximize2, Pencil, Send, Volume2, VolumeX, X } from 'lucide-react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

type TranslationFn = ReturnType<typeof useTranslation>['t']

type ResultViewProps = {
  t: TranslationFn
  platform: string | undefined
  resultUrl: string
  isVideoResult: boolean
  hasMultipleImages: boolean
  generatedImages: string[]
  currentImageIndex: number
  isMuted: boolean
  isFullScreen: boolean
  onToggleMuted: () => void
  onOpenFullScreen: () => void
  onCloseFullScreen: () => void
  onPrevImage: () => void
  onNextImage: () => void
  onSelectImage: (index: number) => void
  onSave: () => void
  onSendToChat: () => void
  onEdit: () => void
  onClose: () => void
}

export function ResultView({
  t,
  platform,
  resultUrl,
  isVideoResult,
  hasMultipleImages,
  generatedImages,
  currentImageIndex,
  isMuted,
  isFullScreen,
  onToggleMuted,
  onOpenFullScreen,
  onCloseFullScreen,
  onPrevImage,
  onNextImage,
  onSelectImage,
  onSave,
  onSendToChat,
  onEdit,
  onClose,
}: ResultViewProps) {
  const paddingTopResult = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 10px)' : 'calc(env(safe-area-inset-top) + 50px)'
  const paddingBottomResult = platform === 'ios' ? 'calc(env(safe-area-inset-bottom) + 96px)' : '120px'

  return (
    <div className="min-h-dvh bg-black flex flex-col justify-end px-4" style={{ paddingTop: paddingTopResult, paddingBottom: paddingBottomResult }}>
      <div className="flex-1 flex items-center justify-center mb-4 relative">
        {isVideoResult ? (
          <>
            {console.log('[Studio Video]', { resultUrl })}
            <video
              src={resultUrl}
              controls
              loop
              muted={isMuted}
              playsInline
              className="max-w-full max-h-[60vh] object-contain rounded-xl"
              onLoadStart={() => console.log('[Studio Video] Load started, url:', resultUrl)}
              onLoadedData={() => console.log('[Studio Video] Data loaded successfully')}
              onCanPlay={() => console.log('[Studio Video] Can play now')}
              onError={(e) => {
                const video = e.currentTarget
                console.error('[Studio Video] Error:', {
                  url: resultUrl,
                  errorCode: video.error?.code,
                  errorMsg: video.error?.message,
                  networkState: video.networkState,
                  readyState: video.readyState
                })
              }}
            />
            <button
              onClick={onToggleMuted}
              className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </>
        ) : (
          <>
            <img
              src={resultUrl}
              alt="result"
              className="max-w-full max-h-[60vh] object-contain rounded-xl"
              onClick={onOpenFullScreen}
            />
            {hasMultipleImages && (
              <>
                <button
                  onClick={onPrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={onNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {generatedImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectImage(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                    />
                  ))}
                </div>
              </>
            )}
            {!hasMultipleImages && (
              <button
                onClick={onOpenFullScreen}
                className="absolute right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md"
                style={{ top: 'calc(env(safe-area-inset-top) + 60px)' }}
              >
                <Maximize2 size={18} />
              </button>
            )}
          </>
        )}
      </div>

      <div className="bg-zinc-900/95 backdrop-blur-lg border border-white/10 rounded-2xl p-4 space-y-3">
        {hasMultipleImages && (
          <div className="text-center text-xs text-zinc-400 mb-1">
            {currentImageIndex + 1} / {generatedImages.length}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onSave}
            className="flex-1 py-3 rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
          >
            <DownloadIcon size={18} />
            <span className="text-sm">{t('studio.result.save')}</span>
          </button>
          <button
            onClick={onSendToChat}
            className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-violet-500 transition-colors"
          >
            <Send size={18} />
            <span className="text-sm">{t('studio.result.sendToChat')}</span>
          </button>
        </div>

        <div className="flex gap-2">
          {!isVideoResult && (
            <button
              onClick={onEdit}
              className="flex-1 py-2.5 rounded-xl bg-cyan-600/20 text-cyan-400 text-sm font-medium flex items-center justify-center gap-2 border border-cyan-500/30 hover:bg-cyan-600/30 transition-colors"
            >
              <Pencil size={16} />
              {t('editor.edit')}
            </button>
          )}
          <button
            onClick={onClose}
            className={`${!isVideoResult ? 'flex-1' : 'w-full'} py-2.5 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-medium flex items-center justify-center gap-2 border border-white/10 hover:bg-zinc-700 hover:text-white transition-colors`}
          >
            <X size={16} />
            {t('studio.result.close')}
          </button>
        </div>
      </div>

      {isFullScreen && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
          <div className="absolute top-0 right-0 z-50 p-4 pt-[calc(3rem+env(safe-area-inset-top))]">
            <button
              onClick={onCloseFullScreen}
              className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md"
            >
              <X size={24} />
            </button>
          </div>

          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={4}
              centerOnInit
              alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
            >
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={resultUrl}
                  alt="Fullscreen"
                  className="max-w-full max-h-full object-contain"
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      )}
    </div>
  )
}
