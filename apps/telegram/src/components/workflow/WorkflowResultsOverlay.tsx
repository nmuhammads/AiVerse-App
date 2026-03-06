import { useEffect } from 'react'
import {
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

function downloadPromptArtifact(nodeLabel: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `${safeFileBase(nodeLabel)}.txt`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

export type WorkflowResultEntry = {
  nodeId: string
  nodeLabel: string
  artifact: NodeArtifact
}

export function WorkflowResultsOverlay(props: {
  open: boolean
  entries: WorkflowResultEntry[]
  onClose: () => void
}) {
  const {
    open,
    entries,
    onClose,
  } = props
  const { saveToGallery, shareImage } = useTelegram()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, open])

  if (!open) return null

  const mediaEntries = entries.filter((entry) => entry.artifact.type === 'image' || entry.artifact.type === 'video')
  const firstMediaUrl = getArtifactPrimaryUrl(mediaEntries[0]?.artifact)

  const handleDownloadEntry = async (entry: WorkflowResultEntry) => {
    if (entry.artifact.type === 'image') {
      const urls = getArtifactImageUrls(entry.artifact)
      if (urls.length === 0) return
      for (let i = 0; i < urls.length; i += 1) {
        await saveToGallery(urls[i], `${safeFileBase(entry.nodeLabel)}-${i + 1}.jpg`)
      }
      return
    }
    if (entry.artifact.type === 'video') {
      await saveToGallery(entry.artifact.video_url, `${safeFileBase(entry.nodeLabel)}.mp4`)
      return
    }
    downloadPromptArtifact(entry.nodeLabel, entry.artifact.text || '')
  }

  const handleShareEntry = (entry: WorkflowResultEntry) => {
    if (entry.artifact.type === 'image') {
      const url = entry.artifact.image_urls[0]
      if (url) shareImage(url, `Workflow result: ${entry.nodeLabel}`)
      return
    }
    if (entry.artifact.type === 'video') {
      if (entry.artifact.video_url) shareImage(entry.artifact.video_url, `Workflow result: ${entry.nodeLabel}`)
      return
    }
    if (navigator.share) {
      navigator.share({ title: entry.nodeLabel, text: entry.artifact.text || '' }).catch(() => {})
    }
  }

  const handleDownloadAll = async () => {
    for (const entry of entries) {
      await handleDownloadEntry(entry)
    }
  }

  const handleShareAll = () => {
    if (!firstMediaUrl) return
    shareImage(firstMediaUrl, `Workflow results (${entries.length})`)
  }

  return (
    <div className="fixed inset-0 z-[170] bg-black/85 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <section className="absolute inset-x-0 top-0 mx-auto flex h-full w-full max-w-[980px] flex-col overflow-hidden border-x border-white/10 bg-[#070c13]">
        <header className="flex items-center justify-between border-b border-white/10 px-3 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Workflow Results</p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">{entries.length} artifacts</p>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-zinc-900/70 text-zinc-100"
            onClick={onClose}
            aria-label="Close results overlay"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100"
            onClick={() => {
              void handleDownloadAll()
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Download All
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-100 disabled:opacity-60"
            onClick={handleShareAll}
            disabled={!firstMediaUrl}
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {entries.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3 text-sm text-zinc-400">
              Нет результатов для отображения
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <article key={entry.nodeId} className="rounded-xl border border-white/10 bg-zinc-900/55 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-100">{entry.nodeLabel}</p>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-800/80 px-2 py-1 text-[11px] text-zinc-100"
                        onClick={() => {
                          void handleDownloadEntry(entry)
                        }}
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-800/80 px-2 py-1 text-[11px] text-zinc-100"
                        onClick={() => handleShareEntry(entry)}
                      >
                        <Share2 className="h-3 w-3" />
                        Share
                      </button>
                    </div>
                  </div>

                  {entry.artifact.type === 'image' ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {getArtifactImageUrls(entry.artifact).map((url, index) => (
                        <img
                          key={`${entry.nodeId}-img-${index}`}
                          src={url}
                          alt={`${entry.nodeLabel} ${index + 1}`}
                          className="max-h-72 w-full rounded-lg border border-white/10 bg-black/20 object-contain"
                        />
                      ))}
                    </div>
                  ) : entry.artifact.type === 'video' ? (
                    <video
                      src={entry.artifact.video_url}
                      controls
                      playsInline
                      className="max-h-72 w-full rounded-lg border border-white/10 bg-black object-contain"
                    />
                  ) : (
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-zinc-200">
                      {entry.artifact.text || 'Пустой текст'}
                    </pre>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
