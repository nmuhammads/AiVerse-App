import { Router } from 'express'
import { getFeed, publishGeneration, toggleLike } from '../controllers/feedController.js'

const router = Router()

router.get('/', getFeed)
router.post('/publish', publishGeneration)
router.post('/like', toggleLike)

export default router
