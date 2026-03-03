import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import {
  createWorkflow,
  getWorkflowById,
  getWorkflowRun,
  getWorkflowRuns,
  getWorkflows,
  patchWorkflow,
  removeWorkflow,
  startWorkflowRun,
} from '../controllers/workflowController.js'

const router = Router()

router.post('/', requireAuth as any, createWorkflow)
router.get('/', requireAuth as any, getWorkflows)
router.get('/runs/:runId', requireAuth as any, getWorkflowRun)
router.get('/runs', requireAuth as any, getWorkflowRuns)
router.get('/:id', requireAuth as any, getWorkflowById)
router.patch('/:id', requireAuth as any, patchWorkflow)
router.delete('/:id', requireAuth as any, removeWorkflow)
router.post('/:id/runs', requireAuth as any, startWorkflowRun)

export default router
