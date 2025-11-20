import WebApp from '@twa-dev/sdk'

export function useHaptics() {
  const impact = (style: 'light' | 'medium' | 'heavy') => {
    try {
      WebApp.HapticFeedback.impactOccurred(style)
    } catch { void 0 }
  }

  const notify = (type: 'success' | 'error' | 'warning') => {
    try {
      WebApp.HapticFeedback.notificationOccurred(type)
    } catch { void 0 }
  }

  return { impact, notify }
}
