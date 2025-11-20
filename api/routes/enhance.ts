import { Router } from 'express'
import { handleEnhancePrompt } from '../controllers/enhanceController.js'

const router = Router()
router.post('/', handleEnhancePrompt)
export default router
