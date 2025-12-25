import { useEffect } from 'react'
import WebApp from '@twa-dev/sdk'

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
        fetch('/api/user/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .finally(() => { sessionStorage.removeItem('aiverse_ref') })
      }
    } catch { /* noop */ }

    return () => {
      wa.offEvent('activated', ensureExpand)
      wa.offEvent('viewportChanged', ensureExpand)
      wa.offEvent('safeAreaChanged', applySafe)
      wa.offEvent('contentSafeAreaChanged', applySafe)
      wa.MainButton.hide()
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

  const shareImage = (imageUrl: string, caption: string) => {
    // Открытие ссылки в Telegram
    WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(imageUrl)}&text=${encodeURIComponent(caption)}`)
  }

  const saveToGallery = async (url: string, filename?: string) => {
    const wa = WebApp as any
    if (!wa.downloadFile) {
      wa.showAlert?.('Обновите Telegram до последней версии')
      return
    }

    try {
      // Use proxy URL to ensure correct Content-Disposition headers for Telegram downloadFile
      const proxyUrl = `/api/telegram/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename || '')}`
      const fullUrl = `${window.location.origin}${proxyUrl}`

      wa.HapticFeedback?.impactOccurred?.('medium')
      await wa.downloadFile({ url: fullUrl, file_name: filename || 'file' })
      wa.HapticFeedback?.notificationOccurred?.('success')
    } catch (e) {
      console.error('Download failed:', e)
      wa.showAlert?.('Не удалось сохранить файл. Попробуйте еще раз.')
      wa.HapticFeedback?.notificationOccurred?.('error')
    }
  }

  const downloadFile = saveToGallery

  const openLink = (url: string) => {
    WebApp.openLink(url)
  }

  const openBotDeepLink = (param: string) => {
    const u = `https://t.me/AiVerseAppBot?startapp=${encodeURIComponent(param)}`
    WebApp.openTelegramLink(u)
  }

  const openDeepLink = (param: string) => {
    // Helper to open internal deep links if needed, or just use for generating the param string
    return param
  }

  const addToHomeScreen = () => {
    const wa = WebApp as any
    if (wa.addToHomeScreen) {
      wa.addToHomeScreen()
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

  const user = (import.meta.env.DEV && !WebApp.initDataUnsafe.user) ? {
    id: 817308975,
    first_name: 'Muhammad',
    last_name: 'Nuriddinov',
    username: 'mortymn',
    language_code: 'en',
    is_premium: true
  } : WebApp.initDataUnsafe.user

  useEffect(() => {
    if (user?.id) {
      // Sync avatar on launch
      fetch('/api/user/sync-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).catch(e => console.error('Avatar sync failed', e))
    }
  }, [user?.id])

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
    platform: WebApp.platform
  }
}
