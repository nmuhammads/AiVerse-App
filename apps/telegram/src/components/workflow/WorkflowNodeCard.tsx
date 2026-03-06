import { memo, type MouseEvent } from 'react'
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { CheckCircle2, CircleDashed } from 'lucide-react'
import type { FlowNodeData } from './workflowUtils'
import { ICONS, STATUS_STYLES } from './workflowUtils'

export const WorkflowNodeCard = memo(({ data }: NodeProps<Node<FlowNodeData>>) => {
  const nodeData = data as FlowNodeData
  const Icon = ICONS[nodeData.icon]
  const tone = STATUS_STYLES[nodeData.status]
  const output = nodeData.output
  const imageUrl = output?.type === 'image' ? output.image_urls[0] || null : null
  const hasVideoOutput = output?.type === 'video'
  const canOpenResult = nodeData.status === 'done' && !!output && !!nodeData.onOpenResult

  const handleOpenResult = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    nodeData.onOpenResult?.()
  }

  return (
    <div
      className={`relative w-[148px] rounded-xl border p-2 shadow-[0_16px_32px_rgba(0,0,0,0.38)] sm:w-[178px] sm:p-2.5 ${tone.card} ${
        nodeData.highlighted ? 'ring-2 ring-cyan-300/80' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border !border-white/20 !bg-zinc-950"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/25">
          <Icon className="h-4 w-4" />
        </div>
        {nodeData.status === 'done' ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : nodeData.status === 'running' ? (
          <CircleDashed className="h-4 w-4 animate-spin text-cyan-200" />
        ) : nodeData.status === 'failed' ? (
          <span className="text-[10px] text-red-200">ошибка</span>
        ) : nodeData.status === 'skipped' ? (
          <span className="text-[10px] text-zinc-400">пропуск</span>
        ) : (
          <span className={`text-[10px] ${tone.label}`}>ожидание</span>
        )}
      </div>

      <p className="mt-2 text-[12px] font-semibold leading-none sm:text-[13px]">{nodeData.title}</p>
      <p className="mt-1 text-[10px] text-zinc-500 sm:text-[11px]">{nodeData.subtitle}</p>
      <div className="mt-2 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[9px] text-zinc-300 sm:text-[10px]">
        {nodeData.model}
      </div>
      <p className="mt-1 text-[9px] text-zinc-400 sm:text-[10px]">{nodeData.paramsText}</p>

      {canOpenResult ? (
        <button
          className="mt-2 block w-full overflow-hidden rounded-md border border-emerald-300/35 bg-emerald-900/20 text-left"
          onClick={handleOpenResult}
        >
          {imageUrl ? (
            <div className="relative">
              <img src={imageUrl} alt={`${nodeData.title} result`} className="h-16 w-full object-cover" />
              <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-zinc-100">result</span>
            </div>
          ) : hasVideoOutput ? (
            <div className="flex h-14 items-center justify-between px-2.5 py-1.5">
              <span className="text-[10px] text-emerald-100">Видео готово</span>
              <span className="rounded-md border border-emerald-200/50 px-1.5 py-0.5 text-[9px] text-emerald-200">preview</span>
            </div>
          ) : (
            <div className="h-12 px-2.5 py-1.5">
              <span className="text-[10px] text-emerald-100">Результат доступен</span>
            </div>
          )}
        </button>
      ) : null}

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-white/20 !bg-zinc-950"
      />
    </div>
  )
})

WorkflowNodeCard.displayName = 'WorkflowNodeCard'
