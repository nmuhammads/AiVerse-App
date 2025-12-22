import { Router } from 'express'
import { getAppNews, broadcastNews, markAllNewsRead } from '../controllers/notificationController.js'

const router = Router()

router.get('/', getAppNews)
router.post('/broadcast', broadcastNews)
router.post('/read-all', markAllNewsRead)

export default router
