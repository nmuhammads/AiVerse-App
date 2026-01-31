// Translations for Telegram messages
export const TELEGRAM_MESSAGES = {
  ru: {
    createSimilar: '🎨 Создай похожее:',
    inBot: 'В боте',
    repeatInApp: '👇 Повторить в приложении 👇',
    appName: '✨ 📱 AiVerse App ✨',
    prompt: '💬 Промпт:'
  },
  en: {
    createSimilar: '🎨 Create Similar:',
    inBot: 'In bot',
    repeatInApp: '👇 Repeat in app 👇',
    appName: '✨ 📱 AiVerse App ✨',
    prompt: '💬 Prompt:'
  }
}

export function getTelegramMessage(lang: string | null, key: keyof typeof TELEGRAM_MESSAGES.ru): string {
  const language = lang === 'en' ? 'en' : 'ru'
  return TELEGRAM_MESSAGES[language][key]
}
