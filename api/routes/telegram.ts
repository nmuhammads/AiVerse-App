import { Router } from 'express'
import { webhook, setupCommands } from '../controllers/telegramController.js'

const router = Router()

router.post('/webhook', webhook)
router.post('/setup', setupCommands)

export default router

