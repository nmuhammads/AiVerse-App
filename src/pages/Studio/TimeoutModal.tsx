import { useTranslation } from 'react-i18next'

type TimeoutModalProps = {
    isOpen: boolean
    onClose: () => void
}

export function TimeoutModal({ isOpen, onClose }: TimeoutModalProps) {
    const { t } = useTranslation()

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full relative shadow-2xl animate-in slide-in-from-bottom-4">
                <div className="text-4xl text-center mb-4">⏳</div>
                <h3 className="text-lg font-bold text-white text-center mb-2">
                    {t('studio.timeout.title', 'Генерация занимает больше времени')}
                </h3>
                <p className="text-zinc-400 text-center text-sm mb-6">
                    {t('studio.timeout.description', 'Результат появится в профиле или токены вернутся автоматически.')}
                </p>
                <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
                >
                    {t('common.understood', 'Понятно')}
                </button>
            </div>
        </div>
    )
}
