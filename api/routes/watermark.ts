import { Router } from 'express'
import { getWatermark, saveWatermark, deleteWatermark, generateWatermark } from '../controllers/watermarkController.js'

const router = Router()

router.get('/', getWatermark)
router.post('/generate', generateWatermark)
router.post('/', saveWatermark)
router.delete('/', deleteWatermark)

export default router
