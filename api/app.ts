/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
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
import proxyRoutes from './routes/proxy.js'
import editorRoutes from './routes/editor.js'
import watermarkRoutes from './routes/watermark.js'
import promptRoutes from './routes/prompt.js'
import chatRoutes from './routes/chat.js'


// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({
  limit: '50mb',
}))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

/**
 * Request logger middleware (DISABLED - too noisy in production)
 * Uncomment for debugging:
 */
// app.use((req: Request, res: Response, next: NextFunction) => {
//   const start = Date.now()
//   res.on('finish', () => {
//     const duration = Date.now() - start
//     console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`)
//   })
//   next()
// })

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
app.use('/api/proxy', proxyRoutes)
app.use('/api/editor', editorRoutes)
app.use('/api/watermarks', watermarkRoutes)
app.use('/api/prompt', promptRoutes)
app.use('/api/chat', chatRoutes)

// PiAPI Webhook (direct import to avoid circular dependency)
import { handlePiapiWebhook } from './controllers/generationController.js'
app.post('/api/webhook/piapi', handlePiapiWebhook)

/**
 * health
 */
app.use('/api/health', (req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' })
})

/**
 * Serve frontend static files
 */
import path from 'path'
const distPath = path.resolve(process.cwd(), 'dist')
app.use(express.static(distPath))

/**
 * SPA fallback - serve index.html for all non-API routes
 */
app.get('*', (req: Request, res: Response) => {
  // Don't serve index.html for API routes that weren't matched
  if (req.path.startsWith('/api/')) {
    console.log(`[404] API route not found: ${req.method} ${req.path}`)
    return res.status(404).json({
      success: false,
      error: 'API route not found',
      path: req.path
    })
  }
  // Serve index.html for SPA routes
  res.sendFile(path.join(distPath, 'index.html'))
})

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, error.message)
  void next
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

export default app

