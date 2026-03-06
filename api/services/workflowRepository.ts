import { supaDelete, supaPatch, supaPost, supaSelect } from './supabaseService.js'
import type { WorkflowGraph, WorkflowRunRecord, WorkflowRunStatus, WorkflowTemplateRecord } from '../types/workflow.js'

const WORKFLOW_SCHEMA = String(process.env.WORKFLOW_SCHEMA || 'workflow').trim() || 'workflow'
const WORKFLOW_SCHEMA_FALLBACK = WORKFLOW_SCHEMA === 'public' ? null : 'public'

type SupaResultLike = { ok: boolean; data?: unknown }

function shouldFallbackToPublic(result: SupaResultLike) {
  if (result.ok || !WORKFLOW_SCHEMA_FALLBACK) return false
  const payload = (result.data || {}) as { code?: string; message?: string; details?: string }
  const code = String(payload.code || '')
  const message = String(payload.message || '').toLowerCase()
  const details = String(payload.details || '').toLowerCase()
  return (
    code === 'PGRST106'
    || code === '42P01'
    || message.includes('schema must be one of')
    || message.includes('relation') && message.includes('does not exist')
    || details.includes('schema must be one of')
  )
}

function logWorkflowRepoError(context: string, result: SupaResultLike) {
  if (result.ok) return
  console.error(`[WorkflowRepo] ${context} failed`, result.data || null)
}

async function withWorkflowSchemaFallback<T extends SupaResultLike>(
  context: string,
  call: (schema: string) => Promise<T>
): Promise<T> {
  const primary = await call(WORKFLOW_SCHEMA)
  if (!shouldFallbackToPublic(primary)) return primary

  console.warn(
    `[WorkflowRepo] ${context}: schema "${WORKFLOW_SCHEMA}" unavailable, retrying with "${WORKFLOW_SCHEMA_FALLBACK}"`
  )
  return call(WORKFLOW_SCHEMA_FALLBACK as string)
}

async function workflowSelect(table: string, query: string) {
  const result = await withWorkflowSchemaFallback(
    `select ${table}`,
    (schema) => supaSelect(table, query, schema)
  )
  logWorkflowRepoError(`select ${table}`, result)
  return result
}

async function workflowPost(table: string, body: unknown, params = '') {
  const result = await withWorkflowSchemaFallback(
    `post ${table}`,
    (schema) => supaPost(table, body, params, schema)
  )
  logWorkflowRepoError(`post ${table}`, result)
  return result
}

async function workflowPatch(
  table: string,
  filter: string,
  body: unknown,
  preferReturnRepresentation = false
) {
  const result = await withWorkflowSchemaFallback(
    `patch ${table}`,
    (schema) => supaPatch(table, filter, body, preferReturnRepresentation, schema)
  )
  logWorkflowRepoError(`patch ${table}`, result)
  return result
}

async function workflowDelete(table: string, filter: string) {
  const primary = await supaDelete(table, filter, WORKFLOW_SCHEMA)
  if (primary.ok || !WORKFLOW_SCHEMA_FALLBACK) return primary

  console.warn(
    `[WorkflowRepo] delete ${table}: schema "${WORKFLOW_SCHEMA}" failed, retrying with "${WORKFLOW_SCHEMA_FALLBACK}"`
  )
  return supaDelete(table, filter, WORKFLOW_SCHEMA_FALLBACK)
}

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
  const result = await workflowPost(
    'workflow_templates',
    {
      user_id: params.userId,
      name: params.name,
      description: params.description ?? null,
      graph: params.graph,
    },
    '?select=*'
  )

  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
    return null
  }
  return asTemplate(result.data[0])
}

export async function listWorkflowTemplates(userId: number) {
  const result = await workflowSelect(
    'workflow_templates',
    `?user_id=eq.${userId}&is_archived=eq.false&order=updated_at.desc`
  )
  if (!result.ok || !Array.isArray(result.data)) return []
  return result.data.map(asTemplate)
}

export async function getWorkflowTemplateById(id: number, userId: number) {
  const result = await workflowSelect(
    'workflow_templates',
    `?id=eq.${id}&user_id=eq.${userId}&is_archived=eq.false&select=*`
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

  const updated = await workflowPatch(
    'workflow_templates',
    `?id=eq.${id}&user_id=eq.${userId}`,
    body,
    true
  )
  if (!updated.ok || !Array.isArray(updated.data) || updated.data.length === 0) return null
  return asTemplate(updated.data[0])
}

export async function archiveWorkflowTemplate(id: number, userId: number) {
  const updated = await workflowPatch(
    'workflow_templates',
    `?id=eq.${id}&user_id=eq.${userId}`,
    { is_archived: true },
    false
  )
  return updated.ok
}

export async function createWorkflowRun(params: {
  workflowId: number
  userId: number
  status?: WorkflowRunStatus
}) {
  const result = await workflowPost(
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
    '?select=*'
  )
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return null
  return asRun(result.data[0])
}

export async function getWorkflowRunById(runId: number, userId: number) {
  const result = await workflowSelect(
    'workflow_runs',
    `?id=eq.${runId}&user_id=eq.${userId}&select=*`
  )
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return null
  return asRun(result.data[0])
}

export async function getWorkflowRunByIdInternal(runId: number) {
  const result = await workflowSelect(
    'workflow_runs',
    `?id=eq.${runId}&select=*`
  )
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return null
  return asRun(result.data[0])
}

export async function listWorkflowRuns(userId: number, workflowId?: number) {
  const wfFilter = workflowId ? `&workflow_id=eq.${workflowId}` : ''
  const result = await workflowSelect(
    'workflow_runs',
    `?user_id=eq.${userId}${wfFilter}&order=created_at.desc&select=*`
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

  const result = await workflowPatch(
    'workflow_runs',
    `?id=eq.${runId}`,
    body,
    true
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
  const select = await workflowSelect(
    'workflow_runs',
    `?status=in.(queued,running)&select=id,error`
  )
  if (!select.ok || !Array.isArray(select.data)) return 0

  let updated = 0
  for (const row of select.data) {
    const nextError = row.error || { message: reason }
    const res = await workflowPatch(
      'workflow_runs',
      `?id=eq.${row.id}&status=in.(queued,running)`,
      {
        status: 'failed',
        error: nextError,
        finished_at: new Date().toISOString(),
      },
      false
    )
    if (res.ok) updated += 1
  }
  return updated
}

export async function hardDeleteWorkflowTemplate(id: number, userId: number) {
  return workflowDelete('workflow_templates', `?id=eq.${id}&user_id=eq.${userId}`)
}
