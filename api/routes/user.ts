import { Router } from 'express'
import { getAvatar, uploadAvatar, getUserInfo, subscribeBot, listGenerations, syncAvatar, togglePublish, getLeaderboard, getRemixRewards, setCover, toggleFollow, checkFollowStatus, getFollowing, getFollowers } from '../controllers/userController.js'
import { updateNotificationSettings } from '../controllers/notificationController.js'

const router = Router()
router.get('/avatar/:userId', getAvatar)
router.post('/sync-avatar', syncAvatar as any)
router.post('/avatar/upload', uploadAvatar)
router.post('/cover/set', setCover)
router.get('/info/:userId', getUserInfo)
router.post('/subscribe', subscribeBot)
router.get('/generations', listGenerations)
router.post('/publish', togglePublish)
router.get('/leaderboard', getLeaderboard)
router.get('/accumulations', getRemixRewards)
router.patch('/notification-settings', updateNotificationSettings)
router.post('/follow', toggleFollow)
router.get('/follow-status/:userId', checkFollowStatus)
router.get('/following/:userId', getFollowing)
router.get('/followers/:userId', getFollowers)
export default router


