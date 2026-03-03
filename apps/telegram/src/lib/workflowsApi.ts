import type {
  WorkflowRunDTO,
  WorkflowTemplateDTO,
  WorkflowGraph,
} from '@aiverse/shared/types/workflow'
import { getAuthHeaders } from '@/hooks/useTelegram'

const BASE_URL = '/api/workflows'

type JsonRequestInit = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown
  headers?: Record<string, string>
}

async function request<T>(path: string, init: JsonRequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(init.headers as Record<string, string> | undefined),
  }

  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    const message = payload?.error || `Request failed (${res.status})`
    throw new Error(message)
  }
  return payload as T
}

export async function createWorkflowTemplate(input: {
  name: string
  description?: string | null
  graph: WorkflowGraph
}) {
  return request<WorkflowTemplateDTO>('', {
    method: 'POST',
    body: input,
  })
}

export async function listWorkflowTemplates() {
  const data = await request<{ items: WorkflowTemplateDTO[] }>('', {
    method: 'GET',
  })
  return data.items || []
}

export async function getWorkflowTemplate(id: number) {
  return request<WorkflowTemplateDTO>(`/${id}`, { method: 'GET' })
}

export async function patchWorkflowTemplate(
  id: number,
  input: Partial<{ name: string; description: string | null; graph: WorkflowGraph }>
) {
  return request<WorkflowTemplateDTO>(`/${id}`, {
    method: 'PATCH',
    body: input,
  })
}

export async function deleteWorkflowTemplate(id: number) {
  return request<{ ok: boolean }>(`/${id}`, { method: 'DELETE' })
}

export async function startWorkflowRun(workflowId: number) {
  return request<{ run_id: number; status: WorkflowRunDTO['status'] }>(`/${workflowId}/runs`, {
    method: 'POST',
  })
}

export async function getWorkflowRun(runId: number) {
  return request<WorkflowRunDTO>(`/runs/${runId}`, { method: 'GET' })
}

export async function listWorkflowRuns(workflowId?: number) {
  const qs = workflowId ? `?workflow_id=${workflowId}` : ''
  const data = await request<{ items: WorkflowRunDTO[] }>(`/runs${qs}`, {
    method: 'GET',
  })
  return data.items || []
}
