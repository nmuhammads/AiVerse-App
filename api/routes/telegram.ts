import { Router } from 'express'
import { webhook, setupCommands, setupMenuButton, setupWebhook, sendPhoto, sendDocument, proxyDownload } from '../controllers/telegramController.js'

const router = Router()

router.post('/webhook', webhook)
router.post('/setup', setupCommands)
router.post('/menu', setupMenuButton)
router.post('/webhook/setup', setupWebhook)
router.post('/sendPhoto', sendPhoto)
router.post('/sendDocument', sendDocument)
router.get('/download', proxyDownload)

export default router

