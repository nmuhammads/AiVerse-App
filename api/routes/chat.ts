/**
 * AI Chat Routes
 */

import { Router } from 'express'
import { handleChat, getAvailableModels, getImageModels, handleGenerateImage, handleUploadImage } from '../controllers/chatController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// Public routes (no auth required)
// GET /api/chat/models - получить список моделей чата
router.get('/models', getAvailableModels)

// GET /api/chat/image-models - получить список моделей генерации
router.get('/image-models', getImageModels)

// Protected routes (require authentication)
// POST /api/chat - отправить сообщение AI
router.post('/', requireAuth as any, handleChat)

// POST /api/chat/generate-image - сгенерировать изображение
router.post('/generate-image', requireAuth as any, handleGenerateImage)

// POST /api/chat/upload - загрузить изображение
router.post('/upload', requireAuth as any, handleUploadImage)

export default router

