import { Router } from 'express'
import { handleGenerateImage, handleCheckPendingGenerations } from '../controllers/generationController'

const router = Router()

// Эндпоинт для генерации изображений
router.post('/generate', handleGenerateImage)
router.post('/check-status', handleCheckPendingGenerations)

export default router