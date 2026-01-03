import { Router } from 'express'
import { webhook, setupCommands, setupMenuButton, setupWebhook, sendPhoto, sendDocument, proxyDownload, proxyDownloadHead, logDownload, sendRemixShare, sendWithPrompt } from '../controllers/telegramController.js'

const router = Router()

router.post('/webhook', webhook)
router.post('/setup', setupCommands)
router.post('/menu', setupMenuButton)
router.post('/webhook/setup', setupWebhook)
router.post('/sendPhoto', sendPhoto)
router.post('/sendDocument', sendDocument)
router.post('/sendRemixShare', sendRemixShare)
router.post('/sendWithPrompt', sendWithPrompt)
router.get('/download', proxyDownload)
router.head('/download', proxyDownloadHead)
router.post('/log/download', logDownload)

export default router

