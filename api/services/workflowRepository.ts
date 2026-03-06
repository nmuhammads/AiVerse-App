import { supaDelete, supaPatch, supaPost, supaSelect } from './supabaseService.js'
import type { WorkflowGraph, WorkflowRunRecord, WorkflowRunStatus, WorkflowTemplateRecord } from '../types/workflow.js'

const WORKFLOW_SCHEMA = 'workflow'

function asTemplate(row: any): WorkflowTemplateRecord {
  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    name: String(row.name || ''),
    description: row.description ?? null,
    graph: row.graph as WorkflowGraph,
    is_archived: Boolean(row.is_archived),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function asRun(row: any): WorkflowRunRecord {
  return {
    id: Number(row.id),
    workflow_id: Number(row.workflow_id),
    user_id: Number(row.user_id),
    status: row.status as WorkflowRunStatus,
    current_node_id: row.current_node_id ?? null,
    progress: Number(row.progress || 0),
    node_states: (row.node_states || {}) as WorkflowRunRecord['node_states'],
    generation_ids: Array.isArray(row.generation_ids) ? row.generation_ids.map(Number) : [],
    outputs: (row.outputs || {}) as WorkflowRunRecord['outputs'],
    error: row.error ?? null,
    started_at: row.started_at ?? null,
    finished_at: row.finished_at ?? null,
    created_at: String(row.created_at),
  }
}

export async function createWorkflowTemplate(params: {
  userId: number
  name: string
  description?: string | null
  graph: WorkflowGraph
}) {
  const result = await supaPost(
    'workflow_templates',
    {
      user_id: params.userId,
      name: params.name,
      description: params.description ?? null,
      graph: params.graph,
    },
    '',
    WORKFLOW_SCHEMA
  )

  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
    return null
  }
  return asTemplate(result.data[0])
}

export async function listWorkflowTemplates(userId: number) {
  const result = await supaSelect(
    'workflow_templates',
    `?user_id=eq.${userId}&is_archived=eq.false&order=updated_at.desc`,
    WORKFLOW_SCHEMA
  )
  if (!result.ok || !Array.isArray(result.data)) return []
  return result.data.map(asTemplate)
}

export async function getWorkflowTemplateById(id: number, userId: number) {
  const result = await supaSelect(
    'workflow_templates',
    `?id=eq.${id}&user_id=eq.${userId}&is_archived=eq.false&select=*`,
    WORKFLOW_SCHEMA
  )
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return null
  return asTemplate(result.data[0])
}

export async function updateWorkflowTemplate(
  id: number,
  userId: number,
  patch: Partial<Pick<WorkflowTemplateRecord, 'name' | 'description' | 'graph'>>
) {
  const body: Record<string, unknown> = {}
  if (typeof patch.name === 'string') body.name = patch.name
  if (Object.prototype.hasOwnProperty.call(patch, 'description')) body.description = patch.description ?? null
  if (patch.graph) body.graph = patch.graph

  const updated = await supaPatch(
    'workflow_templates',
    `?id=eq.${id}&user_id=eq.${userId}`,
    body,
    true,
    WORKFLOW_SCHEMA
  )
  if (!updated.ok || !Array.isArray(updated.data) || updated.data.length === 0) return null
  return asTemplate(updated.data[0])
}

export async function archiveWorkflowTemplate(id: number, userId: number) {
  const updated = await supaPatch(
    'workflow_templates',
    `?id=eq.${id}&user_id=eq.${userId}`,
    { is_archived: true },
    false,
    WORKFLOW_SCHEMA
  )
  return updated.ok
}

export async function createWorkflowRun(params: {
  workflowId: number
  userId: number
  status?: WorkflowRunStatus
}) {
  const result = await supaPost(
    'workflow_runs',
    {
      workflow_id: params.workflowId,
      user_id: params.userId,
      status: params.status || 'queued',
      progress: 0,
      node_states: {},
      generation_ids: [],
      outputs: {},
    },
    '',
    WORKFLOW_SCHEMA
  )
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return null
  return asRun(result.data[0])
}

export async function getWorkflowRunById(runId: number, userId: number) {
  const result = await supaSelect(
    'workflow_runs',
    `?id=eq.${runId}&user_id=eq.${userId}&select=*`,
    WORKFLOW_SCHEMA
  )
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return null
  return asRun(result.data[0])
}

export async function getWorkflowRunByIdInternal(runId: number) {
  const result = await supaSelect(
    'workflow_runs',
    `?id=eq.${runId}&select=*`,
    WORKFLOW_SCHEMA
  )
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return null
  return asRun(result.data[0])
}

export async function listWorkflowRuns(userId: number, workflowId?: number) {
  const wfFilter = workflowId ? `&workflow_id=eq.${workflowId}` : ''
  const result = await supaSelect(
    'workflow_runs',
    `?user_id=eq.${userId}${wfFilter}&order=created_at.desc&select=*`,
    WORKFLOW_SCHEMA
  )
  if (!result.ok || !Array.isArray(result.data)) return []
  return result.data.map(asRun)
}

export async function updateWorkflowRun(runId: number, patch: Partial<WorkflowRunRecord>) {
  const body: Record<string, unknown> = {}
  if (patch.status) body.status = patch.status
  if (Object.prototype.hasOwnProperty.call(patch, 'current_node_id')) body.current_node_id = patch.current_node_id ?? null
  if (typeof patch.progress === 'number') body.progress = patch.progress
  if (patch.node_states) body.node_states = patch.node_states
  if (patch.outputs) body.outputs = patch.outputs
  if (patch.error !== undefined) body.error = patch.error
  if (patch.started_at !== undefined) body.started_at = patch.started_at
  if (patch.finished_at !== undefined) body.finished_at = patch.finished_at
  if (patch.generation_ids) body.generation_ids = patch.generation_ids

  const result = await supaPatch(
    'workflow_runs',
    `?id=eq.${runId}`,
    body,
    true,
    WORKFLOW_SCHEMA
  )
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return null
  return asRun(result.data[0])
}

export async function appendWorkflowRunGenerationIds(runId: number, generationIds: number[]) {
  if (generationIds.length === 0) return getWorkflowRunByIdInternal(runId)

  const run = await getWorkflowRunByIdInternal(runId)
  if (!run) return null
  const merged = Array.from(new Set([...(run.generation_ids || []), ...generationIds]))
  return updateWorkflowRun(runId, { generation_ids: merged })
}

export async function markRunningWorkflowRunsAsFailed(reason: string) {
  const select = await supaSelect(
    'workflow_runs',
    `?status=in.(queued,running)&select=id,error`,
    WORKFLOW_SCHEMA
  )
  if (!select.ok || !Array.isArray(select.data)) return 0

  let updated = 0
  for (const row of select.data) {
    const nextError = row.error || { message: reason }
    const res = await supaPatch(
      'workflow_runs',
      `?id=eq.${row.id}&status=in.(queued,running)`,
      {
        status: 'failed',
        error: nextError,
        finished_at: new Date().toISOString(),
      },
      false,
      WORKFLOW_SCHEMA
    )
    if (res.ok) updated += 1
  }
  return updated
}

export async function hardDeleteWorkflowTemplate(id: number, userId: number) {
  return supaDelete('workflow_templates', `?id=eq.${id}&user_id=eq.${userId}`, WORKFLOW_SCHEMA)
}
