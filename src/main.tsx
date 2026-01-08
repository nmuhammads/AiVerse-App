import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'

import WebApp from '@twa-dev/sdk'

// Initialize Telegram WebApp
try {
  WebApp.ready();
  WebApp.expand();
  const ver = Number((WebApp as unknown as { version?: string }).version || '0')
  if (WebApp.platform === 'ios' || WebApp.platform === 'android') {
    if (ver >= 8) { try { (WebApp as unknown as { requestFullscreen?: () => void }).requestFullscreen?.() } catch { void 0 } }
  }
  WebApp.setHeaderColor("bg_color");
} catch (e) {
  console.error('Telegram WebApp initialization failed', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
