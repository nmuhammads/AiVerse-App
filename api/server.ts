import 'dotenv/config';
import app from './app.js';

/**
 * start server with port
 */
const PORT = parseInt(process.env.PORT || '3001', 10);

console.log(`Starting server on port ${PORT}...`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('Loaded Env Vars:', Object.keys(process.env).filter(k => !k.startsWith('npm_')));

const r2Configured = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL
console.log('R2 Storage Configured:', r2Configured ? 'Yes' : 'No (Check environment variables)')

import { registerBotCommands, setupMenuButton, setupWebhook, logBotInfo } from './controllers/telegramController.js';

// Initialize Telegram bot with retry logic
async function initTelegramBot(retries = 3, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[TelegramInit] Attempt ${attempt}/${retries}...`);
      await registerBotCommands();
      await setupWebhook();
      await setupMenuButton();
      await logBotInfo();
      console.log('[TelegramInit] Successfully initialized Telegram bot');
      return;
    } catch (error) {
      console.error(`[TelegramInit] Attempt ${attempt}/${retries} failed:`, (error as Error).message);
      if (attempt < retries) {
        console.log(`[TelegramInit] Retrying in ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error('[TelegramInit] All attempts failed. Server will continue without Telegram bot initialization.');
        console.error('[TelegramInit] Webhook and commands may not be configured properly.');
      }
    }
  }
}

// Run initialization in background (non-blocking)
initTelegramBot().catch(err => {
  console.error('[TelegramInit] Unhandled error:', err);
});
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`Health check available at: http://0.0.0.0:${PORT}/api/health`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;