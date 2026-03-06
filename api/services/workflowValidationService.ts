import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from '../types/workflow.js'

const MAX_NODES = 25
const MAX_EDGES = 80
const MAX_GRAPH_BYTES = 128 * 1024

const NODE_TYPES = new Set(['prompt', 'image.generate', 'video.generate', 'video.concat'])

type ValidationIssue = {
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

function getOutputKind(node: WorkflowNode): 'prompt' | 'image' | 'video' {
  if (node.type === 'prompt') return 'prompt'
  if (node.type === 'video.generate' || node.type === 'video.concat') return 'video'
  return 'image'
}

function getTargetHandle(edge: WorkflowEdge): string {
  return (edge.targetHandle || 'default').toString()
}

function handleExpects(handle: string): 'prompt' | 'image' | 'video' | 'any' {
  const h = handle.toLowerCase()
  if (h.includes('prompt') || h === 'default_prompt') return 'prompt'
  if (h.includes('video')) return 'video'
  if (h.includes('image') || h.includes('ref') || h.includes('start') || h.includes('end') || h.includes('input')) return 'image'
  return 'any'
}

function getRefSource(node: WorkflowNode): 'upstream' | 'upload' | 'mixed' {
  const value = String(node.data?.ref_source || 'upstream').toLowerCase()
  if (value === 'upload' || value === 'mixed') return value
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

function isStartHandle(handle?: string | null): boolean {
  return String(handle || '').toLowerCase() === 'start_image'
}

function isEndHandle(handle?: string | null): boolean {
  return String(handle || '').toLowerCase() === 'end_image'
}

function getUploadedRefCount(node: WorkflowNode): number {
  if (!Array.isArray(node.data?.ref_images)) return 0
  return node.data.ref_images.filter((item) => typeof item === 'string' && item.trim().length > 0).length
}

function detectCycle(graph: WorkflowGraph): boolean {
  const nodes = graph.nodes.map((n) => n.id)
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()

  for (const id of nodes) {
    incoming.set(id, 0)
    outgoing.set(id, [])
  }

  for (const edge of graph.edges) {
    if (!incoming.has(edge.target) || !outgoing.has(edge.source)) continue
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1)
    outgoing.get(edge.source)!.push(edge.target)
  }

  const queue: string[] = []
  for (const [id, degree] of incoming.entries()) {
    if (degree === 0) queue.push(id)
  }

  let visited = 0
  while (queue.length > 0) {
    const id = queue.shift()!
    visited += 1
    for (const target of outgoing.get(id) || []) {
      const next = (incoming.get(target) || 0) - 1
      incoming.set(target, next)
      if (next === 0) queue.push(target)
    }
  }

  return visited !== nodes.length
}

function validateNodeCardinality(
  node: WorkflowNode,
  incoming: WorkflowEdge[],
  nodesById: Map<string, WorkflowNode>,
  issues: ValidationIssue[]
) {
  let imageInputs = 0
  let promptInputs = 0
  let videoInputs = 0
  const imageInputsBySource = new Map<string, number>()
  let startHandleImageInputs = 0
  let endHandleImageInputs = 0

  for (const edge of incoming) {
    const sourceNode = nodesById.get(edge.source)
    if (!sourceNode) continue

    const sourceKind = getOutputKind(sourceNode)
    const expected = handleExpects(getTargetHandle(edge))

    if (expected === 'prompt') {
      if (sourceKind === 'prompt') promptInputs += 1
      continue
    }
    if (expected === 'image') {
      if (sourceKind === 'image') {
        imageInputs += 1
        imageInputsBySource.set(edge.source, (imageInputsBySource.get(edge.source) || 0) + 1)
        if (isStartHandle(edge.targetHandle)) startHandleImageInputs += 1
        if (isEndHandle(edge.targetHandle)) endHandleImageInputs += 1
      }
      continue
    }

    if (sourceKind === 'prompt') promptInputs += 1
    else if (sourceKind === 'image') {
      imageInputs += 1
      imageInputsBySource.set(edge.source, (imageInputsBySource.get(edge.source) || 0) + 1)
      if (isStartHandle(edge.targetHandle)) startHandleImageInputs += 1
      if (isEndHandle(edge.targetHandle)) endHandleImageInputs += 1
    }
    else videoInputs += 1
  }

  if (node.type === 'video.concat') {
    if (promptInputs > 0) {
      issues.push({
        code: 'video_concat_prompt_input_unsupported',
        message: `Node "${node.id}" does not accept prompt inputs`,
        nodeId: node.id,
      })
    }
    if (imageInputs > 0) {
      issues.push({
        code: 'video_concat_image_input_unsupported',
        message: `Node "${node.id}" does not accept image inputs`,
        nodeId: node.id,
      })
    }
    if (videoInputs < 2) {
      issues.push({
        code: 'video_concat_inputs',
        message: `video.concat node "${node.id}" requires at least 2 video inputs`,
        nodeId: node.id,
      })
    }
    if (videoInputs > 12) {
      issues.push({
        code: 'video_concat_too_many_inputs',
        message: `video.concat node "${node.id}" accepts at most 12 video inputs`,
        nodeId: node.id,
      })
    }
    return
  }

  const refSource = getRefSource(node)
  const selectedUpstreamNodeId = getSelectedUpstreamNodeId(node)
  const selectedStartUpstreamNodeId = getSelectedStartUpstreamNodeId(node)
  const selectedEndUpstreamNodeId = getSelectedEndUpstreamNodeId(node)
  const explicitSeedanceFrameSelection = hasExplicitSeedanceFrameSelection(node)
  const hasSelectedUpstream = selectedUpstreamNodeId !== 'all'
  const hasSelectedStartUpstream = selectedStartUpstreamNodeId !== 'auto'
  const hasSelectedEndUpstream = selectedEndUpstreamNodeId !== 'none'
  const selectedUpstreamImageInputs = hasSelectedUpstream
    ? (imageInputsBySource.get(selectedUpstreamNodeId) || 0)
    : imageInputs
  const selectedStartImageInputs = hasSelectedStartUpstream
    ? (imageInputsBySource.get(selectedStartUpstreamNodeId) || 0)
    : 0
  const selectedEndImageInputs = hasSelectedEndUpstream
    ? (imageInputsBySource.get(selectedEndUpstreamNodeId) || 0)
    : 0
  const uploadedImageInputs = getUploadedRefCount(node)
  const model = (node.data?.model || '').toString()
  const mode = (node.data?.mode || '').toString()
  const isSeedanceNode = node.type === 'video.generate' && model === 'seedance-1.5-pro'
  const isSeedanceI2VNode = isSeedanceNode && (mode === 'i2v' || mode === '')
  const hasSeedanceHandleFrames = startHandleImageInputs > 0 || endHandleImageInputs > 0

  if ((startHandleImageInputs > 0 || endHandleImageInputs > 0) && !isSeedanceI2VNode) {
    issues.push({
      code: 'seedance_handles_unsupported',
      message: `Node "${node.id}" start_image/end_image handles are supported only for seedance i2v`,
      nodeId: node.id,
    })
  }

  if ((refSource === 'upstream' || refSource === 'mixed') && hasSelectedUpstream && selectedUpstreamImageInputs === 0 && !(isSeedanceI2VNode && (explicitSeedanceFrameSelection || hasSeedanceHandleFrames))) {
    issues.push({
      code: 'selected_upstream_missing',
      message: `Node "${node.id}" selected upstream "${selectedUpstreamNodeId}" is not connected as image source`,
      nodeId: node.id,
    })
  }

  if (startHandleImageInputs > 1) {
    issues.push({
      code: 'seedance_start_handle_too_many_inputs',
      message: `Seedance node "${node.id}" start_image handle accepts at most 1 image input`,
      nodeId: node.id,
    })
  }

  if (endHandleImageInputs > 1) {
    issues.push({
      code: 'seedance_end_handle_too_many_inputs',
      message: `Seedance node "${node.id}" end_image handle accepts at most 1 image input`,
      nodeId: node.id,
    })
  }

  if ((refSource === 'upstream' || refSource === 'mixed') && isSeedanceI2VNode && explicitSeedanceFrameSelection && !hasSeedanceHandleFrames) {
    if (hasSelectedStartUpstream && selectedStartImageInputs === 0) {
      issues.push({
        code: 'seedance_selected_start_missing',
        message: `Seedance node "${node.id}" selected start upstream "${selectedStartUpstreamNodeId}" is not connected as image source`,
        nodeId: node.id,
      })
    }
    if (hasSelectedEndUpstream && selectedEndImageInputs === 0) {
      issues.push({
        code: 'seedance_selected_end_missing',
        message: `Seedance node "${node.id}" selected end upstream "${selectedEndUpstreamNodeId}" is not connected as image source`,
        nodeId: node.id,
      })
    }
  }

  const effectiveImageInputs = refSource === 'upload'
    ? uploadedImageInputs
    : refSource === 'mixed'
      ? uploadedImageInputs + selectedUpstreamImageInputs
      : selectedUpstreamImageInputs
  const selectedSeedanceUpstreamImageInputs = hasSeedanceHandleFrames
    ? ((startHandleImageInputs > 0 ? 1 : 0) + (endHandleImageInputs > 0 ? 1 : 0))
    : explicitSeedanceFrameSelection
      ? (
        (selectedStartUpstreamNodeId === 'auto'
          ? (imageInputs > 0 ? 1 : 0)
          : (selectedStartImageInputs > 0 ? 1 : 0)
        ) + (
          selectedEndUpstreamNodeId === 'none'
            ? 0
            : (selectedEndImageInputs > 0 ? 1 : 0)
        )
      )
      : selectedUpstreamImageInputs
  const effectiveSeedanceImageInputs = refSource === 'upload'
    ? uploadedImageInputs
    : refSource === 'mixed'
      ? uploadedImageInputs + selectedSeedanceUpstreamImageInputs
      : selectedSeedanceUpstreamImageInputs
  const hasPromptInData = typeof node.data?.prompt === 'string' && node.data.prompt.trim().length > 0
  const hasTextInData = typeof node.data?.text === 'string' && node.data.text.trim().length > 0

  if (node.type === 'prompt') {
    if (!hasTextInData && !hasPromptInData) {
      issues.push({
        code: 'prompt_missing_text',
        message: `Prompt node "${node.id}" must include text in node.data.text`,
        nodeId: node.id,
      })
    }
    return
  }

  if (node.type === 'image.generate') {
    if (videoInputs > 0) {
      issues.push({
        code: 'image_video_input_unsupported',
        message: `Node "${node.id}" does not accept video inputs`,
        nodeId: node.id,
      })
    }
    if (effectiveImageInputs > 8) {
      issues.push({
        code: 'image_ref_limit',
        message: `Node "${node.id}" accepts at most 8 image references`,
        nodeId: node.id,
      })
    }
    if (!hasPromptInData) {
      issues.push({
        code: 'image_prompt_required',
        message: `Node "${node.id}" must contain node.data.prompt`,
        nodeId: node.id,
      })
    }
    return
  }

  if (node.type === 'video.generate') {
    if (videoInputs > 0) {
      issues.push({
        code: 'video_video_input_unsupported',
        message: `Node "${node.id}" does not accept video inputs in V1`,
        nodeId: node.id,
      })
    }

    if (model === 'seedance-1.5-pro') {
      const effectiveMode = mode || (effectiveSeedanceImageInputs > 0 ? 'i2v' : 't2v')
      if (effectiveMode === 't2v' && effectiveImageInputs !== 0) {
        issues.push({
          code: 'seedance_t2v_images',
          message: `Seedance t2v node "${node.id}" cannot have image inputs`,
          nodeId: node.id,
        })
      }
      if (effectiveMode === 'i2v' && (effectiveSeedanceImageInputs < 1 || effectiveSeedanceImageInputs > 2)) {
        issues.push({
          code: 'seedance_i2v_inputs',
          message: `Seedance i2v node "${node.id}" requires 1..2 image inputs`,
          nodeId: node.id,
        })
      }
    } else if (model === 'kling-i2v' && effectiveImageInputs !== 1) {
      issues.push({
        code: 'kling_i2v_inputs',
        message: `Kling i2v node "${node.id}" requires exactly 1 image input`,
        nodeId: node.id,
      })
    } else if (model === 'kling-t2v' && effectiveImageInputs !== 0) {
      issues.push({
        code: 'kling_t2v_inputs',
        message: `Kling t2v node "${node.id}" cannot have image inputs`,
        nodeId: node.id,
      })
    }

    if (!hasPromptInData) {
      issues.push({
        code: 'video_prompt_required',
        message: `Node "${node.id}" must contain node.data.prompt`,
        nodeId: node.id,
      })
    }
  }
}

export function validateWorkflowGraph(graph: WorkflowGraph): { ok: boolean; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = []

  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return {
      ok: false,
      errors: [{ code: 'invalid_graph', message: 'Graph must contain nodes[] and edges[]' }],
    }
  }

  const bytes = Buffer.byteLength(JSON.stringify(graph), 'utf8')
  if (bytes > MAX_GRAPH_BYTES) {
    errors.push({
      code: 'graph_too_large',
      message: `Graph payload is too large (${bytes} bytes). Max ${MAX_GRAPH_BYTES}`,
    })
  }

  if (graph.nodes.length > MAX_NODES) {
    errors.push({
      code: 'too_many_nodes',
      message: `Too many nodes (${graph.nodes.length}). Max ${MAX_NODES}`,
    })
  }
  if (graph.edges.length > MAX_EDGES) {
    errors.push({
      code: 'too_many_edges',
      message: `Too many edges (${graph.edges.length}). Max ${MAX_EDGES}`,
    })
  }

  const nodesById = new Map<string, WorkflowNode>()
  for (const node of graph.nodes) {
    if (!node.id || typeof node.id !== 'string') {
      errors.push({ code: 'node_id_invalid', message: 'Every node must have string id' })
      continue
    }
    if (nodesById.has(node.id)) {
      errors.push({ code: 'duplicate_node_id', message: `Duplicate node id "${node.id}"`, nodeId: node.id })
      continue
    }
    if (!NODE_TYPES.has(node.type)) {
      errors.push({
        code: 'unsupported_node_type',
        message: `Node "${node.id}" has unsupported type "${node.type}"`,
        nodeId: node.id,
      })
      continue
    }
    nodesById.set(node.id, node)
  }

  const incomingByNode = new Map<string, WorkflowEdge[]>()
  for (const node of nodesById.values()) incomingByNode.set(node.id, [])

  for (const edge of graph.edges) {
    if (!nodesById.has(edge.source)) {
      errors.push({
        code: 'edge_source_missing',
        message: `Edge "${edge.id}" source "${edge.source}" does not exist`,
        edgeId: edge.id,
      })
      continue
    }
    if (!nodesById.has(edge.target)) {
      errors.push({
        code: 'edge_target_missing',
        message: `Edge "${edge.id}" target "${edge.target}" does not exist`,
        edgeId: edge.id,
      })
      continue
    }

    const sourceNode = nodesById.get(edge.source)!
    const targetNode = nodesById.get(edge.target)!
    const expected = handleExpects(getTargetHandle(edge))
    const actual = getOutputKind(sourceNode)

    if (expected === 'any') {
      const allowedByTarget: Record<WorkflowNode['type'], Array<'prompt' | 'image' | 'video'>> = {
        prompt: ['prompt'],
        'image.generate': ['prompt', 'image'],
        'video.generate': ['prompt', 'image'],
        'video.concat': ['video'],
      }
      const allowed = allowedByTarget[targetNode.type] || ['prompt', 'image']
      if (!allowed.includes(actual)) {
        errors.push({
          code: 'edge_type_mismatch',
          message: `Edge "${edge.id}" type mismatch: target "${targetNode.type}" does not accept "${actual}"`,
          edgeId: edge.id,
        })
        continue
      }
    } else if (expected !== actual) {
      errors.push({
        code: 'edge_type_mismatch',
        message: `Edge "${edge.id}" type mismatch: expected "${expected}" got "${actual}"`,
        edgeId: edge.id,
      })
      continue
    }

    incomingByNode.get(edge.target)!.push(edge)
  }

  if (detectCycle(graph)) {
    errors.push({ code: 'graph_cycle', message: 'Graph must be acyclic (DAG)' })
  }

  for (const node of nodesById.values()) {
    validateNodeCardinality(node, incomingByNode.get(node.id) || [], nodesById, errors)
  }

  return { ok: errors.length === 0, errors }
}
