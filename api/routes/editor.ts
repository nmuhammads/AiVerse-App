import { Router } from 'express'
import { handleImageEdit } from '../controllers/runpodController.js'
import { handleRemoveBackground, handleUpscale } from '../controllers/generationController.js'

const router = Router()

router.post('/edit', handleImageEdit)
router.post('/remove-background', handleRemoveBackground)
router.post('/upscale', handleUpscale)

export default router
