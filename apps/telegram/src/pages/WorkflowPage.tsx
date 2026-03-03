import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  Coins,
  Film,
  ImageIcon,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { getAuthHeaders } from '@/hooks/useTelegram'
import type {
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowRunDTO,
} from '@aiverse/shared/types/workflow'
import {
  createWorkflowTemplate,
  getWorkflowRun,
  listWorkflowTemplates,
  patchWorkflowTemplate,
  startWorkflowRun,
} from '@/lib/workflowsApi'
import { getDefaultWorkflowGraph, useWorkflowStore } from '@/store/workflowStore'

type FlowNodeStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped'
type IconKey = 'prompt' | 'image' | 'video'

type FlowNodeData = {
  nodeType: WorkflowNode['type']
  title: string
  subtitle: string
  model: string
  paramsText: string
  sourceText: string
  icon: IconKey
  status: FlowNodeStatus
  highlighted?: boolean
  rawData: WorkflowNodeData
}

const ICONS: Record<IconKey, typeof Sparkles> = {
  prompt: Sparkles,
  image: ImageIcon,
  video: Film,
}

const STATUS_STYLES: Record<FlowNodeStatus, { card: string; label: string }> = {
  idle: {
    card: 'border-white/10 bg-zinc-950/90 text-zinc-100',
    label: 'text-zinc-500',
  },
  running: {
    card: 'border-cyan-400/70 bg-cyan-950/40 text-cyan-100',
    label: 'text-cyan-200',
  },
  done: {
    card: 'border-emerald-400/65 bg-emerald-950/35 text-emerald-100',
    label: 'text-emerald-200',
  },
  failed: {
    card: 'border-red-400/70 bg-red-950/40 text-red-100',
    label: 'text-red-200',
  },
  skipped: {
    card: 'border-zinc-600 bg-zinc-900/70 text-zinc-300',
    label: 'text-zinc-400',
  },
}

const NODE_LIBRARY: Array<{ label: string; type: WorkflowNode['type'] }> = [
  { label: 'Генерация фото', type: 'image.generate' },
  { label: 'Генерация видео', type: 'video.generate' },
  { label: 'Инструменты', type: 'video.concat' },
]

function getDefaultNodeTitle(node: WorkflowNode): string {
  if (node.type === 'prompt') return 'Промпт'
  if (node.type === 'video.concat') return 'Инструменты'
  if (node.type === 'video.generate') return 'Генерация видео'
  return 'Генерация фото'
}

function getNodeDisplayName(node: WorkflowNode): string {
  const customLabel = String(node.data?.label || '').trim()
  if (customLabel) return customLabel
  return getDefaultNodeTitle(node)
}

function edgeTone(isRunning: boolean) {
  return isRunning ? '#22d3ee' : '#4b5563'
}

function styleEdge(edge: Edge, isRunning: boolean): Edge {
  const stroke = edgeTone(isRunning)
  return {
    ...edge,
    animated: isRunning,
    style: {
      ...edge.style,
      stroke,
      strokeWidth: 2.2,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: stroke,
    },
  }
}

function mapNodeStatus(run: WorkflowRunDTO | null, nodeId: string): FlowNodeStatus {
  const status = run?.node_states?.[nodeId]?.status
  if (status === 'running') return 'running'
  if (status === 'completed') return 'done'
  if (status === 'failed') return 'failed'
  if (status === 'skipped') return 'skipped'
  return 'idle'
}

function deriveNodeTitle(node: WorkflowNode): string {
  return getNodeDisplayName(node)
}

function deriveNodeSubtitle(node: WorkflowNode): string {
  if (node.type === 'prompt') return 'Текстовый ввод'
  if (node.type === 'video.concat') return 'Соединить видео в один'
  if (node.type === 'video.generate') return node.data?.mode === 't2v' ? 'Текст в видео' : 'Фото в видео'
  return 'Генерация фото'
}

function deriveNodeModel(node: WorkflowNode): string {
  if (node.type === 'prompt') return 'текст'
  if (node.type === 'video.concat') return 'ffmpeg'
  return String(node.data?.model || (node.type === 'video.generate' ? 'seedance-1.5-pro' : 'gpt-image-1.5'))
}

function deriveNodeIcon(node: WorkflowNode): IconKey {
  if (node.type === 'prompt') return 'prompt'
  if (node.type === 'video.generate' || node.type === 'video.concat') return 'video'
  return 'image'
}

function getIncomingSourceIds(graph: WorkflowGraph, nodeId: string): string[] {
  return graph.edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source)
}

function getRefSource(node: WorkflowNode): 'upstream' | 'upload' | 'mixed' {
  const source = String(node.data?.ref_source || 'upstream').toLowerCase()
  if (source === 'upload' || source === 'mixed') return source
  return 'upstream'
}

function getSelectedUpstreamNodeId(node: WorkflowNode): string | 'all' {
  return typeof node.data?.selected_upstream_node_id === 'string'
    ? node.data.selected_upstream_node_id
    : 'all'
}

function getSelectedStartUpstreamNodeId(node: WorkflowNode): string | 'auto' {
  if (typeof node.data?.selected_start_upstream_node_id === 'string') {
    return node.data.selected_start_upstream_node_id
  }

  const legacySelected = getSelectedUpstreamNodeId(node)
  if (legacySelected !== 'all') return legacySelected
  return 'auto'
}

function getSelectedEndUpstreamNodeId(node: WorkflowNode): string | 'none' {
  if (typeof node.data?.selected_end_upstream_node_id === 'string') {
    return node.data.selected_end_upstream_node_id
  }
  return 'none'
}

function hasExplicitSeedanceFrameSelection(node: WorkflowNode): boolean {
  return typeof node.data?.selected_start_upstream_node_id === 'string'
    || typeof node.data?.selected_end_upstream_node_id === 'string'
}

function shortText(value: string, max = 44) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}

function deriveNodeParamsText(node: WorkflowNode, graph: WorkflowGraph): string {
  const nodesById = new Map(graph.nodes.map((item) => [item.id, item]))
  const nameById = (nodeId: string) => {
    const source = nodesById.get(nodeId)
    return source ? getNodeDisplayName(source) : nodeId
  }

  if (node.type === 'prompt') {
    const text = String(node.data?.text || '').trim()
    return text ? shortText(text) : 'text is empty'
  }

  const incomingIds = getIncomingSourceIds(graph, node.id)
  if (node.type === 'video.concat') {
    return `inputs ${incomingIds.length} • соединить видео в один`
  }

  const rawRefSource = getRefSource(node)
  const refSource = node.type === 'video.generate' && rawRefSource === 'mixed' ? 'upstream' : rawRefSource
  const selectedId = getSelectedUpstreamNodeId(node)
  const selectedStartId = getSelectedStartUpstreamNodeId(node)
  const selectedEndId = getSelectedEndUpstreamNodeId(node)
  const uploadedCount = Array.isArray(node.data?.ref_images) ? node.data.ref_images.length : 0
  const sourceLabel = (() => {
    if (refSource === 'upload') return `src upload (${uploadedCount})`
    if (refSource === 'mixed') return `src mixed (${uploadedCount}+prev)`

    const isSeedanceI2V = node.type === 'video.generate'
      && String(node.data?.model || 'seedance-1.5-pro') === 'seedance-1.5-pro'
      && String(node.data?.mode || 'i2v') === 'i2v'
      && hasExplicitSeedanceFrameSelection(node)
    if (isSeedanceI2V) {
      return `src prev start:${selectedStartId === 'auto' ? 'auto' : nameById(selectedStartId)}${selectedEndId !== 'none' ? ` end:${nameById(selectedEndId)}` : ''}`
    }
    return `src prev${selectedId !== 'all' ? `:${nameById(selectedId)}` : ''}`
  })()

  if (node.type === 'image.generate') {
    const prompt = String(node.data?.prompt || '').trim()
    const ratio = String(node.data?.aspect_ratio || '3:4')
    const count = Number(node.data?.image_count || 1)
    const parts = [sourceLabel, `ratio ${ratio}`, `count ${count}`]
    if (prompt) parts.unshift(`prompt: ${shortText(prompt, 28)}`)
    if (incomingIds.length > 0 && refSource !== 'upload') parts.push(`prev ${shortText(incomingIds.map(nameById).join(','), 18)}`)
    return parts.join(' • ')
  }

  const prompt = String(node.data?.prompt || '').trim()
  const mode = String(node.data?.mode || 'i2v')
  const duration = String(node.data?.video_duration || '-')
  const resolution = String(node.data?.video_resolution || '-')
  const parts = [sourceLabel, `${mode}`, `${duration}s`, resolution]
  if (prompt) parts.unshift(`prompt: ${shortText(prompt, 28)}`)
  if (incomingIds.length > 0 && refSource !== 'upload') parts.push(`prev ${shortText(incomingIds.map(nameById).join(','), 18)}`)
  return parts.join(' • ')
}

function graphToFlowNodes(graph: WorkflowGraph, selectedNodeId: string | null, run: WorkflowRunDTO | null): Node<FlowNodeData>[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: 'workflow',
    position: node.position || { x: 50, y: 60 },
    data: {
      nodeType: node.type,
      title: deriveNodeTitle(node),
      subtitle: deriveNodeSubtitle(node),
      model: deriveNodeModel(node),
      paramsText: deriveNodeParamsText(node, graph),
      sourceText: getIncomingSourceIds(graph, node.id).join(', '),
      icon: deriveNodeIcon(node),
      status: mapNodeStatus(run, node.id),
      highlighted: selectedNodeId === node.id,
      rawData: node.data || {},
    },
  }))
}

function graphToFlowEdges(graph: WorkflowGraph, isRunning: boolean): Edge[] {
  return graph.edges.map((edge) =>
    styleEdge(
      {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        data: edge.data,
        type: 'smoothstep',
      },
      isRunning
    )
  )
}

function flowToGraph(nodes: Node<FlowNodeData>[], edges: Edge[]): WorkflowGraph {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.nodeType,
      position: node.position,
      data: {
        ...node.data.rawData,
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: edge.data,
    })),
  }
}

function getIncomingEdges(graph: WorkflowGraph, nodeId: string) {
  return graph.edges.filter((edge) => edge.target === nodeId)
}

function detectCycle(graph: WorkflowGraph): boolean {
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()

  for (const node of graph.nodes) {
    incoming.set(node.id, 0)
    outgoing.set(node.id, [])
  }

  for (const edge of graph.edges) {
    if (!incoming.has(edge.target) || !outgoing.has(edge.source)) continue
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1)
    outgoing.get(edge.source)?.push(edge.target)
  }

  const queue: string[] = []
  for (const [nodeId, count] of incoming.entries()) {
    if (count === 0) queue.push(nodeId)
  }

  let visited = 0
  while (queue.length > 0) {
    const nodeId = queue.shift() as string
    visited += 1
    for (const target of outgoing.get(nodeId) || []) {
      const next = (incoming.get(target) || 0) - 1
      incoming.set(target, next)
      if (next === 0) queue.push(target)
    }
  }

  return visited !== graph.nodes.length
}

function validateBeforeRun(graph: WorkflowGraph): string[] {
  const issues: string[] = []
  if (graph.nodes.length === 0) issues.push('Добавьте хотя бы одну ноду')
  if (detectCycle(graph)) issues.push('Граф должен быть ацикличным (DAG)')

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))

  for (const edge of graph.edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) {
      issues.push(`Связь ${edge.id} ссылается на отсутствующую ноду`)
    }
  }

  for (const node of graph.nodes) {
    const incoming = getIncomingEdges(graph, node.id)
    const imageIncomingEdges = incoming.filter((edge) => nodesById.get(edge.source)?.type === 'image.generate')
    const videoIncomingEdges = incoming.filter((edge) => {
      const sourceType = nodesById.get(edge.source)?.type
      return sourceType === 'video.generate' || sourceType === 'video.concat'
    })
    const nonVideoIncomingEdges = incoming.filter((edge) => {
      const sourceType = nodesById.get(edge.source)?.type
      return sourceType !== 'video.generate' && sourceType !== 'video.concat'
    })
    const imageIncomingNodeIds = Array.from(new Set(imageIncomingEdges.map((edge) => edge.source)))
    const refSource = getRefSource(node)
    const selectedUpstreamNodeId = getSelectedUpstreamNodeId(node)
    const selectedStartUpstreamNodeId = getSelectedStartUpstreamNodeId(node)
    const selectedEndUpstreamNodeId = getSelectedEndUpstreamNodeId(node)
    const explicitSeedanceFrameSelection = hasExplicitSeedanceFrameSelection(node)
    const selectedImageIncoming = selectedUpstreamNodeId === 'all'
      ? imageIncomingEdges.length
      : imageIncomingEdges.filter((edge) => edge.source === selectedUpstreamNodeId).length
    const uploadedRefs = Array.isArray(node.data?.ref_images)
      ? node.data.ref_images.filter((item) => typeof item === 'string' && item.trim().length > 0).length
      : 0
    const effectiveImageInputs = refSource === 'upload'
      ? uploadedRefs
      : refSource === 'mixed'
        ? selectedImageIncoming + uploadedRefs
        : selectedImageIncoming
    const selectedStartIncoming = selectedStartUpstreamNodeId === 'auto'
      ? (imageIncomingNodeIds.length > 0 ? 1 : 0)
      : (imageIncomingNodeIds.includes(selectedStartUpstreamNodeId) ? 1 : 0)
    const selectedEndIncoming = selectedEndUpstreamNodeId === 'none'
      ? 0
      : (imageIncomingNodeIds.includes(selectedEndUpstreamNodeId) ? 1 : 0)
    const selectedSeedanceIncoming = explicitSeedanceFrameSelection
      ? selectedStartIncoming + selectedEndIncoming
      : selectedImageIncoming
    const effectiveSeedanceImageInputs = refSource === 'upload'
      ? uploadedRefs
      : refSource === 'mixed'
        ? selectedSeedanceIncoming + uploadedRefs
        : selectedSeedanceIncoming

    if (node.type === 'prompt') {
      const text = String(node.data?.text || node.data?.prompt || '').trim()
      if (!text) issues.push(`Нода ${node.id}: заполните текст промпта`)
      continue
    }

    if (node.type === 'video.concat') {
      if (nonVideoIncomingEdges.length > 0) {
        issues.push(`Нода ${node.id}: video.concat принимает только видео-входы`)
      }
      if (videoIncomingEdges.length < 2) {
        issues.push(`Нода ${node.id}: video.concat требует минимум 2 видео`)
      }
      if (videoIncomingEdges.length > 12) {
        issues.push(`Нода ${node.id}: video.concat поддерживает максимум 12 видео`)
      }
      continue
    }

    if (node.type === 'image.generate') {
      if ((refSource === 'upstream' || refSource === 'mixed') && selectedUpstreamNodeId !== 'all' && selectedImageIncoming === 0) {
        issues.push(`Нода ${node.id}: выбранный предыдущий нод не подключен`)
      }
      if (effectiveImageInputs > 8) issues.push(`Нода ${node.id}: максимум 8 ref-изображений`)
      const prompt = String(node.data?.prompt || '').trim()
      if (!prompt) issues.push(`Нода ${node.id}: заполните prompt`)
      continue
    }

    if (node.type === 'video.generate') {
      const model = String(node.data?.model || 'seedance-1.5-pro')
      const mode = String(node.data?.mode || (effectiveSeedanceImageInputs > 0 ? 'i2v' : 't2v'))
      const prompt = String(node.data?.prompt || '').trim()
      const skipLegacySelectionValidation = model === 'seedance-1.5-pro'
        && (mode === 'i2v' || mode === '')
        && explicitSeedanceFrameSelection

      if ((refSource === 'upstream' || refSource === 'mixed') && selectedUpstreamNodeId !== 'all' && selectedImageIncoming === 0 && !skipLegacySelectionValidation) {
        issues.push(`Нода ${node.id}: выбранный предыдущий нод не подключен`)
      }

      if ((refSource === 'upstream' || refSource === 'mixed') && model === 'seedance-1.5-pro' && mode === 'i2v' && explicitSeedanceFrameSelection) {
        if (selectedStartUpstreamNodeId !== 'auto' && selectedStartIncoming === 0) {
          issues.push(`Нода ${node.id}: выбранный нод для стартового кадра не подключен`)
        }
        if (selectedEndUpstreamNodeId !== 'none' && selectedEndIncoming === 0) {
          issues.push(`Нода ${node.id}: выбранный нод для финального кадра не подключен`)
        }
      }

      if (model === 'seedance-1.5-pro') {
        if (mode === 't2v' && effectiveImageInputs !== 0) issues.push(`Нода ${node.id}: seedance t2v не принимает изображения`)
        if (mode === 'i2v' && (effectiveSeedanceImageInputs < 1 || effectiveSeedanceImageInputs > 2)) {
          issues.push(`Нода ${node.id}: seedance i2v требует 1..2 изображения`)
        }
      }
      if (model === 'kling-i2v' && effectiveImageInputs !== 1) {
        issues.push(`Нода ${node.id}: kling-i2v требует ровно 1 изображение`)
      }
      if (model === 'kling-t2v' && effectiveImageInputs !== 0) {
        issues.push(`Нода ${node.id}: kling-t2v не принимает изображения`)
      }
      if (!prompt) {
        issues.push(`Нода ${node.id}: заполните prompt`)
      }
    }
  }

  return issues
}

const WorkflowNodeCard = memo(({ data }: NodeProps<Node<FlowNodeData>>) => {
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
          <span className="text-[10px] text-red-200">failed</span>
        ) : nodeData.status === 'skipped' ? (
          <span className="text-[10px] text-zinc-400">skipped</span>
        ) : (
          <span className={`text-[10px] ${tone.label}`}>idle</span>
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

export default function WorkflowPage() {
  const navigate = useNavigate()
  const nodeTypes = useMemo(() => ({ workflow: WorkflowNodeCard }), [])

  const {
    graph,
    selectedNodeId,
    dirty,
    templates,
    activeTemplateId,
    activeRunId,
    runStatus,
    run,
    setGraph,
    setSelectedNodeId,
    setDirty,
    setTemplates,
    setActiveTemplateId,
    setActiveRun,
    setRun,
    updateNodeData,
  } = useWorkflowStore()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunningAction, setIsRunningAction] = useState(false)
  const [uploadingNodeId, setUploadingNodeId] = useState<string | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  const [workflowName, setWorkflowName] = useState('Photo To Video Pipeline')
  const [isMobileViewport, setIsMobileViewport] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false))

  const isGraphSyncingRef = useRef(false)
  const isRunning = runStatus === 'running' || runStatus === 'queued'

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(
    graphToFlowNodes(graph, selectedNodeId, run)
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphToFlowEdges(graph, isRunning))

  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const loadTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await listWorkflowTemplates()
      setTemplates(items)

      if (items.length > 0) {
        const first = items[0]
        setActiveTemplateId(first.id)
        setGraph(first.graph)
        setWorkflowName(first.name)
        setDirty(false)
      } else {
        setActiveTemplateId(null)
        setGraph(getDefaultWorkflowGraph())
        setWorkflowName('Photo To Video Pipeline')
        setDirty(true)
      }
    } catch (error) {
      console.error('[Workflow] Failed to load templates:', error)
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить workflows')
    } finally {
      setIsLoading(false)
    }
  }, [setActiveTemplateId, setDirty, setGraph, setTemplates])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    isGraphSyncingRef.current = true
    setNodes(graphToFlowNodes(graph, selectedNodeId, run))
    setEdges(graphToFlowEdges(graph, isRunning))
    const timer = window.setTimeout(() => {
      isGraphSyncingRef.current = false
    }, 0)

    return () => window.clearTimeout(timer)
  }, [graph, isRunning, run, selectedNodeId, setEdges, setNodes])

  useEffect(() => {
    if (isGraphSyncingRef.current) return
    if (nodes.some((node) => node.dragging)) return
    const nextGraph = flowToGraph(nodes, edges)
    if (JSON.stringify(nextGraph) === JSON.stringify(graph)) return
    setGraph(nextGraph)
    setDirty(true)
  }, [edges, graph, nodes, setDirty, setGraph])

  const selectedNode = useMemo(() => graph.nodes.find((node) => node.id === selectedNodeId) || null, [graph.nodes, selectedNodeId])
  const selectedNodeIncomingOptions = useMemo(() => {
    if (!selectedNode) return []
    return graph.edges
      .filter((edge) => edge.target === selectedNode.id)
      .map((edge, index) => {
        const source = graph.nodes.find((node) => node.id === edge.source)
        return {
          id: edge.source,
          edgeId: edge.id,
          order: Number(edge.data?.order ?? index),
          label: source ? `${getNodeDisplayName(source)} (${source.id})` : edge.source,
          type: source?.type || 'image.generate',
        }
      })
      .sort((a, b) => {
        const byOrder = a.order - b.order
        if (byOrder !== 0) return byOrder
        return a.edgeId.localeCompare(b.edgeId)
      })
  }, [graph.edges, graph.nodes, selectedNode])

  const handleUpdateInputOrder = useCallback((nodeId: string, edgeId: string, fragmentOrder: number) => {
    const targetEdges = graph.edges
      .filter((edge) => edge.target === nodeId)
      .sort((a, b) => {
        const byOrder = Number(a.data?.order ?? 0) - Number(b.data?.order ?? 0)
        if (byOrder !== 0) return byOrder
        return a.id.localeCompare(b.id)
      })

    const currentIndex = targetEdges.findIndex((edge) => edge.id === edgeId)
    if (currentIndex < 0) return

    const desiredIndex = Math.max(0, Math.min(targetEdges.length - 1, Math.floor(fragmentOrder) - 1))
    if (desiredIndex === currentIndex) return

    const reordered = [...targetEdges]
    const [movedEdge] = reordered.splice(currentIndex, 1)
    reordered.splice(desiredIndex, 0, movedEdge)

    const orderByEdgeId = new Map<string, number>()
    reordered.forEach((edge, index) => {
      orderByEdgeId.set(edge.id, index)
    })

    const nextEdges = graph.edges.map((edge) => {
      const nextOrder = orderByEdgeId.get(edge.id)
      if (nextOrder === undefined) return edge
      return {
        ...edge,
        data: {
          ...edge.data,
          order: nextOrder,
        },
      }
    })

    setGraph({
      ...graph,
      edges: nextEdges,
    })
    setDirty(true)
  }, [graph, setDirty, setGraph])

  const progressValue = Math.max(0, Math.min(100, Number(run?.progress || 0)))
  const terminalRun = run?.status === 'completed' || run?.status === 'failed' || run?.status === 'cancelled'
  const runError = run?.error?.message || null
  const runGenerationId = run?.generation_ids?.[0] || null

  useEffect(() => {
    if (!activeRunId) return

    let cancelled = false
    const poll = async () => {
      try {
        const latestRun = await getWorkflowRun(activeRunId)
        if (cancelled) return
        setRun(latestRun)

        if (latestRun.status === 'completed') {
          toast.success('Workflow завершен')
          window.clearInterval(interval)
          setIsRunningAction(false)
        } else if (latestRun.status === 'failed' || latestRun.status === 'cancelled') {
          toast.error(latestRun.error?.message || 'Workflow завершился с ошибкой')
          window.clearInterval(interval)
          setIsRunningAction(false)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Workflow] Poll run failed:', error)
        }
      }
    }

    void poll()
    const interval = window.setInterval(() => {
      void poll()
    }, 2500)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [activeRunId, setRun])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const incomingCount = edges.filter((edge) => edge.target === connection.target).length
      const nextEdge: Edge = styleEdge(
        {
          id: `${connection.source}-${connection.target}-${Date.now()}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          type: 'smoothstep',
          data: { order: incomingCount },
        },
        isRunning
      )

      setEdges((currentEdges) => addEdge(nextEdge, currentEdges))
    },
    [edges, isRunning, setEdges]
  )

  const handleNodeClick = useCallback(
    (_: unknown, node: Node<FlowNodeData>) => {
      setSelectedNodeId(node.id)
      setShowInspector(true)
      if (isMobileViewport) {
        setShowLibrary(false)
      }
    },
    [isMobileViewport, setSelectedNodeId]
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  const handleToggleLibrary = () => {
    setShowLibrary((value) => !value)
    if (isMobileViewport) setShowInspector(false)
  }

  const handleToggleInspector = () => {
    setShowInspector((value) => !value)
    if (isMobileViewport) setShowLibrary(false)
  }

  const handleAddNode = (type: WorkflowNode['type']) => {
    const nodeId = `${type.replace('.', '-')}-${Date.now()}`
    const baseData: WorkflowNodeData =
      type === 'prompt'
        ? { text: '' }
        : type === 'image.generate'
          ? {
            model: 'gpt-image-1.5',
            aspect_ratio: '3:4',
            image_count: 1,
            prompt: '',
            ref_source: 'upstream',
            selected_upstream_node_id: 'all',
            ref_images: [],
          }
          : type === 'video.concat'
            ? {
            }
          : {
            model: 'seedance-1.5-pro',
            mode: 'i2v',
            video_duration: '8',
            video_resolution: '720p',
            prompt: '',
            ref_source: 'upstream',
            selected_upstream_node_id: 'all',
            selected_start_upstream_node_id: 'auto',
            selected_end_upstream_node_id: 'none',
            ref_images: [],
          }

    const nextGraph: WorkflowGraph = {
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id: nodeId,
          type,
          position: { x: 80 + graph.nodes.length * 42, y: 80 + graph.nodes.length * 56 },
          data: baseData,
        },
      ],
    }

    setGraph(nextGraph)
    setSelectedNodeId(nodeId)
    setDirty(true)
    setShowInspector(true)
    if (isMobileViewport) setShowLibrary(false)
  }

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return
    const nextGraph: WorkflowGraph = {
      nodes: graph.nodes.filter((node) => node.id !== selectedNodeId),
      edges: graph.edges.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
    }
    setGraph(nextGraph)
    setSelectedNodeId(null)
    setDirty(true)
  }

  const fileToDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
      reader.readAsDataURL(file)
    })
  }, [])

  const handleUploadNodeRefs = useCallback(
    async (node: WorkflowNode, files: FileList | null) => {
      if (!files || files.length === 0) return
      const limit = node.type === 'image.generate' ? 8 : 2
      const currentRefs = Array.isArray(node.data?.ref_images)
        ? node.data.ref_images.filter((item) => typeof item === 'string' && item.trim().length > 0)
        : []
      const freeSlots = Math.max(0, limit - currentRefs.length)
      if (freeSlots === 0) {
        toast.error(`Достигнут лимит референсов (${limit})`)
        return
      }

      const picked = Array.from(files).slice(0, freeSlots)
      setUploadingNodeId(node.id)

      try {
        const uploadedUrls: string[] = []
        for (const file of picked) {
          const dataUrl = await fileToDataUrl(file)
          const res = await fetch('/api/chat/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ image: dataUrl }),
          })
          const payload = await res.json().catch(() => null)
          if (!res.ok || !payload?.url) {
            throw new Error(payload?.error || `Upload failed (${res.status})`)
          }
          uploadedUrls.push(String(payload.url))
        }

        const nextRefs = [...currentRefs, ...uploadedUrls]
        updateNodeData(node.id, { ref_images: nextRefs })
        toast.success(`Загружено ${uploadedUrls.length} референсов`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Ошибка загрузки референсов')
      } finally {
        setUploadingNodeId(null)
      }
    },
    [fileToDataUrl, updateNodeData]
  )

  const handleRemoveNodeRef = useCallback(
    (node: WorkflowNode, index: number) => {
      const refs = Array.isArray(node.data?.ref_images) ? node.data.ref_images : []
      const nextRefs = refs.filter((_, idx) => idx !== index)
      updateNodeData(node.id, { ref_images: nextRefs })
    },
    [updateNodeData]
  )

  const saveCurrentTemplate = useCallback(async (): Promise<number | null> => {
    setIsSaving(true)
    try {
      if (activeTemplateId) {
        const updated = await patchWorkflowTemplate(activeTemplateId, {
          name: workflowName.trim() || 'Workflow',
          graph,
        })

        setTemplates(templates.map((item) => (item.id === updated.id ? updated : item)))
        setDirty(false)
        toast.success('Workflow сохранен')
        return updated.id
      }

      const created = await createWorkflowTemplate({
        name: workflowName.trim() || 'Workflow',
        graph,
      })
      setTemplates([created, ...templates])
      setActiveTemplateId(created.id)
      setDirty(false)
      toast.success('Workflow создан')
      return created.id
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось сохранить workflow')
      return null
    } finally {
      setIsSaving(false)
    }
  }, [activeTemplateId, graph, setActiveTemplateId, setDirty, setTemplates, templates, workflowName])

  const handleSave = async () => {
    await saveCurrentTemplate()
  }

  const handleRun = async () => {
    const issues = validateBeforeRun(graph)
    if (issues.length > 0) {
      toast.error(issues[0])
      return
    }

    setIsRunningAction(true)
    try {
      let workflowId = activeTemplateId
      if (!workflowId || dirty) {
        workflowId = await saveCurrentTemplate()
      }
      if (!workflowId) {
        setIsRunningAction(false)
        return
      }

      const runStart = await startWorkflowRun(workflowId)
      setRun(null)
      setActiveRun(runStart.run_id, runStart.status)
      toast.success(`Run #${runStart.run_id} запущен`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось запустить workflow')
      setIsRunningAction(false)
    }
  }

  const handleSelectTemplate = (value: string) => {
    const templateId = Number(value)
    const selectedTemplate = templates.find((item) => item.id === templateId)
    if (!selectedTemplate) return

    setActiveTemplateId(selectedTemplate.id)
    setGraph(selectedTemplate.graph)
    setWorkflowName(selectedTemplate.name)
    setDirty(false)
    setRun(null)
    setActiveRun(null, null)
  }

  const activeTemplateLabel = activeTemplateId ? `Workflow #${activeTemplateId}` : 'Draft'

  return (
    <div className="min-h-full bg-black pb-[calc(env(safe-area-inset-bottom)+84px)] pt-[calc(env(safe-area-inset-top)+74px)] text-zinc-100 lg:pb-6 lg:pt-4">
      <div className="mx-auto w-full max-w-[1540px] px-3 py-3 sm:px-6 sm:py-6">
        <header className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[260px]">
              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Workflow Builder</p>
              <input
                value={workflowName}
                onChange={(event) => {
                  setWorkflowName(event.target.value)
                  setDirty(true)
                }}
                className="mt-1 w-full max-w-[520px] border-none bg-transparent p-0 text-lg font-semibold text-white outline-none sm:text-xl"
                placeholder="Workflow name"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span>{activeTemplateLabel}</span>
                {dirty ? <span className="text-amber-300">unsaved changes</span> : null}
                {templates.length > 0 ? (
                  <select
                    value={activeTemplateId ?? ''}
                    onChange={(event) => handleSelectTemplate(event.target.value)}
                    className="rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-200"
                  >
                    {templates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  showLibrary
                    ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
                    : 'border-white/10 bg-zinc-900/75 text-zinc-200 hover:bg-zinc-900'
                }`}
                onClick={handleToggleLibrary}
              >
                <PanelLeft className="h-3.5 w-3.5" />
                Ноды
              </button>
              <button
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  showInspector
                    ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
                    : 'border-white/10 bg-zinc-900/75 text-zinc-200 hover:bg-zinc-900'
                }`}
                onClick={handleToggleInspector}
              >
                <PanelRight className="h-3.5 w-3.5" />
                Settings
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/75 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900 disabled:opacity-60"
                onClick={handleSave}
                disabled={isSaving || isLoading}
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/75 bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-60"
                onClick={isRunning ? undefined : handleRun}
                disabled={isRunningAction || isLoading}
              >
                {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isRunning ? 'Running' : 'Run'}
              </button>
            </div>
          </div>
        </header>

        {showLibrary ? (
          <section className="mt-3 rounded-2xl border border-white/10 bg-black/55 p-3 lg:hidden backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">Ноды</p>
            <p className="mt-1 text-xs text-zinc-500">Выберите тип ноды и добавьте в граф</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {NODE_LIBRARY.map((item) => (
                <button
                  key={`mobile-${item.type}`}
                  className="rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-2 text-left font-medium text-zinc-200"
                  onClick={() => handleAddNode(item.type)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5 text-cyan-300" />
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {showInspector ? (
          <section className="mt-3 rounded-2xl border border-white/10 bg-black/55 p-3 lg:hidden backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">Settings</p>
            {selectedNode ? (
              <NodeSettings
                node={selectedNode}
                incomingOptions={selectedNodeIncomingOptions}
                onPatch={updateNodeData}
                onUpdateInputOrder={handleUpdateInputOrder}
                onDelete={handleDeleteSelectedNode}
                onUploadRefs={handleUploadNodeRefs}
                onRemoveRef={handleRemoveNodeRef}
                isUploading={uploadingNodeId === selectedNode.id}
              />
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Нажмите на ноду, чтобы открыть её настройки</p>
            )}
          </section>
        ) : null}

        <div className="mt-3 flex gap-3">
          <aside className={`${showLibrary ? 'hidden w-60 shrink-0 lg:block' : 'hidden'}`}>
            <div className="h-full rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur-xl">
              <h2 className="text-sm font-semibold text-white">Ноды</h2>
              <p className="mt-1 text-xs text-zinc-500">Добавляйте блоки в workflow</p>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                {NODE_LIBRARY.map((item) => (
                  <button
                    key={item.type}
                    className="rounded-lg border border-white/10 bg-zinc-900/80 px-2 py-2 text-left font-medium text-zinc-200 hover:border-cyan-300/60"
                    onClick={() => handleAddNode(item.type)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5 text-cyan-300" />
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/70 p-2.5 text-[11px] text-zinc-500">
                V1: image.generate, video.generate, video.concat. Fan-in запускает ноду после готовности всех входов.
              </div>
            </div>
          </aside>

          <section className="relative min-h-[72vh] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#05070b]">
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-[11px] backdrop-blur-xl">
              <span className="font-semibold text-zinc-200">{activeTemplateLabel}</span>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-400">nodes {graph.nodes.length}</span>
            </div>

            <div className="pointer-events-none absolute left-3 right-3 bottom-3 z-10 rounded-xl border border-white/10 bg-black/80 p-2.5 backdrop-blur-xl">
              <div className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1 text-zinc-300">
                  <Clock3 className="h-3.5 w-3.5" />
                  Execution
                </span>
                <span className="text-zinc-500">{run?.status || 'idle'}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              {runError ? <p className="mt-2 text-[11px] text-red-300">{runError}</p> : null}
              {terminalRun && runGenerationId ? (
                <button
                  className="pointer-events-auto mt-2 inline-flex rounded-lg border border-cyan-400/60 bg-cyan-500/15 px-2.5 py-1 text-[11px] text-cyan-200"
                  onClick={() => navigate(`/profile?gen=${runGenerationId}`)}
                >
                  Открыть результат
                </button>
              ) : null}
            </div>

            {isLoading ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 text-sm text-zinc-300">
                Loading workflow...
              </div>
            ) : null}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              fitView
              minZoom={0.03}
              maxZoom={2}
              panOnDrag={!isMobileViewport}
              selectionOnDrag={!isMobileViewport}
              zoomOnScroll={!isMobileViewport}
              preventScrolling={false}
              fitViewOptions={{ padding: 0.2, maxZoom: 1.05 }}
              defaultEdgeOptions={{
                type: 'smoothstep',
              }}
              className="workflow-flow"
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={22} size={1} color="#1b2430" />
              <Controls position="top-right" showInteractive={false} />
            </ReactFlow>
          </section>

          <aside className={`${showInspector ? 'hidden w-[320px] shrink-0 lg:block' : 'hidden'}`}>
            <div className="h-full rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur-xl">
              <h2 className="text-sm font-semibold text-white">Node Settings</h2>

              {selectedNode ? (
                <NodeSettings
                  node={selectedNode}
                  incomingOptions={selectedNodeIncomingOptions}
                  onPatch={updateNodeData}
                  onUpdateInputOrder={handleUpdateInputOrder}
                  onDelete={handleDeleteSelectedNode}
                  onUploadRefs={handleUploadNodeRefs}
                  onRemoveRef={handleRemoveNodeRef}
                  isUploading={uploadingNodeId === selectedNode.id}
                />
              ) : (
                <div className="mt-3 rounded-xl border border-white/10 bg-zinc-900/80 p-3 text-xs text-zinc-500">
                  Выберите ноду на канвасе, чтобы изменить параметры.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function NodeSettings(props: {
  node: WorkflowNode
  incomingOptions: Array<{ id: string; edgeId: string; order: number; label: string; type: string }>
  onPatch: (nodeId: string, patch: Partial<WorkflowNodeData>) => void
  onUpdateInputOrder: (nodeId: string, edgeId: string, fragmentOrder: number) => void
  onDelete: () => void
  onUploadRefs: (node: WorkflowNode, files: FileList | null) => Promise<void>
  onRemoveRef: (node: WorkflowNode, index: number) => void
  isUploading: boolean
}) {
  const { node, incomingOptions, onPatch, onUpdateInputOrder, onDelete, onUploadRefs, onRemoveRef, isUploading } = props
  const imageIncomingOptions = Array.from(
    new Map(
      incomingOptions
        .filter((item) => item.type === 'image.generate')
        .map((item) => [item.id, item])
    ).values()
  )
  const videoIncomingOptions = incomingOptions
    .filter((item) => item.type === 'video.generate' || item.type === 'video.concat')
    .sort((a, b) => {
      const byOrder = a.order - b.order
      if (byOrder !== 0) return byOrder
      return a.edgeId.localeCompare(b.edgeId)
    })
  const rawRefSource = getRefSource(node)
  const refSource = node.type === 'video.generate' && rawRefSource === 'mixed' ? 'upstream' : rawRefSource
  const selectedUpstreamNodeId = getSelectedUpstreamNodeId(node)
  const selectedStartUpstreamNodeId = getSelectedStartUpstreamNodeId(node)
  const selectedEndUpstreamNodeId = getSelectedEndUpstreamNodeId(node)
  const refImages = Array.isArray(node.data?.ref_images) ? node.data.ref_images : []
  const isGeneratorNode = node.type === 'image.generate' || node.type === 'video.generate'
  const videoModel = node.type === 'video.generate'
    ? String(node.data?.model || 'seedance-1.5-pro')
    : ''
  const videoMode = node.type === 'video.generate'
    ? String(node.data?.mode || 'i2v')
    : 'i2v'
  const isSeedanceI2V = node.type === 'video.generate'
    && videoModel === 'seedance-1.5-pro'
    && videoMode === 'i2v'
  const maxRefs = node.type === 'image.generate' ? 8 : 2
  const sourceModes = node.type === 'video.generate'
    ? [
      { value: 'upstream', label: 'Из предыдущего нода' },
      { value: 'upload', label: 'Загруженные фото' },
    ]
    : [
      { value: 'upstream', label: 'Из предыдущего нода' },
      { value: 'upload', label: 'Загруженные фото' },
      { value: 'mixed', label: 'Смешанный источник' },
    ]

  return (
    <div className="mt-3 space-y-2 text-[11px]">
      <div className="rounded-xl border border-white/10 bg-zinc-900/80 p-2.5">
        <p className="text-xs font-semibold text-zinc-100">{deriveNodeTitle(node)}</p>
        <p className="mt-1 text-[11px] text-zinc-400">{node.id}</p>
      </div>

      <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
        <p className="text-zinc-500">Название ноды</p>
        <input
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
          value={String(node.data?.label || '')}
          placeholder={getDefaultNodeTitle(node)}
          onChange={(event) => onPatch(node.id, { label: event.target.value })}
        />
      </label>

      {node.type === 'prompt' ? (
        <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
          <p className="text-zinc-500">Prompt text</p>
          <textarea
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
            value={String(node.data?.text || '')}
            rows={4}
            onChange={(event) => onPatch(node.id, { text: event.target.value })}
          />
        </label>
      ) : null}

      {node.type === 'video.concat' ? (
        <>
          <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2 text-zinc-300">
            <p className="text-zinc-500">FFmpeg: Соединить видео в один</p>
            <p className="mt-1">Подключите минимум 2 видео-ноды на вход. На выходе будет одно объединенное видео.</p>
            <p className="mt-1 text-zinc-400">Сейчас audio не объединяется, собирается видео-дорожка.</p>
          </div>

          <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Последовательность фрагментов</p>
            {videoIncomingOptions.length > 0 ? (
              <div className="mt-2 space-y-2">
                {videoIncomingOptions.map((item) => (
                  <div key={item.edgeId} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/25 px-2 py-1.5">
                    <span className="text-zinc-200">{item.label}</span>
                    <label className="inline-flex items-center gap-1.5 text-zinc-400">
                      <span>Фрагмент</span>
                      <select
                        className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-zinc-100 outline-none"
                        value={String(item.order + 1)}
                        onChange={(event) => onUpdateInputOrder(node.id, item.edgeId, Number(event.target.value))}
                      >
                        {Array.from({ length: videoIncomingOptions.length }, (_, index) => (
                          <option key={`${item.edgeId}-pos-${index + 1}`} value={index + 1}>
                            {index + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-zinc-400">Подключите видео-ноды для настройки очередности</p>
            )}
          </div>
        </>
      ) : null}

      {isGeneratorNode ? (
        <>
          <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Подключенные предыдущие ноды</p>
            {imageIncomingOptions.length > 0 ? (
              <div className="mt-1 space-y-1">
                {imageIncomingOptions.map((item) => (
                  <p key={item.id} className="text-zinc-200">{item.label}</p>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-zinc-400">Нет подключений</p>
            )}
          </div>

          <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Источник фото-референсов</p>
            <select
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
              value={refSource}
              onChange={(event) => onPatch(node.id, {
                ref_source: event.target.value as WorkflowNodeData['ref_source'],
              })}
            >
              {sourceModes.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
          </label>

          {(refSource === 'upstream' || refSource === 'mixed') && isSeedanceI2V && imageIncomingOptions.length > 0 ? (
            <>
              <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
                <p className="text-zinc-500">Стартовый кадр: источник-нода</p>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                  value={selectedStartUpstreamNodeId}
                  onChange={(event) => onPatch(node.id, {
                    selected_start_upstream_node_id: event.target.value as WorkflowNodeData['selected_start_upstream_node_id'],
                  })}
                >
                  <option value="auto">Авто (первый доступный)</option>
                  {imageIncomingOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
                <p className="text-zinc-500">Финальный кадр: источник-нода</p>
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                  value={selectedEndUpstreamNodeId}
                  onChange={(event) => onPatch(node.id, {
                    selected_end_upstream_node_id: event.target.value as WorkflowNodeData['selected_end_upstream_node_id'],
                  })}
                >
                  <option value="none">Не использовать</option>
                  {imageIncomingOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {(refSource === 'upstream' || refSource === 'mixed') && !isSeedanceI2V && imageIncomingOptions.length > 1 ? (
            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Какой предыдущий нод использовать</p>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={selectedUpstreamNodeId}
                onChange={(event) => onPatch(node.id, {
                  selected_upstream_node_id: event.target.value as WorkflowNodeData['selected_upstream_node_id'],
                })}
              >
                <option value="all">Все подключенные</option>
                {imageIncomingOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
          ) : null}

          {(refSource === 'upload' || refSource === 'mixed') ? (
            <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-zinc-500">Загруженные фото-референсы</p>
                <span className="text-zinc-400">{refImages.length}/{maxRefs}</span>
              </div>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-cyan-400/60 bg-cyan-500/10 px-2 py-1 text-zinc-100">
                {isUploading ? 'Загрузка...' : 'Добавить фото'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={isUploading}
                  onChange={async (event) => {
                    await onUploadRefs(node, event.target.files)
                    event.currentTarget.value = ''
                  }}
                />
              </label>

              {refImages.length > 0 ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {refImages.map((url, index) => (
                    <div key={`${url}-${index}`} className="relative overflow-hidden rounded-md border border-white/10 bg-black/30">
                      <img src={url} alt={`ref-${index + 1}`} className="h-14 w-full object-cover" />
                      <button
                        className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white"
                        onClick={() => onRemoveRef(node, index)}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-zinc-400">Референсы не добавлены</p>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {node.type === 'image.generate' ? (
        <>
          <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Model</p>
            <select
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
              value={String(node.data?.model || 'gpt-image-1.5')}
              onChange={(event) => onPatch(node.id, { model: event.target.value })}
            >
              <option value="gpt-image-1.5">gpt-image-1.5</option>
              <option value="nanobanana-pro">nanobanana-pro</option>
              <option value="seedream4-5">seedream4-5</option>
            </select>
          </label>

          <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Prompt</p>
            <textarea
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
              value={String(node.data?.prompt || '')}
              rows={3}
              onChange={(event) => onPatch(node.id, { prompt: event.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Aspect</p>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={String(node.data?.aspect_ratio || '3:4')}
                onChange={(event) => onPatch(node.id, { aspect_ratio: event.target.value })}
              >
                <option value="1:1">1:1</option>
                <option value="3:4">3:4</option>
                <option value="4:3">4:3</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </label>

            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Count</p>
              <input
                type="number"
                min={1}
                max={4}
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={Number(node.data?.image_count || 1)}
                onChange={(event) => onPatch(node.id, { image_count: Math.max(1, Math.min(4, Number(event.target.value) || 1)) })}
              />
            </label>
          </div>
        </>
      ) : null}

      {node.type === 'video.generate' ? (
        <>
          <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Model</p>
            <select
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
              value={videoModel}
              onChange={(event) => onPatch(node.id, {
                model: event.target.value as WorkflowNodeData['model'],
                ref_source: 'upstream',
                selected_upstream_node_id: 'all',
                selected_start_upstream_node_id: 'auto',
                selected_end_upstream_node_id: 'none',
              })}
            >
              <option value="seedance-1.5-pro">seedance-1.5-pro</option>
              <option value="kling-i2v">kling-i2v</option>
              <option value="kling-t2v">kling-t2v</option>
            </select>
          </label>

          {videoModel === 'seedance-1.5-pro' ? (
            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Mode</p>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={videoMode}
                onChange={(event) => onPatch(node.id, { mode: event.target.value as WorkflowNodeData['mode'] })}
              >
                <option value="i2v">i2v</option>
                <option value="t2v">t2v</option>
              </select>
            </label>
          ) : null}

          <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
            <p className="text-zinc-500">Prompt</p>
            <textarea
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
              value={String(node.data?.prompt || '')}
              rows={3}
              onChange={(event) => onPatch(node.id, { prompt: event.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Duration</p>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={String(node.data?.video_duration || '8')}
                onChange={(event) => onPatch(node.id, { video_duration: event.target.value })}
              >
                <option value="4">4s</option>
                <option value="8">8s</option>
                <option value="12">12s</option>
              </select>
            </label>

            <label className="block rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
              <p className="text-zinc-500">Resolution</p>
              <select
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-zinc-100 outline-none"
                value={String(node.data?.video_resolution || '720p')}
                onChange={(event) => onPatch(node.id, { video_resolution: event.target.value })}
              >
                <option value="480p">480p</option>
                <option value="720p">720p</option>
              </select>
            </label>
          </div>
        </>
      ) : null}

      <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
        <p className="text-zinc-500">Тип</p>
        <p className="mt-0.5 text-zinc-200">{node.type}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-zinc-900/75 px-2.5 py-2">
        <p className="text-zinc-500">Оценка стоимости</p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-zinc-200">
          <Coins className="h-3.5 w-3.5 text-yellow-400" />
          зависит от модели
        </p>
      </div>

      <button
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-200"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Удалить ноду
      </button>
    </div>
  )
}
