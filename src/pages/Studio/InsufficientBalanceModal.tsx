import { X, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type InsufficientBalanceModalProps = {
    isOpen: boolean
    onClose: () => void
    onBuyTokens: () => void
}

export function InsufficientBalanceModal({ isOpen, onClose, onBuyTokens }: InsufficientBalanceModalProps) {
    const { t } = useTranslation()

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full relative shadow-2xl animate-in slide-in-from-bottom-4">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
                    <X size={20} />
                </button>
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4 mx-auto">
                    <Zap size={24} className="text-yellow-500" />
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">
                    {t('studio.balance.title', 'Недостаточно токенов')}
                </h3>
                <p className="text-zinc-400 text-center text-sm mb-6">
                    {t('studio.balance.description', 'У вас закончились токены для генерации. Пополните баланс, чтобы продолжить создавать шедевры!')}
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-bold"
                    >
                        {t('common.cancel', 'Отмена')}
                    </button>
                    <button
                        onClick={onBuyTokens}
                        className="flex-1 py-3 rounded-xl bg-violet-600 text-white font-bold shadow-lg shadow-violet-900/20"
                    >
                        {t('studio.balance.buyTokens', 'Купить токены')}
                    </button>
                </div>
            </div>
        </div>
    )
}
