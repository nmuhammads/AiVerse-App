import { Router } from 'express'
import { handleGenerateImage, handleCheckPendingGenerations, getGenerationById, deleteGeneration } from '../controllers/generationController'

const router = Router()

// Эндпоинт для генерации изображений
router.post('/generate', handleGenerateImage)
router.post('/check-status', handleCheckPendingGenerations)
router.get('/:id', getGenerationById)
router.delete('/:id', deleteGeneration)

export default router