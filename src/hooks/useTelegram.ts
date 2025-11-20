import { useEffect } from 'react'
import WebApp from '@twa-dev/sdk'

export function useTelegram() {
  useEffect(() => {
    WebApp.ready()
    WebApp.expand()
    const ensure = () => {
      try { WebApp.requestFullscreen() } catch { void 0 }
      try { if (!WebApp.isExpanded) WebApp.expand() } catch { void 0 }
    }
    ensure()
    setTimeout(ensure, 100)
    setTimeout(ensure, 300)
    WebApp.onEvent('activated', ensure)
    WebApp.onEvent('fullscreenChanged', ensure)
    WebApp.onEvent('viewportChanged', ensure)
    
    // Установка цветовой схемы
    WebApp.setHeaderColor('#1a1a1a')
    WebApp.setBackgroundColor('#1a1a1a')
    
    WebApp.MainButton.hide()
    WebApp.MainButton.setText('Generate')
    WebApp.MainButton.color = '#8B5CF6'
    WebApp.MainButton.textColor = '#FFFFFF'
    
    return () => {
      WebApp.offEvent('activated', ensure)
      WebApp.offEvent('fullscreenChanged', ensure)
      WebApp.offEvent('viewportChanged', ensure)
      WebApp.MainButton.hide()
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
    openLink,
    openBotDeepLink,
    user: WebApp.initDataUnsafe.user,
    platform: WebApp.platform
  }
}
