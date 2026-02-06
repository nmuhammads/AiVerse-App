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
import proxyRoutes from './routes/proxy.js'
import editorRoutes from './routes/editor.js'
import watermarkRoutes from './routes/watermark.js'
import promptRoutes from './routes/prompt.js'
import chatRoutes from './routes/chat.js'
import tributeRoutes from './routes/tribute.js'


// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())

// Capture raw body for Tribute webhook signature verification
// Must be before express.json() so we can access the original bytes
app.use('/api/tribute/webhook', express.raw({ type: 'application/json' }))

app.use(express.json({
  limit: '50mb',
}))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 🔍 Debug logging for auth headers (remove in production)
app.use((req: Request, _res: Response, next: NextFunction) => {
  const isProtectedRoute = ['/api/user/', '/api/payment/', '/api/generation/'].some(p => req.path.startsWith(p))
  if (isProtectedRoute && req.method !== 'GET') {
    const telegramHeader = req.headers['x-telegram-init-data']
    const bearerHeader = req.headers['authorization']
    console.log(`\n🔐 [AUTH DEBUG] ${req.method} ${req.path}`)
    if (telegramHeader) {
      console.log(`   Auth: ✅ Telegram initData (${String(telegramHeader).slice(0, 40)}...)`)
    } else if (bearerHeader) {
      console.log(`   Auth: ✅ Bearer JWT (${String(bearerHeader).slice(7, 47)}...)`)
    } else {
      console.log(`   Auth: ❌ No auth header`)
    }
  }
  next()
})

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
app.use('/api/tribute', tributeRoutes)

// PiAPI Webhook (direct import to avoid circular dependency)
import { handlePiapiWebhook } from './controllers/generationController.js'
app.post('/api/webhook/piapi', handlePiapiWebhook)

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
