import {
  appendWorkflowRunGenerationIds,
  getWorkflowRunByIdInternal,
  getWorkflowTemplateById,
  markRunningWorkflowRunsAsFailed,
  updateWorkflowRun,
} from './workflowRepository.js'
import { executeGenerationRequest } from './generationExecutionService.js'
import { validateWorkflowGraph } from './workflowValidationService.js'
import { concatWorkflowVideos } from './workflowVideoConcatService.js'
import { supaSelect } from './supabaseService.js'
import type {
  NodeArtifact,
  WorkflowEdge,
  WorkflowNode,
  WorkflowRunNodeState,
  WorkflowRunRecord,
} from '../types/workflow.js'

const MAX_PARALLEL_NODES = 2
const GENERATION_POLL_INTERVAL_MS = 3000
const GENERATION_POLL_TIMEOUT_MS = 12 * 60 * 1000

function incomingOf(nodeId: string, edges: WorkflowEdge[]) {
  return edges
    .filter((edge) => edge.target === nodeId)
    .sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0))
}

function outgoingOf(nodeId: string, edges: WorkflowEdge[]) {
  return edges.filter((edge) => edge.source === nodeId)
}

function buildPromptForNode(node: WorkflowNode, incomingArtifacts: NodeArtifact[]) {
  if (node.type !== 'prompt') {
    if (typeof node.data?.prompt === 'string' && node.data.prompt.trim()) return node.data.prompt.trim()
  }
  const promptFromInput = incomingArtifacts.find((item) => item.type === 'prompt') as { type: 'prompt'; text: string } | undefined
  if (promptFromInput?.text?.trim()) return promptFromInput.text.trim()
  if (typeof node.data?.prompt === 'string' && node.data.prompt.trim()) return node.data.prompt.trim()
  if (typeof node.data?.text === 'string' && node.data.text.trim()) return node.data.text.trim()
  return ''
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

function getUploadedRefImages(node: WorkflowNode): string[] {
  if (!Array.isArray(node.data?.ref_images)) return []
  return node.data.ref_images
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

type ResolvedIncoming = {
  edge: WorkflowEdge
  artifact: NodeArtifact
  index: number
}

function resolveIncoming(nodeId: string, edges: WorkflowEdge[], artifacts: Record<string, NodeArtifact>): ResolvedIncoming[] {
  return incomingOf(nodeId, edges)
    .map((edge, index) => ({ edge, artifact: artifacts[edge.source], index }))
    .filter((entry) => Boolean(entry.artifact))
}

function targetHandlePriority(handle?: string | null) {
  const h = String(handle || 'default').toLowerCase()
  if (h.includes('start')) return 0
  if (h.includes('end')) return 2
  return 1
}

function collectImageInputs(incoming: ResolvedIncoming[]) {
  const images: string[] = []
  const sourceUsage = new Map<string, number>()

  const ordered = [...incoming].sort((a, b) => {
    const byHandle = targetHandlePriority(a.edge.targetHandle) - targetHandlePriority(b.edge.targetHandle)
    if (byHandle !== 0) return byHandle
    const byOrder = (a.edge.data?.order || 0) - (b.edge.data?.order || 0)
    if (byOrder !== 0) return byOrder
    return a.index - b.index
  })

  for (const item of ordered) {
    const artifact = item.artifact
    if (artifact.type === 'image') {
      const used = sourceUsage.get(item.edge.source) || 0
      const picked = artifact.image_urls[Math.min(used, artifact.image_urls.length - 1)]
      if (picked) {
        images.push(picked)
        sourceUsage.set(item.edge.source, used + 1)
      }
    }
  }
  return images
}

function selectUpstreamInputs(node: WorkflowNode, incoming: ResolvedIncoming[]): ResolvedIncoming[] {
  const selectedId = getSelectedUpstreamNodeId(node)
  if (selectedId === 'all') return incoming
  return incoming.filter((item) => item.edge.source === selectedId)
}

function firstImageFromSource(incoming: ResolvedIncoming[], sourceId: string): string | null {
  const sourceIncoming = incoming.filter((item) => item.edge.source === sourceId)
  if (sourceIncoming.length === 0) return null
  const sourceImages = collectImageInputs(sourceIncoming)
  return sourceImages[0] || null
}

function collectSeedanceFrameInputs(node: WorkflowNode, incoming: ResolvedIncoming[]): string[] {
  const selectedStart = getSelectedStartUpstreamNodeId(node)
  const selectedEnd = getSelectedEndUpstreamNodeId(node)
  const images: string[] = []

  if (selectedStart === 'auto') {
    const ordered = collectImageInputs(incoming)
    if (ordered[0]) images.push(ordered[0])
  } else {
    const startImage = firstImageFromSource(incoming, selectedStart)
    if (startImage) images.push(startImage)
  }

  if (selectedEnd !== 'none') {
    const endImage = firstImageFromSource(incoming, selectedEnd)
    if (endImage) images.push(endImage)
  }

  return images
}

function collectGenerationIds(incoming: ResolvedIncoming[]) {
  const ids: number[] = []
  for (const item of incoming) {
    const artifact = item.artifact
    if (artifact.type === 'image' || artifact.type === 'video') {
      ids.push(...artifact.generation_ids)
    }
  }
  return Array.from(new Set(ids))
}

function collectVideoInputs(incoming: ResolvedIncoming[]) {
  const videos: string[] = []
  const ordered = [...incoming].sort((a, b) => {
    const byOrder = (a.edge.data?.order || 0) - (b.edge.data?.order || 0)
    if (byOrder !== 0) return byOrder
    return a.index - b.index
  })
  for (const item of ordered) {
    if (item.artifact.type === 'video' && item.artifact.video_url) {
      videos.push(item.artifact.video_url)
    }
  }
  return videos
}

function normalizeStatus(status: unknown): string {
  return String(status || '').trim().toLowerCase()
}

async function waitForGenerationCompletion(params: {
  generationId: number
  userId: number
  timeoutMs?: number
}) {
  const timeoutMs = params.timeoutMs ?? GENERATION_POLL_TIMEOUT_MS
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const q = await supaSelect(
      'generations',
      `?id=eq.${params.generationId}&user_id=eq.${params.userId}&select=id,status,image_url,video_url,media_type,error_message`
    )
    if (q.ok && Array.isArray(q.data) && q.data.length > 0) {
      const row = q.data[0]
      const status = normalizeStatus(row.status)
      if (status === 'completed') {
        const mediaType = row.media_type === 'video' || row.video_url ? 'video' : 'image'
        const url = mediaType === 'video'
          ? (row.video_url || row.image_url)
          : (row.image_url || row.video_url)
        if (!url) {
          throw new Error(`Generation ${params.generationId} completed without media URL`)
        }
        return {
          mediaType: mediaType as 'image' | 'video',
          url: String(url),
        }
      }
      if (status === 'failed' || status === 'cancelled') {
        throw new Error(row.error_message || `Generation ${params.generationId} ${status}`)
      }
    }
    await new Promise((resolve) => setTimeout(resolve, GENERATION_POLL_INTERVAL_MS))
  }

  throw new Error(`Generation ${params.generationId} timed out while waiting for completion`)
}

async function executeNode(params: {
  node: WorkflowNode
  run: WorkflowRunRecord
  edges: WorkflowEdge[]
  artifacts: Record<string, NodeArtifact>
}) {
  const { node, run, edges, artifacts } = params
  const incomingResolved = resolveIncoming(node.id, edges, artifacts)
  const incomingArtifacts = incomingResolved.map((entry) => entry.artifact)

  if (node.type === 'prompt') {
    const text = buildPromptForNode(node, incomingArtifacts)
    return {
      artifact: { type: 'prompt', text } as NodeArtifact,
      generationIds: [] as number[],
    }
  }

  const prompt = buildPromptForNode(node, incomingArtifacts)
  const parentGenerationIds = collectGenerationIds(incomingResolved)

  if (node.type === 'video.concat') {
    const inputVideoUrls = collectVideoInputs(incomingResolved)
    if (inputVideoUrls.length < 2) {
      throw new Error('video.concat requires at least 2 input videos')
    }

    const mergedVideoUrl = await concatWorkflowVideos({
      runId: run.id,
      nodeId: node.id,
      videoUrls: inputVideoUrls,
    })

    return {
      artifact: {
        type: 'video',
        video_url: mergedVideoUrl,
        generation_ids: parentGenerationIds,
      } as NodeArtifact,
      generationIds: parentGenerationIds,
    }
  }

  const videoModel = node.type === 'video.generate'
    ? (node.data?.model || 'seedance-1.5-pro').toString()
    : ''
  const videoMode = node.type === 'video.generate'
    ? (node.data?.mode || '').toString()
    : ''
  const upstreamIncoming = selectUpstreamInputs(node, incomingResolved)
  let upstreamImages = collectImageInputs(upstreamIncoming)
  const uploadedImages = getUploadedRefImages(node)
  const effectiveVideoMode = videoMode || ((upstreamImages.length + uploadedImages.length) > 0 ? 'i2v' : 't2v')
  const useExplicitSeedanceFrames = node.type === 'video.generate'
    && videoModel === 'seedance-1.5-pro'
    && effectiveVideoMode === 'i2v'
    && hasExplicitSeedanceFrameSelection(node)

  if (useExplicitSeedanceFrames) {
    upstreamImages = collectSeedanceFrameInputs(node, incomingResolved)
  }

  const refSource = getRefSource(node)
  const inputImages = refSource === 'upload'
    ? uploadedImages
    : refSource === 'mixed'
      ? [...uploadedImages, ...upstreamImages]
      : upstreamImages

  console.log(
    `[WorkflowRun] Node ${node.id} inputs -> images=${inputImages.length} (source=${refSource}, uploaded=${uploadedImages.length}, upstream=${upstreamImages.length}), upstream_generation_ids=${parentGenerationIds.length}`
  )

  if (node.type === 'image.generate') {
    const imageCount = Math.max(1, Math.min(4, Number(node.data?.image_count || 1)))
    const payload: Record<string, unknown> = {
      user_id: run.user_id,
      prompt,
      model: node.data?.model || 'nanobanana-pro',
      aspect_ratio: node.data?.aspect_ratio || '3:4',
      images: inputImages,
      image_count: imageCount,
      parent_id: parentGenerationIds[0] || undefined,
    }

    const response = await executeGenerationRequest(payload)
    if (!response.ok) {
      const message = response.data?.error || `image.generate failed (${response.status})`
      throw new Error(message)
    }

    const generationIds = Array.isArray(response.data?.generation_ids)
      ? response.data.generation_ids.map(Number)
      : []
    const primaryGenerationId = Number(response.data?.primary_generation_id || response.data?.generationId || 0)

    const isPending = normalizeStatus(response.data?.status) === 'pending'
    if (isPending && primaryGenerationId > 0) {
      const settled = await waitForGenerationCompletion({
        generationId: primaryGenerationId,
        userId: run.user_id,
      })
      if (settled.mediaType !== 'image') {
        throw new Error(`image.generate resolved with unexpected media type "${settled.mediaType}"`)
      }
      return {
        artifact: {
          type: 'image',
          image_urls: [settled.url],
          generation_ids: generationIds.length > 0 ? generationIds : [primaryGenerationId],
        } as NodeArtifact,
        generationIds: generationIds.length > 0 ? generationIds : [primaryGenerationId],
      }
    }

    const imageUrls = Array.isArray(response.data?.images)
      ? response.data.images
      : (response.data?.image ? [response.data.image] : [])

    if (imageUrls.length === 0) {
      throw new Error('image.generate returned empty image list')
    }

    return {
      artifact: {
        type: 'image',
        image_urls: imageUrls,
        generation_ids: generationIds,
      } as NodeArtifact,
      generationIds,
    }
  }

  if (node.type === 'video.generate') {
    const model = videoModel || 'seedance-1.5-pro'
    const payload: Record<string, unknown> = {
      user_id: run.user_id,
      prompt,
      model,
      aspect_ratio: node.data?.aspect_ratio || '16:9',
      images: inputImages,
      parent_id: parentGenerationIds[0] || undefined,
    }

    if (model === 'seedance-1.5-pro') {
      payload.video_duration = node.data?.video_duration || '8'
      payload.video_resolution = node.data?.video_resolution || '720p'
      payload.fixed_lens = node.data?.fixed_lens ?? false
      payload.generate_audio = node.data?.generate_audio ?? false
    }
    if (model === 'kling-t2v' || model === 'kling-i2v') {
      payload.kling_duration = node.data?.kling_duration || '5'
      payload.kling_sound = node.data?.kling_sound ?? false
    }

    const response = await executeGenerationRequest(payload)
    if (!response.ok) {
      const message = response.data?.error || `video.generate failed (${response.status})`
      throw new Error(message)
    }

    const generationIds = Array.isArray(response.data?.generation_ids)
      ? response.data.generation_ids.map(Number)
      : []
    const primaryGenerationId = Number(response.data?.primary_generation_id || response.data?.generationId || 0)

    const isPending = normalizeStatus(response.data?.status) === 'pending'
    if (isPending && primaryGenerationId > 0) {
      const settled = await waitForGenerationCompletion({
        generationId: primaryGenerationId,
        userId: run.user_id,
      })
      if (settled.mediaType !== 'video') {
        throw new Error(`video.generate resolved with unexpected media type "${settled.mediaType}"`)
      }
      return {
        artifact: {
          type: 'video',
          video_url: settled.url,
          generation_ids: generationIds.length > 0 ? generationIds : [primaryGenerationId],
        } as NodeArtifact,
        generationIds: generationIds.length > 0 ? generationIds : [primaryGenerationId],
      }
    }

    const videoUrl = response.data?.image || response.data?.images?.[0]

    if (!videoUrl) {
      throw new Error('video.generate returned empty video url')
    }

    return {
      artifact: {
        type: 'video',
        video_url: String(videoUrl),
        generation_ids: generationIds,
      } as NodeArtifact,
      generationIds,
    }
  }

  throw new Error(`Unsupported node type: ${node.type}`)
}

function allDepsCompleted(nodeId: string, edges: WorkflowEdge[], states: Record<string, WorkflowRunNodeState>) {
  const deps = incomingOf(nodeId, edges).map((edge) => edge.source)
  return deps.every((depId) => states[depId]?.status === 'completed')
}

export async function executeWorkflowRun(runId: number): Promise<void> {
  const run = await getWorkflowRunByIdInternal(runId)
  if (!run) return

  const template = await getWorkflowTemplateById(run.workflow_id, run.user_id)
  if (!template) {
    await updateWorkflowRun(runId, {
      status: 'failed',
      error: { message: 'Workflow template not found' },
      finished_at: new Date().toISOString(),
    })
    return
  }

  const validation = validateWorkflowGraph(template.graph)
  if (!validation.ok) {
    await updateWorkflowRun(runId, {
      status: 'failed',
      error: { message: validation.errors[0]?.message || 'Workflow validation failed' },
      finished_at: new Date().toISOString(),
    })
    return
  }

  const nodeStates: Record<string, WorkflowRunNodeState> = {}
  const artifacts: Record<string, NodeArtifact> = {}
  const pending = new Set(template.graph.nodes.map((n) => n.id))
  const running = new Map<string, Promise<{ nodeId: string; ok: boolean; error?: string }>>()
  const outputs: Record<string, NodeArtifact> = {}

  for (const node of template.graph.nodes) {
    nodeStates[node.id] = { status: 'queued' }
  }

  await updateWorkflowRun(runId, {
    status: 'running',
    started_at: new Date().toISOString(),
    node_states: nodeStates,
    progress: 0,
  })

  let failReason: string | null = null
  const totalNodes = template.graph.nodes.length

  const startNode = (node: WorkflowNode) => {
    nodeStates[node.id] = {
      ...nodeStates[node.id],
      status: 'running',
      started_at: new Date().toISOString(),
      error: null,
    }

    const task = executeNode({
      node,
      run,
      edges: template.graph.edges,
      artifacts,
    })
      .then(async ({ artifact, generationIds }) => {
        artifacts[node.id] = artifact
        nodeStates[node.id] = {
          ...nodeStates[node.id],
          status: 'completed',
          finished_at: new Date().toISOString(),
          output: artifact,
          generation_ids: generationIds,
          error: null,
        }
        await appendWorkflowRunGenerationIds(runId, generationIds)
        return { nodeId: node.id, ok: true as const }
      })
      .catch((error) => {
        nodeStates[node.id] = {
          ...nodeStates[node.id],
          status: 'failed',
          finished_at: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Node execution failed',
        }
        return {
          nodeId: node.id,
          ok: false as const,
          error: error instanceof Error ? error.message : 'Node execution failed',
        }
      })

    running.set(node.id, task)
  }

  while (pending.size > 0 || running.size > 0) {
    if (!failReason) {
      const readyNodes = [...pending]
        .map((nodeId) => template.graph.nodes.find((n) => n.id === nodeId)!)
        .filter((node) => allDepsCompleted(node.id, template.graph.edges, nodeStates))

      while (readyNodes.length > 0 && running.size < MAX_PARALLEL_NODES) {
        const node = readyNodes.shift()!
        pending.delete(node.id)
        startNode(node)
        await updateWorkflowRun(runId, {
          current_node_id: node.id,
          node_states: nodeStates,
        })
      }

      if (running.size === 0 && pending.size > 0) {
        failReason = 'No executable nodes available. Check workflow dependencies.'
      }
    }

    if (running.size === 0) break

    const result = await Promise.race(running.values())
    running.delete(result.nodeId)

    const completedCount = Object.values(nodeStates).filter((s) => s.status === 'completed').length
    const progress = Number(((completedCount / totalNodes) * 100).toFixed(2))
    await updateWorkflowRun(runId, {
      node_states: nodeStates,
      progress,
      current_node_id: result.ok ? null : result.nodeId,
    })

    if (!result.ok && !failReason) {
      failReason = result.error || `Node ${result.nodeId} failed`
    }
  }

  if (failReason) {
    for (const nodeId of pending) {
      nodeStates[nodeId] = {
        ...nodeStates[nodeId],
        status: 'skipped',
        finished_at: new Date().toISOString(),
      }
    }

    await updateWorkflowRun(runId, {
      status: 'failed',
      progress: Number(
        (
          (Object.values(nodeStates).filter((s) => s.status === 'completed').length / totalNodes) *
          100
        ).toFixed(2)
      ),
      node_states: nodeStates,
      error: { message: failReason },
      finished_at: new Date().toISOString(),
      current_node_id: null,
    })
    return
  }

  for (const node of template.graph.nodes) {
    if (outgoingOf(node.id, template.graph.edges).length === 0 && artifacts[node.id]) {
      outputs[node.id] = artifacts[node.id]
    }
  }

  await updateWorkflowRun(runId, {
    status: 'completed',
    progress: 100,
    node_states: nodeStates,
    outputs,
    finished_at: new Date().toISOString(),
    current_node_id: null,
    error: null,
  })
}

export async function markStaleWorkflowRunsAsFailed() {
  return markRunningWorkflowRunsAsFailed('worker_restart')
}
