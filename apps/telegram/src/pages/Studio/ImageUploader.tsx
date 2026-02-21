import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Clipboard, Image as ImageIcon, Info, Loader2, X, User, Plus, Trash2 } from 'lucide-react'
import type { ModelType } from '@/store/generationStore'
import type { RefObject } from 'react'
import type { Avatar } from '@/pages/Studio/hooks/useStudio'
import { compressImage } from '@/utils/imageCompression'

type TranslationFn = ReturnType<typeof useTranslation>['t']

type ImageUploaderProps = {
  t: TranslationFn
  mediaType: 'image' | 'video'
  generationMode: 'text' | 'image'
  selectedModel: ModelType
  uploadedImages: string[]
  parentGenerationId: number | string | null
  maxImages: number
  isUploadingImage: boolean
  fileInputRef: RefObject<HTMLInputElement>
  onProcessPastedFiles: (files: File[]) => Promise<void>
  onRemoveUploadedImage: (index: number) => void
  onSetUploadedImages: (images: string[]) => void
  // Avatar props
  avatars: Avatar[]
  isLoadingAvatars: boolean
  onAddAvatar: (image: string, name: string) => Promise<void>
  onDeleteAvatar: (id: number) => Promise<void>
  onSelectAvatar: (url: string) => void
}

function AddAvatarModal({
  t,
  isOpen,
  onClose,
  onAddAvatar,
}: {
  t: TranslationFn
  isOpen: boolean
  onClose: () => void
  onAddAvatar: (image: string, name: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file)
      setImagePreview(compressed)
    } catch {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (ev) => {
        if (ev.target?.result) setImagePreview(ev.target.result as string)
      }
    }
  }

  const handleSubmit = async () => {
    if (!imagePreview || !name.trim()) return
    setIsUploading(true)
    try {
      await onAddAvatar(imagePreview, name.trim())
      onClose()
      setName('')
      setImagePreview(null)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-2xl border border-white/10 w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{t('studio.avatars.add', 'Добавить аватар')}</h3>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Image Preview / Select */}
        {imagePreview ? (
          <div className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 max-w-[160px] mx-auto">
            <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-square max-w-[160px] mx-auto rounded-xl border-2 border-dashed border-white/10 bg-zinc-800/50 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-white/20 hover:text-zinc-400 transition-colors"
          >
            <ImageIcon size={24} />
            <span className="text-xs">{t('studio.upload.selectPhoto', 'Выбрать фото')}</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

        {/* Name Input */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 30))}
          placeholder={t('studio.avatars.namePlaceholder', 'Например: Мой портрет')}
          className="w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-white/10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20"
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!imagePreview || !name.trim() || isUploading}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {isUploading ? <Loader2 size={16} className="animate-spin" /> : null}
          {t('studio.avatars.save', 'Сохранить')}
        </button>
      </div>
    </div>
  )
}

function AvatarCarousel({
  t,
  avatars,
  isLoading,
  onSelectAvatar,
  onDeleteAvatar,
  onOpenAddModal,
}: {
  t: TranslationFn
  avatars: Avatar[]
  isLoading: boolean
  onSelectAvatar: (url: string) => void
  onDeleteAvatar: (id: number) => void
  onOpenAddModal: () => void
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 size={14} className="animate-spin text-zinc-500" />
        <span className="text-xs text-zinc-500">{t('studio.avatars.loading', 'Загрузка...')}</span>
      </div>
    )
  }

  if (avatars.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 py-2 px-3 rounded-xl border border-dashed border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-400 transition-colors text-xs"
        >
          <Plus size={14} />
          <span>{t('studio.avatars.addFirst', 'Добавить аватар')}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          {t('studio.avatars.title', 'Мои аватары')} ({avatars.length})
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {avatars.map((avatar) => (
          <div key={avatar.id} className="shrink-0 relative group">
            {confirmDeleteId === avatar.id ? (
              <div className="w-14 h-14 rounded-xl bg-red-500/20 border border-red-500/40 flex flex-col items-center justify-center gap-0.5 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => { onDeleteAvatar(avatar.id); setConfirmDeleteId(null) }}
                  className="text-red-400 text-[9px] font-bold"
                >
                  {t('studio.avatars.delete', 'Удалить')}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="text-zinc-500 text-[9px]"
                >
                  {t('studio.avatars.cancel', 'Отмена')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSelectAvatar(avatar.url)}
                onContextMenu={(e) => { e.preventDefault(); setConfirmDeleteId(avatar.id) }}
                className="w-14 h-14 rounded-xl overflow-hidden border-2 border-transparent hover:border-lime-400/50 active:scale-90 transition-all bg-zinc-800"
                title={avatar.display_name}
              >
                <img
                  src={avatar.url}
                  alt={avatar.display_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            )}
            <div className="text-[9px] text-zinc-500 text-center mt-0.5 w-14 truncate">
              {avatar.display_name}
            </div>
          </div>
        ))}
        {/* Add button */}
        <div className="shrink-0">
          <button
            onClick={onOpenAddModal}
            className="w-14 h-14 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center text-zinc-600 hover:border-white/20 hover:text-zinc-400 active:scale-90 transition-all bg-zinc-900/50"
          >
            <Plus size={18} />
          </button>
          <div className="text-[9px] text-zinc-600 text-center mt-0.5 w-14">
            {t('studio.avatars.new', 'Новый')}
          </div>
        </div>
      </div>
    </div>
  )
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
  avatars,
  isLoadingAvatars,
  onAddAvatar,
  onDeleteAvatar,
  onSelectAvatar,
}: ImageUploaderProps) {
  const [showAddAvatarModal, setShowAddAvatarModal] = useState(false)

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
                  <div className="space-y-3">
                    {/* Avatar Carousel in filled state */}
                    <AvatarCarousel
                      t={t}
                      avatars={avatars}
                      isLoading={isLoadingAvatars}
                      onSelectAvatar={onSelectAvatar}
                      onDeleteAvatar={onDeleteAvatar}
                      onOpenAddModal={() => setShowAddAvatarModal(true)}
                    />

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
                  </div>
                )}
              </div>
            ) : (
              <div id="remix-upload-target" className="space-y-3 relative">
                <div className="py-2 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                      <ImageIcon size={20} />
                    </div>
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                      <User size={20} />
                    </div>
                  </div>
                  <div className="text-xs font-medium text-zinc-300">
                    {t('studio.upload.addReferencesOrAvatar', {
                      limit: maxImages,
                      defaultValue: `Добавь референсы или выбери аватар (до ${maxImages})`
                    })}
                  </div>
                </div>

                {/* Avatar Carousel */}
                <AvatarCarousel
                  t={t}
                  avatars={avatars}
                  isLoading={isLoadingAvatars}
                  onSelectAvatar={onSelectAvatar}
                  onDeleteAvatar={onDeleteAvatar}
                  onOpenAddModal={() => setShowAddAvatarModal(true)}
                />

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
                        if (!file) return
                        const reader = new FileReader()
                        reader.readAsDataURL(file)
                        reader.onload = (ev) => {
                          if (ev.target?.result) {
                            onSetUploadedImages([ev.target.result as string, ...uploadedImages.slice(1)])
                          }
                        }
                      }
                      input.click()
                    }}
                    className="border-2 border-dashed border-white/10 rounded-xl aspect-[4/3] bg-zinc-900/20 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-colors w-full active:scale-95"
                  >
                    <ImageIcon size={20} />
                    <span className="text-[10px] font-medium">{t('studio.video.uploadStart')}</span>
                  </button>
                </div>
              )}
            </div>

            {!['kling-t2v', 'kling-i2v', 'kling-mc'].includes(selectedModel) && (
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-1">
                  {t('studio.video.endFrame')}
                </label>
                {uploadedImages[1] ? (
                  <div className="border-2 border-dashed border-white/10 rounded-xl aspect-[4/3] bg-zinc-900/20 relative overflow-hidden">
                    <img src={uploadedImages[1]} alt="end-frame" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        const newImages = [...uploadedImages]
                        newImages[1] = ''
                        onSetUploadedImages(newImages.filter(Boolean))
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.accept = 'image/*'
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.readAsDataURL(file)
                        reader.onload = (ev) => {
                          if (ev.target?.result) {
                            const newImages = [...uploadedImages]
                            newImages[1] = ev.target.result as string
                            onSetUploadedImages(newImages)
                          }
                        }
                      }
                      input.click()
                    }}
                    className="border-2 border-dashed border-white/10 rounded-xl aspect-[4/3] bg-zinc-900/20 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition-colors w-full active:scale-95"
                  >
                    <ImageIcon size={20} />
                    <span className="text-[10px] font-medium">{t('studio.video.uploadEnd')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <AddAvatarModal
        t={t}
        isOpen={showAddAvatarModal}
        onClose={() => setShowAddAvatarModal(false)}
        onAddAvatar={onAddAvatar}
      />
    </>
  )
}
