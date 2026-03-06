import type { WorkflowTemplateDTO } from '@aiverse/shared/types/workflow'
import { X } from 'lucide-react'
import { BottomSheet } from './BottomSheet'

type TemplateListModalProps = {
  open: boolean
  isMobileViewport: boolean
  bottomClassName?: string
  templates: WorkflowTemplateDTO[]
  activeTemplateId: number | null
  templateRenameId: number | null
  templateRenameValue: string
  templateDeleteId: number | null
  isTemplateActionLoading: boolean
  onClose: () => void
  onCreateDraft: () => void
  onSelectTemplate: (templateId: number) => void
  onStartRename: (templateId: number, currentName: string) => void
  onRenameValueChange: (value: string) => void
  onSubmitRename: (templateId: number) => void
  onCancelRename: () => void
  onRequestDelete: (templateId: number) => void
  onCancelDelete: () => void
  onConfirmDelete: (templateId: number) => void
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function TemplateListContent(props: Omit<TemplateListModalProps, 'open' | 'isMobileViewport' | 'bottomClassName' | 'onClose'> & { onClose: () => void }) {
  const {
    templates,
    activeTemplateId,
    templateRenameId,
    templateRenameValue,
    templateDeleteId,
    isTemplateActionLoading,
    onCreateDraft,
    onSelectTemplate,
    onStartRename,
    onRenameValueChange,
    onSubmitRename,
    onCancelRename,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
    onClose,
  } = props

  return (
    <div>
      <button
        className="inline-flex rounded-lg border border-cyan-400/60 bg-cyan-500/15 px-2.5 py-1.5 text-xs text-cyan-100"
        onClick={onCreateDraft}
        disabled={isTemplateActionLoading}
      >
        + Create New
      </button>

      {templates.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-400">Сохраненные шаблоны пока отсутствуют</p>
      ) : (
        <div className="mt-3 space-y-2">
          {templates.map((item) => {
            const isActive = item.id === activeTemplateId
            const isRenaming = templateRenameId === item.id
            const isDeleting = templateDeleteId === item.id
            return (
              <div key={item.id} className="rounded-xl border border-white/10 bg-zinc-900/65 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      #{item.id}
                      {isActive ? ' • active' : ''}
                      {' • '}
                      {formatDate(item.updated_at)}
                    </p>
                  </div>
                  <button
                    className={`rounded-lg border px-2 py-1 text-[11px] ${
                      isActive
                        ? 'border-cyan-300/70 bg-cyan-500/20 text-cyan-100'
                        : 'border-white/10 bg-zinc-800/80 text-zinc-200'
                    }`}
                    onClick={() => {
                      onSelectTemplate(item.id)
                      onClose()
                    }}
                    disabled={isTemplateActionLoading}
                  >
                    {isActive ? 'Selected' : 'Select'}
                  </button>
                </div>

                {isRenaming ? (
                  <div className="mt-2 space-y-2">
                    <input
                      className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-zinc-100 outline-none"
                      value={templateRenameValue}
                      onChange={(event) => onRenameValueChange(event.target.value)}
                      placeholder="Название шаблона"
                    />
                    <div className="flex gap-2">
                      <button
                        className="rounded-md border border-cyan-400/60 bg-cyan-500/15 px-2 py-1 text-[11px] text-cyan-100"
                        onClick={() => onSubmitRename(item.id)}
                        disabled={isTemplateActionLoading}
                      >
                        Save
                      </button>
                      <button
                        className="rounded-md border border-white/10 bg-zinc-800/80 px-2 py-1 text-[11px] text-zinc-200"
                        onClick={onCancelRename}
                        disabled={isTemplateActionLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {isDeleting ? (
                  <div className="mt-2 rounded-md border border-red-400/30 bg-red-900/20 p-2 text-[11px] text-red-100">
                    <p>Удалить шаблон безвозвратно?</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-md border border-red-300/60 bg-red-500/15 px-2 py-1 text-red-200"
                        onClick={() => onConfirmDelete(item.id)}
                        disabled={isTemplateActionLoading}
                      >
                        Delete
                      </button>
                      <button
                        className="rounded-md border border-white/10 bg-zinc-800/80 px-2 py-1 text-zinc-200"
                        onClick={onCancelDelete}
                        disabled={isTemplateActionLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-2 flex gap-2 text-[11px]">
                  {!isRenaming ? (
                    <button
                      className="rounded-md border border-white/10 bg-zinc-800/80 px-2 py-1 text-zinc-200"
                      onClick={() => onStartRename(item.id, item.name)}
                      disabled={isTemplateActionLoading}
                    >
                      Rename
                    </button>
                  ) : null}
                  {!isDeleting ? (
                    <button
                      className="rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-red-200"
                      onClick={() => onRequestDelete(item.id)}
                      disabled={isTemplateActionLoading}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function TemplateListModal(props: TemplateListModalProps) {
  const {
    open,
    isMobileViewport,
    bottomClassName,
    onClose,
    ...contentProps
  } = props

  if (!open) return null

  if (isMobileViewport) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="Templates"
        initialSnap="full"
        allowCollapsed={false}
        bottomClassName={bottomClassName}
      >
        <TemplateListContent
          {...contentProps}
          onClose={onClose}
        />
      </BottomSheet>
    )
  }

  return (
    <div className="fixed inset-0 z-[165] bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <section className="absolute left-1/2 top-1/2 w-[min(92vw,600px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0b1018] p-3 shadow-[0_24px_64px_rgba(0,0,0,0.42)]">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <p className="text-sm font-semibold text-zinc-100">Templates</p>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-zinc-900/70 text-zinc-300"
            onClick={onClose}
            aria-label="Close templates modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-2 max-h-[70vh] overflow-y-auto pr-1">
          <TemplateListContent
            {...contentProps}
            onClose={onClose}
          />
        </div>
      </section>
    </div>
  )
}
