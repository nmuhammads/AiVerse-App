import { memo } from 'react'
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

  return (
    <div
      className={`relative w-[178px] rounded-xl border p-2.5 shadow-[0_16px_32px_rgba(0,0,0,0.38)] ${tone.card} ${
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

      <p className="mt-2 text-[13px] font-semibold leading-none">{nodeData.title}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{nodeData.subtitle}</p>
      <div className="mt-2 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-zinc-300">
        {nodeData.model}
      </div>
      <p className="mt-1 text-[10px] text-zinc-400">{nodeData.paramsText}</p>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border !border-white/20 !bg-zinc-950"
      />
    </div>
  )
})

WorkflowNodeCard.displayName = 'WorkflowNodeCard'
