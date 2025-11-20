import { Router } from 'express'
import { webhook, setupCommands, setupMenuButton, setupWebhook, sendPhoto } from '../controllers/telegramController.js'

const router = Router()

router.post('/webhook', webhook)
router.post('/setup', setupCommands)
router.post('/menu', setupMenuButton)
router.post('/webhook/setup', setupWebhook)
router.post('/sendPhoto', sendPhoto)

export default router

