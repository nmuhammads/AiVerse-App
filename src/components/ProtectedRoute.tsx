/**
 * ProtectedRoute - Redirects to login if not authenticated
 * Used for routes that require authentication in web mode
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useTelegram } from '../hooks/useTelegram'

interface ProtectedRouteProps {
    children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const location = useLocation()
    const { isAuthenticated, isLoading } = useAuthStore()
    const { isInTelegram, user: telegramUser } = useTelegram()

    // In Telegram Mini App - always allow (auth handled by initData)
    if (isInTelegram && telegramUser) {
        return <>{children}</>
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
        )
    }

    // Not authenticated in web mode - redirect to login
    if (!isAuthenticated && !isInTelegram) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}
