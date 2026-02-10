import { Router } from 'express'
import { getAvatar, uploadAvatar, getUserInfo, subscribeBot, listGenerations, syncAvatar, togglePublish, getLeaderboard, getRemixRewards, setCover, toggleFollow, checkFollowStatus, getFollowing, getFollowers, checkChannelSubscription, claimChannelReward, searchUsers, updateLanguage, setReferral } from '../controllers/userController.js'
import { updateNotificationSettings } from '../controllers/notificationController.js'
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js'

const router = Router()

// Public routes (no auth required)
router.get('/avatar/:userId', getAvatar)
router.get('/info/:userId', optionalAuth as any, getUserInfo)
router.get('/leaderboard', getLeaderboard)
router.get('/search', searchUsers)
router.get('/generations', optionalAuth as any, listGenerations)
router.get('/following/:userId', getFollowing)
router.get('/followers/:userId', getFollowers)
router.get('/channel-subscription/:userId', checkChannelSubscription)

// Protected routes (require auth)
router.post('/sync-avatar', requireAuth as any, syncAvatar as any)
router.post('/avatar/upload', requireAuth as any, uploadAvatar)
router.post('/cover/set', requireAuth as any, setCover)
router.post('/subscribe', requireAuth as any, subscribeBot)
router.post('/publish', requireAuth as any, togglePublish)
router.get('/accumulations', requireAuth as any, getRemixRewards)
router.patch('/notification-settings', requireAuth as any, updateNotificationSettings)
router.patch('/language', requireAuth as any, updateLanguage)
router.post('/follow', requireAuth as any, toggleFollow)
router.get('/follow-status/:userId', optionalAuth as any, checkFollowStatus)
router.post('/claim-channel-reward', requireAuth as any, claimChannelReward)
router.post('/set-referral', requireAuth as any, setReferral)

export default router




