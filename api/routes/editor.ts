import { Router } from 'express'
import { handleImageEdit } from '../controllers/runpodController.js'
import { handleRemoveBackground } from '../controllers/generationController.js'

const router = Router()

router.post('/edit', handleImageEdit)
router.post('/remove-background', handleRemoveBackground)

export default router
