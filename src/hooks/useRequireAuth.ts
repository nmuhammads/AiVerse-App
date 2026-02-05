/**
 * useRequireAuth hook
 * Returns a function that checks if user is authenticated
 * If not, redirects to login page
 * Use for action-level auth gating (e.g., generate button)
 */

import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import WebApp from '@twa-dev/sdk'

// Check if running inside Telegram WebApp
function isInTelegramWebApp(): boolean {
    return !!(WebApp.initData && WebApp.initDataUnsafe?.user)
}

export function useRequireAuth() {
    const navigate = useNavigate()
    const { isAuthenticated } = useAuthStore()
    const inTelegram = isInTelegramWebApp()

    /**
     * Check if user can perform action
     * @returns true if authenticated and can proceed
     * @returns false if not authenticated (will redirect to login)
     */
    const requireAuth = (returnPath?: string): boolean => {
        // Telegram users are always authenticated
        if (inTelegram) {
            return true
        }

        // Web users need to be authenticated
        if (isAuthenticated) {
            return true
        }

        // Not authenticated - redirect to login
        navigate('/login', {
            state: { from: returnPath || window.location.pathname },
            replace: false
        })
        return false
    }

    /**
     * Wrapper for actions that require auth
     * Executes the action only if authenticated
     */
    const withAuth = <T extends unknown[]>(action: (...args: T) => void) => {
        return (...args: T) => {
            if (requireAuth()) {
                action(...args)
            }
        }
    }

    return {
        requireAuth,
        withAuth,
        isAuthenticated: inTelegram || isAuthenticated,
        isGuest: !inTelegram && !isAuthenticated
    }
}
