import { Router } from 'express'
import { handleOptimizePrompt, handleDescribeImage } from '../controllers/promptController.js'

const router = Router()

router.post('/optimize', handleOptimizePrompt)
router.post('/describe', handleDescribeImage)

export default router
