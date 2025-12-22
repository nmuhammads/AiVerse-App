import { Router } from 'express'
import {
    getNotifications,
    getAppNews,
    getUnreadCount,
    markAllRead,
    updateNotificationSettings,
    cleanupOldNotifications
} from '../controllers/notificationController.js'

const router = Router()

router.get('/', getNotifications)
router.get('/count', getUnreadCount)
router.post('/read-all', markAllRead)
router.post('/cleanup', cleanupOldNotifications)

export default router
