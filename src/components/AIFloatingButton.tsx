/**
 * AI Floating Button (FAB)
 * Кнопка для быстрого доступа к свёрнутому чату
 */

import { useTranslation } from 'react-i18next'
import { Bot } from 'lucide-react'
import { useAIChatStore } from '@/store/aiChatStore'
import { resolvedPlatform } from '@/utils/platform'

export function AIFloatingButton() {
    const { t } = useTranslation()
    const { isMinimized, restoreChat } = useAIChatStore()

    if (!isMinimized) return null

    const platform = resolvedPlatform
    // Позиционирование над TabBar и кнопкой Generate
    const bottomOffset = platform === 'android' ? 'bottom-52' : 'bottom-48'

    return (
        <button
            onClick={restoreChat}
            className={`fixed right-4 ${bottomOffset} z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform`}
            title={t('aiChat.restore', 'Открыть чат')}
        >
            <Bot className="w-6 h-6" />
        </button>
    )
}
