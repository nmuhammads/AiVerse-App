import { Router } from 'express'
import { createStarsInvoice } from '../controllers/paymentController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()

// Protected route - requires authentication
router.post('/create-stars-invoice', requireAuth as any, createStarsInvoice)

export default router
