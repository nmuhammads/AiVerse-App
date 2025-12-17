import { Router } from 'express'
import { getEventStatus, getActiveEvents, getAllEvents } from '../controllers/eventSettingsController.js'

const router = Router()

// GET /api/events/all - get all events with status
router.get('/all', getAllEvents)

// GET /api/events/active - get all active events
router.get('/active', getActiveEvents)

// GET /api/events/status/:key - get status of specific event
router.get('/status/:key', getEventStatus)

export default router
