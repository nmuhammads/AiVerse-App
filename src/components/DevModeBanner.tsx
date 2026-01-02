import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Check for dev mode - handle various env value formats
const isDevMode = () => {
    const value = import.meta.env.VITE_DEV_MODE
    console.log('[DevMode] VITE_DEV_MODE value:', value, 'type:', typeof value)
    return value === 'true' || value === true || value === '"true"' || value === '1'
}

export function DevModeBanner() {
    const { t } = useTranslation()

    if (!isDevMode()) return null

    return (
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-4">
            <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                    <div className="font-bold text-amber-300">{t('devMode.title')}</div>
                    <div className="text-zinc-300">{t('devMode.description')}</div>
                    <div className="text-zinc-400">{t('devMode.warning')}</div>
                </div>
            </div>
        </div>
    )
}

export { isDevMode }
