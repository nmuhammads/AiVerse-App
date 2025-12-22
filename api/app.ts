/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import generationRoutes from './routes/generation.js'
import enhanceRoutes from './routes/enhance.js'
import userRoutes from './routes/user.js'
import telegramRoutes from './routes/telegram.js'
import paymentRoutes from './routes/payment.js'
import feedRoutes from './routes/feed.js'
import contestRoutes from './routes/contests.js'
import spinRoutes from './routes/spin.js'
import eventsRoutes from './routes/events.js'
import notificationsRoutes from './routes/notifications.js'
import appNewsRoutes from './routes/app-news.js'


// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({
  limit: '50mb',
}))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/generation', generationRoutes)
app.use('/api/enhance', enhanceRoutes)
app.use('/api/user', userRoutes)
app.use('/api/telegram', telegramRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/feed', feedRoutes)
app.use('/api/contests', contestRoutes)
app.use('/api/spin', spinRoutes)
app.use('/api/events', eventsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/app-news', appNewsRoutes)

/**
 * Serve frontend build
 */
const appRoot = process.cwd()
const clientDistPath = path.resolve(appRoot, 'dist')
const uploadsPath = path.resolve(appRoot, 'uploads')
app.use(express.static(clientDistPath))
app.use('/uploads', express.static(uploadsPath))


/**
 * health
 */
app.use('/api/health', (req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' })
})

// SPA fallback to index.html (after API routes and health)
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(clientDistPath, 'index.html'))
})

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  void next
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */

export default app
