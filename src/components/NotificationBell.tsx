import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'
import { NotificationsModal } from './NotificationsModal'

export function NotificationBell() {
    const { user } = useTelegram()
    const { impact } = useHaptics()
    const [count, setCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    // Fetch unread count
    useEffect(() => {
        if (!user?.id) return

        const fetchCount = async () => {
            try {
                const r = await fetch(`/api/notifications/count?user_id=${user.id}`)
                const j = await r.json()
                if (r.ok && typeof j.total === 'number') {
                    setCount(j.total)
                }
            } catch (e) {
                console.error('Failed to fetch notification count', e)
            }
        }

        fetchCount()
        // Poll every 30 seconds
        const interval = setInterval(fetchCount, 30000)
        return () => clearInterval(interval)
    }, [user?.id])

    const handleClick = () => {
        impact('light')
        setIsOpen(true)
    }

    const handleClose = () => {
        setIsOpen(false)
        // Refresh count after closing
        if (user?.id) {
            fetch(`/api/notifications/count?user_id=${user.id}`)
                .then(r => r.json())
                .then(j => { if (typeof j.total === 'number') setCount(j.total) })
                .catch(() => { })
        }
    }

    return (
        <>
            <button
                onClick={handleClick}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
            >
                <Bell size={20} className="text-zinc-400" />
                {count > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-lg">
                        {count > 99 ? '99+' : count}
                    </div>
                )}
            </button>

            <NotificationsModal isOpen={isOpen} onClose={handleClose} />
        </>
    )
}
