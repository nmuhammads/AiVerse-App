import { Router } from 'express'
import { getAvatar, uploadAvatar, getUserInfo, subscribeBot, listGenerations } from '../controllers/userController.js'

const router = Router()
router.get('/avatar/:userId', getAvatar)
router.post('/avatar/upload', uploadAvatar)
router.get('/info/:userId', getUserInfo)
router.post('/subscribe', subscribeBot)
router.get('/generations', listGenerations)
export default router
