import { useCallback, type MouseEvent } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  useReactFlow,
} from '@xyflow/react'
import { Trash2 } from 'lucide-react'

export function WorkflowDeletableEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
  } = props

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const { deleteElements } = useReactFlow()

  const handleDelete = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    void deleteElements({
      edges: [{ id }],
    })
  }, [deleteElements, id])

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <button
          className="nodrag nopan pointer-events-auto absolute inline-flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-red-500/55 bg-red-500/18 text-red-100 shadow-[0_8px_20px_rgba(0,0,0,0.45)] backdrop-blur-sm"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          onClick={handleDelete}
          title="Удалить связь"
          aria-label="Удалить связь"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </EdgeLabelRenderer>
    </>
  )
}
