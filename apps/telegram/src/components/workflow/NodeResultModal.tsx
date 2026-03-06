import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  X,
} from 'lucide-react'
import type { NodeArtifact } from '@aiverse/shared/types/workflow'
import { useTelegram } from '@/hooks/useTelegram'
import {
  getArtifactImageUrls,
  getArtifactPrimaryUrl,
  safeFileBase,
} from './resultMedia'

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

export function NodeResultModal(props: {
  open: boolean
  artifact: NodeArtifact | null
  nodeLabel: string
  onClose: () => void
}) {
  const {
    open,
    artifact,
    nodeLabel,
    onClose,
  } = props
  const { saveToGallery, shareImage } = useTelegram()
  const [imageIndex, setImageIndex] = useState(0)
  const touchStartXRef = useRef<number | null>(null)

  const imageUrls = getArtifactImageUrls(artifact)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setImageIndex(0)
  }, [artifact, open])

  if (!open || !artifact) return null

  const baseName = safeFileBase(nodeLabel || 'workflow-node')
  const currentImage = imageUrls[imageIndex] || null

  const onDownload = async () => {
    if (artifact.type === 'image' && currentImage) {
      await saveToGallery(currentImage, `${baseName}-${imageIndex + 1}.jpg`)
      return
    }
    if (artifact.type === 'video' && artifact.video_url) {
      await saveToGallery(artifact.video_url, `${baseName}.mp4`)
      return
    }
    if (artifact.type === 'prompt') {
      downloadText(artifact.text || '', `${baseName}.txt`)
    }
  }

  const onShare = () => {
    if (artifact.type === 'image' && currentImage) {
      shareImage(currentImage, `Workflow result: ${nodeLabel}`)
      return
    }
    if (artifact.type === 'video' && artifact.video_url) {
      shareImage(artifact.video_url, `Workflow result: ${nodeLabel}`)
      return
    }
    if (artifact.type === 'prompt' && navigator.share) {
      navigator.share({ title: nodeLabel, text: artifact.text || '' }).catch(() => {})
    }
  }

  const canSlide = artifact.type === 'image' && imageUrls.length > 1

  return (
    <div className="fixed inset-0 z-[180] bg-black/85 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5">
        <section className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#090d14] p-3 shadow-[0_24px_64px_rgba(0,0,0,0.45)] sm:p-4">
          <button
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-zinc-900/70 text-zinc-200"
            onClick={onClose}
            aria-label="Close result modal"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="pr-10">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Node Result</p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">{nodeLabel}</p>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-2">
            {artifact.type === 'image' ? (
              <div
                className="relative overflow-hidden rounded-lg"
                onTouchStart={(event) => {
                  const touch = event.touches[0]
                  touchStartXRef.current = touch?.clientX ?? null
                }}
                onTouchEnd={(event) => {
                  if (!canSlide || touchStartXRef.current === null) return
                  const touch = event.changedTouches[0]
                  const delta = (touch?.clientX ?? 0) - touchStartXRef.current
                  if (Math.abs(delta) < 36) return
                  if (delta < 0) {
                    setImageIndex((value) => (value + 1) % imageUrls.length)
                  } else {
                    setImageIndex((value) => (value - 1 + imageUrls.length) % imageUrls.length)
                  }
                  touchStartXRef.current = null
                }}
              >
                {currentImage ? (
                  <img src={currentImage} alt={`${nodeLabel} result`} className="max-h-[68vh] w-full object-contain" />
                ) : (
                  <div className="flex h-52 items-center justify-center text-sm text-zinc-500">No image available</div>
                )}
                {canSlide ? (
                  <>
                    <button
                      className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-zinc-100"
                      onClick={() => setImageIndex((value) => (value - 1 + imageUrls.length) % imageUrls.length)}
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-zinc-100"
                      onClick={() => setImageIndex((value) => (value + 1) % imageUrls.length)}
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/65 px-2 py-0.5 text-[11px] text-zinc-200">
                      {imageIndex + 1}/{imageUrls.length}
                    </p>
                  </>
                ) : null}
              </div>
            ) : artifact.type === 'video' ? (
              <video
                src={getArtifactPrimaryUrl(artifact) || undefined}
                controls
                playsInline
                className="max-h-[68vh] w-full rounded-lg bg-black object-contain"
              />
            ) : (
              <pre className="max-h-[68vh] overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs text-zinc-200">
                {artifact.text || 'Пустой текст'}
              </pre>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100"
              onClick={() => {
                void onDownload()
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-100"
              onClick={onShare}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
