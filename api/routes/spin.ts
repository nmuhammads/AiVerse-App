import { Router } from 'express'
import { handleSpin } from '../controllers/spinController.js'

const router = Router()

router.post('/', handleSpin)

export default router
