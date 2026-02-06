import WebApp from '@twa-dev/sdk'

/** Whether running inside Telegram Mini App */
export const isInTelegramApp = !!(WebApp.initData && WebApp.initDataUnsafe?.user)

/**
 * Resolved platform: uses Telegram SDK when in Telegram,
 * falls back to user-agent detection for web/PWA.
 */
export const resolvedPlatform: string = (() => {
  if (isInTelegramApp) return WebApp.platform
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
})()

/** Whether running as installed PWA (standalone mode) */
export const isPWA =
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true
