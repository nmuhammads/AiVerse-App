import { Router } from 'express'
import { webhook, setupCommands, setupMenuButton, setupWebhook } from '../controllers/telegramController.js'

const router = Router()

router.post('/webhook', webhook)
router.post('/setup', setupCommands)
router.post('/menu', setupMenuButton)
router.post('/webhook/setup', setupWebhook)

export default router

