import { Router } from 'express'
import { handleGenerateImage, handleCheckPendingGenerations, getGenerationById } from '../controllers/generationController'

const router = Router()

// Эндпоинт для генерации изображений
router.post('/generate', handleGenerateImage)
router.post('/check-status', handleCheckPendingGenerations)
router.get('/:id', getGenerationById)

export default router