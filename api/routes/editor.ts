import { Router } from 'express'
import { handleImageEdit } from '../controllers/runpodController.js'

const router = Router()

router.post('/edit', handleImageEdit)

export default router
