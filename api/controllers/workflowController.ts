import type { Response } from 'express'
import {
  createWorkflowRun,
  createWorkflowTemplate,
  getWorkflowRunById,
  getWorkflowTemplateById,
  listWorkflowRuns,
  listWorkflowTemplates,
  archiveWorkflowTemplate,
  updateWorkflowTemplate,
} from '../services/workflowRepository.js'
import { executeWorkflowRun } from '../services/workflowExecutorService.js'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js'
import type { WorkflowGraph } from '../types/workflow.js'

function getUserId(req: AuthenticatedRequest): number {
  return Number(req.user?.id || 0)
}

export async function createWorkflow(req: AuthenticatedRequest, res: Response) {
  const userId = getUserId(req)
  const { name, description, graph } = req.body as {
    name?: string
    description?: string | null
    graph?: WorkflowGraph
  }

  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' })
  if (!graph) return res.status(400).json({ error: 'graph is required' })

  const created = await createWorkflowTemplate({
    userId,
    name: name.trim(),
    description: description ?? null,
    graph,
  })
  if (!created) return res.status(500).json({ error: 'Failed to create workflow' })
  return res.status(201).json(created)
}

export async function getWorkflows(req: AuthenticatedRequest, res: Response) {
  const userId = getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const items = await listWorkflowTemplates(userId)
  return res.json({ items })
}

export async function getWorkflowById(req: AuthenticatedRequest, res: Response) {
  const userId = getUserId(req)
  const id = Number(req.params.id)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  if (!id) return res.status(400).json({ error: 'Invalid workflow id' })

  const workflow = await getWorkflowTemplateById(id, userId)
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' })
  return res.json(workflow)
}

export async function patchWorkflow(req: AuthenticatedRequest, res: Response) {
  const userId = getUserId(req)
  const id = Number(req.params.id)
  const { name, description, graph } = req.body as {
    name?: string
    description?: string | null
    graph?: WorkflowGraph
  }

  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  if (!id) return res.status(400).json({ error: 'Invalid workflow id' })

  const updated = await updateWorkflowTemplate(id, userId, {
    name: typeof name === 'string' ? name.trim() : undefined,
    description: description,
    graph,
  })

  if (!updated) return res.status(404).json({ error: 'Workflow not found or update failed' })
  return res.json(updated)
}

export async function removeWorkflow(req: AuthenticatedRequest, res: Response) {
  const userId = getUserId(req)
  const id = Number(req.params.id)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  if (!id) return res.status(400).json({ error: 'Invalid workflow id' })

  const ok = await archiveWorkflowTemplate(id, userId)
  if (!ok) return res.status(404).json({ error: 'Workflow not found or delete failed' })
  return res.json({ ok: true })
}

export async function startWorkflowRun(req: AuthenticatedRequest, res: Response) {
  const userId = getUserId(req)
  const workflowId = Number(req.params.id)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  if (!workflowId) return res.status(400).json({ error: 'Invalid workflow id' })

  const workflow = await getWorkflowTemplateById(workflowId, userId)
  if (!workflow) return res.status(404).json({ error: 'Workflow not found' })

  const run = await createWorkflowRun({
    workflowId,
    userId,
    status: 'queued',
  })
  if (!run) return res.status(500).json({ error: 'Failed to create workflow run' })

  Promise.resolve(executeWorkflowRun(run.id)).catch((error) => {
    console.error(`[WorkflowRun] Unhandled run error (runId=${run.id}):`, error)
  })

  return res.status(202).json({
    run_id: run.id,
    status: run.status,
  })
}

export async function getWorkflowRun(req: AuthenticatedRequest, res: Response) {
  const userId = getUserId(req)
  const runId = Number(req.params.runId)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  if (!runId) return res.status(400).json({ error: 'Invalid run id' })

  const run = await getWorkflowRunById(runId, userId)
  if (!run) return res.status(404).json({ error: 'Workflow run not found' })
  return res.json(run)
}

export async function getWorkflowRuns(req: AuthenticatedRequest, res: Response) {
  const userId = getUserId(req)
  const workflowId = req.query.workflow_id ? Number(req.query.workflow_id) : undefined
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const runs = await listWorkflowRuns(userId, workflowId)
  return res.json({ items: runs })
}
