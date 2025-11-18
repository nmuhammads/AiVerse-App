import { Router } from 'express'
import { handleGenerateImage } from '../controllers/generationController'

const router = Router()

// Эндпоинт для генерации изображений
router.post('/generate', handleGenerateImage)

export default router