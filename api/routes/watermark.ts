import { Router } from 'express'
import { getWatermark, saveWatermark, deleteWatermark, generateWatermark, uploadWatermark, removeBackground } from '../controllers/watermarkController.js'

const router = Router()

router.get('/', getWatermark)
router.post('/generate', generateWatermark)
router.post('/upload', uploadWatermark)
router.post('/remove-background', removeBackground)
router.post('/', saveWatermark)
router.delete('/', deleteWatermark)

export default router

