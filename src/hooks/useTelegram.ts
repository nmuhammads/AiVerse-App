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
        fetch('/api/user/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid }) }).catch(() => {})
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
    WebApp.MainButton.offClick(() => {})
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
    const ext = /\.png(\?|$)/i.test(url) ? 'png' : 'jpg'
    const name = filename || `ai-${Date.now()}.${ext}`
    const wa = WebApp as unknown as { downloadFile?: (u: string, name?: string) => Promise<void> | void; HapticFeedback?: { impactOccurred?: (s: string) => void; notificationOccurred?: (s: string) => void }; showAlert?: (t: string) => void }
    if (!wa.downloadFile) {
      WebApp.showAlert?.('Обновите Telegram до последней версии')
      return
    }
    try {
      wa.HapticFeedback?.impactOccurred?.('medium')
      await wa.downloadFile(url, name)
      WebApp.HapticFeedback?.notificationOccurred?.('success')
    } catch (err) {
      console.error('downloadFile error', err)
      WebApp.showAlert?.('Не удалось сохранить фото')
      WebApp.HapticFeedback?.notificationOccurred?.('error')
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
    user: WebApp.initDataUnsafe.user,
    platform: WebApp.platform
  }
}
