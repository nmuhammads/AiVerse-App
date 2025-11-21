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
    const wa = WebApp as unknown as { downloadFile?: (u: string, name?: string) => Promise<void> | void; HapticFeedback?: { impactOccurred?: (s: string) => void; notificationOccurred?: (s: string) => void }; showAlert?: (t: string) => void; platform?: string; version?: string }
    const extFromUrl = /\.png(\?|$)/i.test(url) ? 'png' : (/\.webp(\?|$)/i.test(url) ? 'webp' : 'jpg')
    const sanitizeName = (s: string, fallbackExt: string) => {
      const m = s.match(/^([A-Za-z0-9._-]+?)(?:\.([A-Za-z0-9]+))?$/)
      if (m) {
        const base = m[1].replace(/[^A-Za-z0-9._-]/g, '')
        const extRaw = (m[2] || fallbackExt).replace(/[^A-Za-z0-9]/g, '') || fallbackExt
        const ext = /^(png|jpg|jpeg|webp)$/i.test(extRaw) ? (extRaw.toLowerCase() === 'jpeg' ? 'jpg' : extRaw.toLowerCase()) : fallbackExt
        let nm = `${base}.${ext}`
        if (nm.length > 64) nm = nm.slice(0, 64)
        nm = nm.replace(/^\.+/, '').replace(/\.+$/, '')
        return nm || `ai-${Date.now()}.${fallbackExt}`
      }
      return `ai-${Date.now()}.${fallbackExt}`
    }
    let name = sanitizeName(filename || `ai-${Date.now()}.${extFromUrl}`, extFromUrl)
    if (!wa.downloadFile) {
      WebApp.showAlert?.('Обновите Telegram до последней версии')
      return
    }
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const proxyPathInitial = `/api/telegram/download?url=${encodeURIComponent(url)}`
      const proxyUrlInitial = origin ? `${origin}${proxyPathInitial}` : proxyPathInitial
      let ct = ''
      let clen = ''
      let headOk = false
      try {
        const headResp = await fetch(proxyUrlInitial, { method: 'HEAD' })
        headOk = headResp.ok
        ct = String(headResp.headers.get('Content-Type') || '')
        clen = String(headResp.headers.get('Content-Length') || '')
        const fileExt = ct.includes('png') ? 'png' : (ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : (ct.includes('webp') ? 'webp' : extFromUrl))
        name = sanitizeName(filename || `ai-${Date.now()}.${fileExt}`, fileExt)
      } catch { void 0 }
      const proxyPath = `/api/telegram/download?url=${encodeURIComponent(url)}`
      const proxyUrl = origin ? `${origin}${proxyPath}` : proxyPath
      try {
        await fetch('/api/telegram/log/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'start', platform: wa.platform, version: wa.version, hasDownloadFile: true, name, rawUrl: url, proxyUrl, head: { ok: headOk, ct, clen } }) })
      } catch { void 0 }
      wa.HapticFeedback?.impactOccurred?.('medium')
      try {
        await wa.downloadFile(proxyUrl, name)
      } catch (e1) {
        const msg = (e1 as Error)?.message || ''
        try {
          await fetch('/api/telegram/log/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'retry', platform: wa.platform, version: wa.version, hasDownloadFile: true, name, rawUrl: url, proxyUrl, error: msg }) })
        } catch { void 0 }
        if (/WebAppDownloadFileParamInvalid/i.test(msg)) {
          await wa.downloadFile(proxyUrl)
        } else {
          throw e1
        }
      }
      WebApp.HapticFeedback?.notificationOccurred?.('success')
      try {
        await fetch('/api/telegram/log/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'success', platform: wa.platform, version: wa.version, hasDownloadFile: true, name, rawUrl: url, proxyUrl, head: { ok: headOk, ct, clen } }) })
      } catch { void 0 }
    } catch (err) {
      try {
        await fetch('/api/telegram/log/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'error', platform: wa.platform, version: wa.version, hasDownloadFile: true, name, rawUrl: url, error: (err as Error)?.message }) })
      } catch { void 0 }
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
