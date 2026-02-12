import { Router } from 'express'
import { listAvatars, createAvatar, deleteAvatar } from '../controllers/avatarController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

router.get('/', requireAuth as any, listAvatars)
router.post('/', requireAuth as any, createAvatar)
router.delete('/:id', requireAuth as any, deleteAvatar)

export default router
