/**
 * AI Chat Routes
 */

import { Router } from 'express'
import { handleChat, getAvailableModels, getImageModels, handleGenerateImage, handleUploadImage } from '../controllers/chatController.js'

const router = Router()

// POST /api/chat - отправить сообщение AI
router.post('/', handleChat)

// GET /api/chat/models - получить список моделей чата
router.get('/models', getAvailableModels)

// GET /api/chat/image-models - получить список моделей генерации
router.get('/image-models', getImageModels)

// POST /api/chat/generate-image - сгенерировать изображение
router.post('/generate-image', handleGenerateImage)

// POST /api/chat/upload - загрузить изображение
router.post('/upload', handleUploadImage)

export default router

