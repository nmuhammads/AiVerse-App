import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTelegram, getAuthHeaders } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'
import { useTranslation } from 'react-i18next'
import { useActiveGenerationsStore } from '@/store/activeGenerationsStore'

// Throttle интервал для запросов check-status (защита от дублей)
const CHECK_STATUS_THROTTLE_MS = 3000

export function PendingIndicator() {
    const { t } = useTranslation()
    const [serverCount, setServerCount] = useState(0)
    const [showHint, setShowHint] = useState(false)
    const { user } = useTelegram()
    const { impact, notify } = useHaptics()
    const navigate = useNavigate()
    const location = useLocation()

    // Ref для throttle - время последнего запроса
    const lastCheckRef = useRef(0)

    // Локальные активные генерации из store (считаем количество изображений)
    const localActiveCount = useActiveGenerationsStore(
        (state) => state.generations
            .filter((g) => g.status === 'processing')
            .reduce((sum, g) => sum + g.imageCount, 0)
    )

    // Используем serverCount как основной источник правды
    // localActiveCount показывается только если serverCount ещё не получен (до первого fetch)
    // Это предотвращает двойной подсчёт когда генерация есть и локально, и на сервере
    const totalCount = serverCount > 0 ? serverCount : localActiveCount;

    const fetchPendingCount = useCallback(async () => {
        if (!user?.id) return

        // Throttle: не чаще раза в CHECK_STATUS_THROTTLE_MS
        const now = Date.now()
        if (now - lastCheckRef.current < CHECK_STATUS_THROTTLE_MS) {
            return // Пропустить - недавно уже проверяли
        }
        lastCheckRef.current = now

        try {
            // First, trigger status check to update any completed generations
            await fetch('/api/generation/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ user_id: user.id })
            }).catch(() => { })

            // Then get the pending count
            const res = await fetch(`/api/generation/pending-count?user_id=${user.id}`)
            const data = await res.json()
            if (typeof data.count === 'number') {
                setServerCount(data.count)
            }
        } catch (e) {
            console.error('Failed to fetch pending count', e)
        }
    }, [user?.id])

    // Fetch on initial load
    useEffect(() => {
        fetchPendingCount()
    }, [fetchPendingCount])

    // Fetch on navigation (location change)
    useEffect(() => {
        fetchPendingCount()
    }, [location.pathname, fetchPendingCount])

    // Fetch when returning from background (visibility change)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchPendingCount()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [fetchPendingCount])

    // Auto-hide hint after 3 seconds
    useEffect(() => {
        if (showHint) {
            const timer = setTimeout(() => setShowHint(false), 3000)
            return () => clearTimeout(timer)
        }
    }, [showHint])

    if (totalCount === 0) return null

    const handleClick = () => {
        impact('light')

        // If on Studio page, just show hint (panel is already visible there)
        if (location.pathname === '/studio') {
            notify('warning')
            setShowHint(true)
        } else if (location.pathname === '/profile') {
            notify('warning')
            setShowHint(true)
        } else {
            navigate('/profile')
        }
    }

    return (
        <div className="fixed bottom-[280px] right-4 z-50 flex flex-col items-end gap-2">
            {/* Hint popup */}
            <div
                className={`max-w-[200px] px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-medium shadow-lg shadow-violet-500/30 border border-violet-400/30 backdrop-blur-md transition-all duration-300 origin-bottom-right ${showHint
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-90 translate-y-2 pointer-events-none'
                    }`}
            >
                {t('pending.hint', { count: totalCount })}
            </div>

            {/* Button */}
            <button
                onClick={handleClick}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-violet-600/90 hover:bg-violet-500 backdrop-blur-md border border-violet-400/30 shadow-lg shadow-violet-500/20 active:scale-95 transition-all"
            >
                <Loader2 size={16} className="text-white animate-spin" />
                <span className="text-white text-xs font-bold">{totalCount}</span>
            </button>
        </div>
    )
}

