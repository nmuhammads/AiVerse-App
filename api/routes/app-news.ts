import { Router } from 'express'
import { getAppNews, broadcastNews } from '../controllers/notificationController.js'

const router = Router()

router.get('/', getAppNews)
router.post('/broadcast', broadcastNews)

export default router
