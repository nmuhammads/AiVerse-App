import { useTranslation } from 'react-i18next'
import { Clipboard, Image as ImageIcon, Info, Loader2, X } from 'lucide-react'
import type { ModelType } from '@/store/generationStore'
import type { RefObject } from 'react'

type TranslationFn = ReturnType<typeof useTranslation>['t']

type ImageUploaderProps = {
  t: TranslationFn
  mediaType: 'image' | 'video'
  generationMode: 'text' | 'image'
  selectedModel: ModelType
  uploadedImages: string[]
  parentGenerationId: number | null
  maxImages: number
  isUploadingImage: boolean
  fileInputRef: RefObject<HTMLInputElement>
  onProcessPastedFiles: (files: File[]) => Promise<void>
  onRemoveUploadedImage: (index: number) => void
  onSetUploadedImages: (images: string[]) => void
}

export function ImageUploader({
  t,
  mediaType,
  generationMode,
  selectedModel,
  uploadedImages,
  parentGenerationId,
  maxImages,
  isUploadingImage,
  fileInputRef,
  onProcessPastedFiles,
  onRemoveUploadedImage,
  onSetUploadedImages,
}: ImageUploaderProps) {
  return (
    <>
      {generationMode === 'image' && mediaType === 'image' && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="border-2 border-dashed border-white/10 rounded-xl p-4 bg-zinc-900/20 relative overflow-hidden">
            {uploadedImages.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group">
                      <img src={img} alt={`uploaded-${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => onRemoveUploadedImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {uploadedImages.length < (['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) ? 1 : 8) && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-2 px-3 rounded-lg border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors text-xs"
                    >
                      <ImageIcon size={14} />
                      <span>{t('studio.upload.more')}</span>
                    </button>
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onPaste={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const items = e.clipboardData?.items
                        if (!items) return

                        const files: File[] = []
                        for (const item of Array.from(items)) {
                          if (item.type.startsWith('image/')) {
                            const file = item.getAsFile()
                            if (file) files.push(file)
                          }
                        }

                        if (files.length > 0) {
                          await onProcessPastedFiles(files)
                        }
                        e.currentTarget.innerHTML = ''
                      }}
                      onInput={(e) => { e.currentTarget.innerHTML = '' }}
                      className="flex-1 py-2 px-3 rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 flex items-center justify-center gap-2 text-violet-300 text-xs cursor-text focus:outline-none focus:border-violet-500/50"
                    >
                      <Clipboard size={14} />
                      <span>{t('studio.upload.paste')}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="py-2 text-center">
                  <div className="w-10 h-10 mx-auto bg-zinc-800 rounded-full flex items-center justify-center mb-2 text-zinc-400">
                    <ImageIcon size={20} />
                  </div>
                  <div className="text-xs font-medium text-zinc-300">{t('studio.upload.addReferences', { limit: maxImages })}</div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="w-full py-2.5 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors active:scale-95 disabled:opacity-50"
                  >
                    {isUploadingImage ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-xs font-medium">{t('studio.upload.loading', 'Загрузка...')}</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={16} />
                        <span className="text-xs font-medium">{t('studio.upload.selectPhoto')}</span>
                      </>
                    )}
                  </button>

                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onPaste={async (e) => {
                      e.preventDefault()
                      const items = e.clipboardData?.items
                      if (!items) return

                      const files: File[] = []
                      for (const item of Array.from(items)) {
                        if (item.type.startsWith('image/')) {
                          const file = item.getAsFile()
                          if (file) files.push(file)
                        }
                      }

                      if (files.length > 0) {
                        await onProcessPastedFiles(files)
                      }

                      e.currentTarget.innerHTML = ''
                    }}
                    onInput={(e) => {
                      e.currentTarget.innerHTML = ''
                    }}
                    className="w-full py-3 px-3 rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 flex items-center justify-center gap-2 text-violet-300 text-xs font-medium cursor-text select-none focus:outline-none focus:border-violet-500/50 focus:bg-violet-500/10"
                    style={{ minHeight: '44px', WebkitUserSelect: 'none' }}
                  >
                    <Clipboard size={16} />
                    <span>{t('studio.upload.pasteHint')}</span>
                  </div>
                </div>

                <div className="text-[10px] text-zinc-500 text-center">
                  {t('studio.upload.copyHint')}
                </div>
              </div>
            )}
          </div>
          {parentGenerationId && (
            <div className="mt-2 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs animate-in fade-in slide-in-from-top-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>{t('studio.upload.remixHint')}</span>
            </div>
          )}
        </div>
      )}

      {generationMode === 'image' && mediaType === 'video' && selectedModel !== 'kling-mc' && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`grid gap-3 ${['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-1">
                {['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) ? t('studio.kling.referenceImage', 'Референс фото') : t('studio.video.startFrame')}
              </label>
              {uploadedImages[0] ? (
                <div className="border-2 border-dashed border-white/10 rounded-xl aspect-[4/3] bg-zinc-900/20 relative overflow-hidden">
                  <img src={uploadedImages[0]} alt="start-frame" className="w-full h-full object-cover" />
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
                          const newImages = [...uploadedImages]
                          newImages[0] = base64
                          onSetUploadedImages(newImages)
                        }
                      }
                      input.click()
                    }}
                    className="w-full py-2.5 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors active:scale-95"
                  >
                    <ImageIcon size={14} />
                    <span className="text-[10px] font-medium">{t('studio.upload.selectPhoto')}</span>
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
                            const newImages = [...uploadedImages]
                            newImages[0] = base64
                            onSetUploadedImages(newImages)
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

            {!['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) && (
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-1">{t('studio.video.endFrame')}</label>
                {uploadedImages[1] ? (
                  <div className="border-2 border-dashed border-white/10 rounded-xl aspect-[4/3] bg-zinc-900/20 relative overflow-hidden">
                    <img src={uploadedImages[1]} alt="end-frame" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        const newImages = [...uploadedImages]
                        newImages.splice(1, 1)
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
                            const newImages = [...uploadedImages]
                            if (!newImages[0]) newImages[0] = ''
                            newImages[1] = base64
                            onSetUploadedImages(newImages.filter(Boolean))
                          }
                        }
                        input.click()
                      }}
                      className="w-full py-2.5 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors active:scale-95"
                    >
                      <ImageIcon size={14} />
                      <span className="text-[10px] font-medium">{t('studio.upload.selectPhoto')}</span>
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
                              const newImages = [...uploadedImages]
                              if (!newImages[0]) newImages[0] = ''
                              newImages[1] = base64
                              onSetUploadedImages(newImages.filter(Boolean))
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
            )}
          </div>
          {!['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) && (
            <p className="text-[10px] text-zinc-500 mt-2 px-1">{t('studio.video.framesHint')}</p>
          )}
        </div>
      )}
    </>
  )
}
