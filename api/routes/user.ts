import { Router } from 'express'
import { getAvatar, uploadAvatar, getUserInfo, subscribeBot, listGenerations, syncAvatar, togglePublish, getLeaderboard, getRemixRewards } from '../controllers/userController.js'

const router = Router()
router.get('/avatar/:userId', getAvatar)
router.post('/sync-avatar', syncAvatar as any)
router.post('/avatar/upload', uploadAvatar)
router.get('/info/:userId', getUserInfo)
router.post('/subscribe', subscribeBot)
router.get('/generations', listGenerations)
router.post('/publish', togglePublish)
router.get('/leaderboard', getLeaderboard)
router.get('/accumulations', getRemixRewards)
export default router
