import {
  MarkerType,
  type Edge,
  type Node,
} from '@xyflow/react'
import {
  CheckCircle2,
  CircleDashed,
  Film,
  ImageIcon,
  Sparkles,
} from 'lucide-react'
import type {
  NodeArtifact,
  WorkflowGraph,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowRunDTO,
} from '@aiverse/shared/types/workflow'

export type FlowNodeStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped'
export type IconKey = 'prompt' | 'image' | 'video'

export type FlowNodeData = {
  nodeType: WorkflowNode['type']
  title: string
  subtitle: string
  model: string
  paramsText: string
  sourceText: string
  icon: IconKey
  status: FlowNodeStatus
  output?: NodeArtifact | null
  onOpenResult?: () => void
  highlighted?: boolean
  rawData: WorkflowNodeData
}

export const ICONS: Record<IconKey, typeof Sparkles> = {
  prompt: Sparkles,
  image: ImageIcon,
  video: Film,
}

export const STATUS_STYLES: Record<FlowNodeStatus, { card: string; label: string }> = {
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

export const NODE_LIBRARY: Array<{ label: string; type: WorkflowNode['type'] }> = [
  { label: 'Генерация фото', type: 'image.generate' },
  { label: 'Генерация видео', type: 'video.generate' },
  { label: 'Инструменты', type: 'video.concat' },
]

export function getDefaultNodeTitle(node: WorkflowNode): string {
  if (node.type === 'prompt') return 'Промпт'
  if (node.type === 'video.concat') return 'Инструменты'
  if (node.type === 'video.generate') return 'Генерация видео'
  return 'Генерация фото'
}

export function getNodeDisplayName(node: WorkflowNode): string {
  const customLabel = String(node.data?.label || '').trim()
  if (customLabel) return customLabel
  return getDefaultNodeTitle(node)
}

function edgeTone(isRunning: boolean) {
  return isRunning ? '#22d3ee' : '#4b5563'
}

export function styleEdge(edge: Edge, isRunning: boolean): Edge {
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

export function getIncomingSourceIds(graph: WorkflowGraph, nodeId: string): string[] {
  return graph.edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source)
}

export function getRefSource(node: WorkflowNode): 'upstream' | 'upload' | 'mixed' {
  const source = String(node.data?.ref_source || 'upstream').toLowerCase()
  if (source === 'upload' || source === 'mixed') return source
  return 'upstream'
}

export function getSelectedUpstreamNodeId(node: WorkflowNode): string | 'all' {
  return typeof node.data?.selected_upstream_node_id === 'string'
    ? node.data.selected_upstream_node_id
    : 'all'
}

export function getSelectedStartUpstreamNodeId(node: WorkflowNode): string | 'auto' {
  if (typeof node.data?.selected_start_upstream_node_id === 'string') {
    return node.data.selected_start_upstream_node_id
  }

  const legacySelected = getSelectedUpstreamNodeId(node)
  if (legacySelected !== 'all') return legacySelected
  return 'auto'
}

export function getSelectedEndUpstreamNodeId(node: WorkflowNode): string | 'none' {
  if (typeof node.data?.selected_end_upstream_node_id === 'string') {
    return node.data.selected_end_upstream_node_id
  }
  return 'none'
}

export function hasExplicitSeedanceFrameSelection(node: WorkflowNode): boolean {
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
    return text ? shortText(text) : 'текст пуст'
  }

  const incomingIds = getIncomingSourceIds(graph, node.id)
  if (node.type === 'video.concat') {
    return `входов ${incomingIds.length} • соединить видео в один`
  }

  const rawRefSource = getRefSource(node)
  const refSource = node.type === 'video.generate' && rawRefSource === 'mixed' ? 'upstream' : rawRefSource
  const selectedId = getSelectedUpstreamNodeId(node)
  const selectedStartId = getSelectedStartUpstreamNodeId(node)
  const selectedEndId = getSelectedEndUpstreamNodeId(node)
  const uploadedCount = Array.isArray(node.data?.ref_images) ? node.data.ref_images.length : 0
  const sourceLabel = (() => {
    if (refSource === 'upload') return `источник: загрузка (${uploadedCount})`
    if (refSource === 'mixed') return `источник: смешанный (${uploadedCount}+пред.)`

    const isSeedanceI2V = node.type === 'video.generate'
      && String(node.data?.model || 'seedance-1.5-pro') === 'seedance-1.5-pro'
      && String(node.data?.mode || 'i2v') === 'i2v'
      && hasExplicitSeedanceFrameSelection(node)
    if (isSeedanceI2V) {
      return `источник: пред. старт:${selectedStartId === 'auto' ? 'авто' : nameById(selectedStartId)}${selectedEndId !== 'none' ? ` финал:${nameById(selectedEndId)}` : ''}`
    }
    return `источник: пред.${selectedId !== 'all' ? `:${nameById(selectedId)}` : ''}`
  })()

  if (node.type === 'image.generate') {
    const prompt = String(node.data?.prompt || '').trim()
    const ratio = String(node.data?.aspect_ratio || '3:4')
    const count = Number(node.data?.image_count || 1)
    const parts = [sourceLabel, `формат ${ratio}`, `кол-во ${count}`]
    if (prompt) parts.unshift(`промпт: ${shortText(prompt, 28)}`)
    if (incomingIds.length > 0 && refSource !== 'upload') parts.push(`пред.: ${shortText(incomingIds.map(nameById).join(','), 18)}`)
    return parts.join(' • ')
  }

  const prompt = String(node.data?.prompt || '').trim()
  const mode = String(node.data?.mode || 'i2v')
  const duration = String(node.data?.video_duration || '-')
  const resolution = String(node.data?.video_resolution || '-')
  const parts = [sourceLabel, `${mode}`, `${duration}s`, resolution]
  if (prompt) parts.unshift(`промпт: ${shortText(prompt, 28)}`)
  if (incomingIds.length > 0 && refSource !== 'upload') parts.push(`пред.: ${shortText(incomingIds.map(nameById).join(','), 18)}`)
  return parts.join(' • ')
}

export function graphToFlowNodes(
  graph: WorkflowGraph,
  selectedNodeId: string | null,
  run: WorkflowRunDTO | null,
  options?: {
    onOpenNodeResult?: (nodeId: string) => void
  }
): Node<FlowNodeData>[] {
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
      output: run?.node_states?.[node.id]?.output ?? null,
      onOpenResult: options?.onOpenNodeResult
        ? () => options.onOpenNodeResult?.(node.id)
        : undefined,
      highlighted: selectedNodeId === node.id,
      rawData: node.data || {},
    },
  }))
}

export function graphToFlowEdges(graph: WorkflowGraph, isRunning: boolean): Edge[] {
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

export function flowToGraph(nodes: Node<FlowNodeData>[], edges: Edge[]): WorkflowGraph {
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

function isStartHandle(edge: { targetHandle?: string | null }) {
  return String(edge.targetHandle || '').toLowerCase() === 'start_image'
}

function isEndHandle(edge: { targetHandle?: string | null }) {
  return String(edge.targetHandle || '').toLowerCase() === 'end_image'
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

export function validateBeforeRun(graph: WorkflowGraph): string[] {
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
    const startHandleEdges = imageIncomingEdges.filter((edge) => isStartHandle(edge))
    const endHandleEdges = imageIncomingEdges.filter((edge) => isEndHandle(edge))
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
    const handleSeedanceIncoming = (startHandleEdges.length > 0 ? 1 : 0) + (endHandleEdges.length > 0 ? 1 : 0)
    const hasHandleFrameSelection = startHandleEdges.length > 0 || endHandleEdges.length > 0
    const effectiveSeedanceImageInputs = refSource === 'upload'
      ? uploadedRefs
      : refSource === 'mixed'
        ? (hasHandleFrameSelection ? handleSeedanceIncoming : selectedSeedanceIncoming) + uploadedRefs
        : (hasHandleFrameSelection ? handleSeedanceIncoming : selectedSeedanceIncoming)

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
        && (explicitSeedanceFrameSelection || hasHandleFrameSelection)

      if (startHandleEdges.length > 1) {
        issues.push(`Нода ${node.id}: start_image поддерживает только 1 вход`)
      }
      if (endHandleEdges.length > 1) {
        issues.push(`Нода ${node.id}: end_image поддерживает только 1 вход`)
      }
      if ((startHandleEdges.length > 0 || endHandleEdges.length > 0) && !(model === 'seedance-1.5-pro' && mode === 'i2v')) {
        issues.push(`Нода ${node.id}: start/end handles доступны только для seedance i2v`)
      }

      if ((refSource === 'upstream' || refSource === 'mixed') && selectedUpstreamNodeId !== 'all' && selectedImageIncoming === 0 && !skipLegacySelectionValidation) {
        issues.push(`Нода ${node.id}: выбранный предыдущий нод не подключен`)
      }

      if ((refSource === 'upstream' || refSource === 'mixed') && model === 'seedance-1.5-pro' && mode === 'i2v' && !hasHandleFrameSelection && explicitSeedanceFrameSelection) {
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
