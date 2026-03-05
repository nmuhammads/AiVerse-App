import { Router } from 'express'
import { getPublicAppConfig } from '../controllers/appConfigController.js'

const router = Router()

// GET /api/app-config/public
router.get('/public', getPublicAppConfig)

export default router
