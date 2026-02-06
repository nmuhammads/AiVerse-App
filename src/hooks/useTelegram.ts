import { useEffect } from 'react'
import WebApp from '@twa-dev/sdk'
import { useAuthStore } from '@/store/authStore'

/**
 * Get auth headers for API requests
 * Sends Telegram initData for Telegram users, JWT for web users
 */
export function getAuthHeaders(): Record<string, string> {
  // Check for Telegram initData first
  const initData = WebApp.initData
  if (initData && WebApp.initDataUnsafe?.user) {
    return { 'X-Telegram-Init-Data': initData }
  }

  // For web users, use JWT from auth store
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    return { 'Authorization': `Bearer ${accessToken}` }
  }

  return {}
}

export function useTelegram() {
  useEffect(() => {
    const wa = WebApp as unknown as {
      contentSafeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number }
      safeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number }
      platform?: string
      isExpanded?: boolean
      ready: () => void
      expand: () => void
      requestFullscreen?: () => void
      onEvent: (name: string, cb: (data?: unknown) => void) => void
      offEvent: (name: string, cb: (data?: unknown) => void) => void
      MainButton: { hide: () => void; setText: (t: string) => void; onClick: (fn: () => void) => void; offClick: (fn: () => void) => void; show: () => void; showProgress: () => void; hideProgress: () => void; color: string; textColor: string }
      setHeaderColor: (c: string) => void
      setBackgroundColor: (c: string) => void
    }
    wa.ready()

    // PWA install prompt handler for web version
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      ;(window as any).deferredPrompt = e
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    const applySafe = () => {
      const inset = wa.contentSafeAreaInset || wa.safeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 }
      const r = document.documentElement
      r.style.setProperty('--safe-area-top', `${inset.top || 0}px`)
      r.style.setProperty('--safe-area-bottom', `${inset.bottom || 0}px`)
      r.style.setProperty('--safe-area-left', `${inset.left || 0}px`)
      r.style.setProperty('--safe-area-right', `${inset.right || 0}px`)
    }
    applySafe()
    const ensureExpand = () => { try { if (!wa.isExpanded) wa.expand() } catch { void 0 } }
    if (wa.platform === 'ios' || wa.platform === 'android') {
      const ver = Number(((WebApp as unknown as { version?: string }).version) || '0')
      if (ver >= 8) {
        try { if (wa.requestFullscreen) wa.requestFullscreen() } catch { void 0 }
      }
    }
    ensureExpand()
    setTimeout(ensureExpand, 100)
    setTimeout(ensureExpand, 300)
    wa.onEvent('activated', ensureExpand)
    wa.onEvent('viewportChanged', ensureExpand)
    wa.onEvent('safeAreaChanged', applySafe)
    wa.onEvent('contentSafeAreaChanged', applySafe)
    try { wa.onEvent('fileDownloadRequested', (d) => { console.info('fileDownloadRequested', d) }) } catch { /* noop */ }

    // Установка цветовой схемы
    WebApp.setHeaderColor('#1a1a1a')
    WebApp.setBackgroundColor('#1a1a1a')

    WebApp.MainButton.hide()
    WebApp.MainButton.setText('Generate')
    WebApp.MainButton.color = '#8B5CF6'
    WebApp.MainButton.textColor = '#FFFFFF'
    try {
      const uid = (WebApp as unknown as { initDataUnsafe?: { user?: { id?: number } } }).initDataUnsafe?.user?.id
      if (uid) {
        // Get ref from sessionStorage (set by deeplink)
        const storedRef = sessionStorage.getItem('aiverse_ref') || undefined
        const payload = {
          userId: uid,
          botSource: 'AiVerseAppBot',
          username: WebApp.initDataUnsafe.user?.username,
          first_name: WebApp.initDataUnsafe.user?.first_name,
          last_name: WebApp.initDataUnsafe.user?.last_name,
          language_code: WebApp.initDataUnsafe.user?.language_code,
          ref: storedRef
        }
        fetch('/api/user/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(payload) })
          .finally(() => { sessionStorage.removeItem('aiverse_ref') })
      }
    } catch { /* noop */ }

    return () => {
      wa.offEvent('activated', ensureExpand)
      wa.offEvent('viewportChanged', ensureExpand)
      wa.offEvent('safeAreaChanged', applySafe)
      wa.offEvent('contentSafeAreaChanged', applySafe)
      wa.MainButton.hide()
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const showMainButton = (text: string = 'Generate', onClick: () => void) => {
    WebApp.MainButton.setText(text)
    WebApp.MainButton.onClick(onClick)
    WebApp.MainButton.show()
  }

  const hideMainButton = () => {
    WebApp.MainButton.hide()
    // Очищаем все обработчики клика
    WebApp.MainButton.offClick(() => { })
  }

  const showProgress = (text: string = 'Generating...') => {
    WebApp.MainButton.setText(text)
    WebApp.MainButton.showProgress()
  }

  const hideProgress = (text: string = 'Generate') => {
    WebApp.MainButton.hideProgress()
    WebApp.MainButton.setText(text)
  }

  const isInTelegramApp = !!(WebApp.initData && WebApp.initDataUnsafe?.user)

  const shareImage = (imageUrl: string, caption: string) => {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(imageUrl)}&text=${encodeURIComponent(caption)}`
    if (isInTelegramApp) {
      try {
        WebApp.openTelegramLink(shareUrl)
        return
      } catch { /* fallback below */ }
    }
    // Web fallback: use Web Share API if available, otherwise open in new tab
    if (navigator.share) {
      navigator.share({ title: 'AiVerse', text: caption, url: imageUrl }).catch(() => {})
    } else {
      window.open(shareUrl, '_blank')
    }
  }

  const saveToGallery = async (url: string, filename?: string) => {
    const wa = WebApp as any
    const proxyUrl = `/api/telegram/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename || '')}`

    // Telegram Mini App: use native downloadFile API
    if (isInTelegramApp && wa.downloadFile) {
      try {
        const fullUrl = `${window.location.origin}${proxyUrl}`
        wa.HapticFeedback?.impactOccurred?.('medium')
        await wa.downloadFile({ url: fullUrl, file_name: filename || 'file' })
        wa.HapticFeedback?.notificationOccurred?.('success')
        return
      } catch (e) {
        console.error('Telegram download failed:', e)
        // Fall through to web download
      }
    }

    // Web/PWA fallback: fetch blob and trigger browser download
    try {
      const response = await fetch(proxyUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename || 'file'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (e) {
      console.error('Download failed:', e)
      alert('Не удалось сохранить файл. Попробуйте еще раз.')
    }
  }

  const downloadFile = saveToGallery

  const openLink = (url: string) => {
    if (isInTelegramApp) {
      try {
        WebApp.openLink(url)
        return
      } catch { /* fallback below */ }
    }
    window.open(url, '_blank')
  }

  const openBotDeepLink = (param: string) => {
    const u = `https://t.me/AiVerseAppBot?startapp=${encodeURIComponent(param)}`
    if (isInTelegramApp) {
      try {
        WebApp.openTelegramLink(u)
        return
      } catch { /* fallback below */ }
    }
    window.open(u, '_blank')
  }

  const openDeepLink = (param: string) => {
    // Helper to open internal deep links if needed, or just use for generating the param string
    return param
  }

  const addToHomeScreen = (onShowIOSPrompt?: () => void) => {
    const wa = WebApp as any

    // For Telegram Mini App - check API version
    if (isInTelegramApp && wa.addToHomeScreen) {
      const version = Number(((WebApp as unknown as { version?: string }).version) || '0')
      if (version >= 6.9) {
        wa.addToHomeScreen()
        return
      }
    }

    // For Web version or old Telegram versions - use PWA
    // Check if PWA install is available
    const deferredPrompt = (window as any).deferredPrompt
    if (deferredPrompt) {
      deferredPrompt.prompt()
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt')
        }
        (window as any).deferredPrompt = null
      })
    } else {
      // Show instructions based on platform
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
      const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent)

      if (isIOS && isSafari) {
        // For iOS Safari in web version, show custom UI if callback provided
        if (!isInTelegramApp && onShowIOSPrompt) {
          onShowIOSPrompt()
        } else if (isInTelegramApp) {
          wa.showAlert?.('Нажмите кнопку "Поделиться" внизу и выберите "На экран Домой"')
        } else {
          alert('Нажмите кнопку "Поделиться" (внизу) и выберите "На экран Домой"')
        }
      } else if (isChrome) {
        if (isInTelegramApp) {
          wa.showAlert?.('Нажмите меню браузера (⋮) и выберите "Установить приложение"')
        } else {
          alert('Нажмите меню браузера (⋮) в правом верхнем углу и выберите "Установить приложение" или "Добавить на главный экран"')
        }
      } else {
        if (isInTelegramApp) {
          wa.showAlert?.('Нажмите меню браузера и выберите "Добавить на главный экран"')
        } else {
          alert('Нажмите меню браузера и выберите "Добавить на главный экран" или "Установить приложение"')
        }
      }
    }
  }

  const checkHomeScreenStatus = (callback: (status: string) => void) => {
    const wa = WebApp as any
    try {
      if (wa.checkHomeScreenStatus) {
        wa.checkHomeScreenStatus(callback)
      } else {
        callback('unsupported')
      }
    } catch (e) {
      console.error('checkHomeScreenStatus error:', e)
      callback('unsupported')
    }
  }

  // Get user - prefer Telegram user, fallback to web auth, then dev mock
  const authStoreUser = useAuthStore((state) => state.user)
  const isWebAuthenticated = useAuthStore((state) => state.isAuthenticated && state.authMethod === 'web')

  const user = WebApp.initDataUnsafe?.user
    ? WebApp.initDataUnsafe.user
    : isWebAuthenticated && authStoreUser
      ? {
        id: authStoreUser.id,
        first_name: authStoreUser.first_name || 'User',
        last_name: authStoreUser.last_name,
        username: authStoreUser.username,
        language_code: 'en',
        is_premium: false
      }
      : (import.meta.env.DEV ? {
        id: 817308975,
        first_name: 'Muhammad',
        last_name: 'Nuriddinov',
        username: 'mortymn',
        language_code: 'en',
        is_premium: true
      } : undefined)

  useEffect(() => {
    // Only sync avatar for Telegram users (uses Telegram Bot API)
    if (user?.id && isInTelegramApp) {
      fetch('/api/user/sync-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: user.id })
      }).catch(e => console.error('Avatar sync failed', e))
    }
  }, [user?.id, isInTelegramApp])

  // Detect real device platform (for web/PWA where WebApp.platform is 'unknown')
  const resolvedPlatform = (() => {
    // In Telegram, trust the SDK
    if (isInTelegramApp) return WebApp.platform
    // For web/PWA, detect from user agent
    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
    if (/Android/.test(ua)) return 'android'
    return 'desktop'
  })()

  // Detect PWA standalone mode (saved to home screen)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true

  return {
    showMainButton,
    hideMainButton,
    showProgress,
    hideProgress,
    shareImage,
    downloadFile,
    saveToGallery,
    openLink,
    openBotDeepLink,
    addToHomeScreen,
    checkHomeScreenStatus,
    onClose: WebApp.close,
    onToggleButton: WebApp.MainButton.isVisible ? hideMainButton : () => showMainButton('Generate', () => { }),
    tg: WebApp,
    user,
    platform: resolvedPlatform,
    isInTelegram: isInTelegramApp,
    isPWA
  }
}
