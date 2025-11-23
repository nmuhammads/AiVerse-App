import { X, CreditCard, Star, Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'

interface PaymentModalProps {
    isOpen: boolean
    onClose: () => void
}

type PaymentMethod = 'stars' | 'card' | 'sbp'

const PACKAGES_STARS = [
    { id: 'star_20', tokens: 10, price: 20 },
    { id: 'star_50', tokens: 25, price: 50 },
    { id: 'star_100', tokens: 50, price: 100 },
    { id: 'star_200', tokens: 100, price: 200, popular: true },
    { id: 'star_300', tokens: 150, price: 300 },
    { id: 'star_600', tokens: 300, price: 600 },
    { id: 'star_1000', tokens: 550, price: 1000, bonus: true },
]

const PACKAGES_FIAT = [
    { id: 'fiat_50', tokens: 10, price: 50 },
    { id: 'fiat_125', tokens: 25, price: 125 },
    { id: 'fiat_250', tokens: 50, price: 250 },
    { id: 'fiat_500', tokens: 100, price: 500, popular: true },
    { id: 'fiat_750', tokens: 150, price: 750 },
    { id: 'fiat_1500', tokens: 300, price: 1500 },
    { id: 'fiat_2500', tokens: 550, price: 2500, bonus: true },
]

export function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
    const { impact } = useHaptics()
    const { user } = useTelegram()
    const [activeMethod, setActiveMethod] = useState<PaymentMethod>('stars')
    const [selectedPackage, setSelectedPackage] = useState(PACKAGES_STARS[3])
    const [loading, setLoading] = useState(false)

    // Update selected package when method changes to keep relative position or default
    useEffect(() => {
        const packages = activeMethod === 'stars' ? PACKAGES_STARS : PACKAGES_FIAT
        // Try to find matching token amount, otherwise default to popular
        const match = packages.find(p => p.tokens === selectedPackage.tokens) || packages[3]
        setSelectedPackage(match)
    }, [activeMethod])

    if (!isOpen) return null

    const packages = activeMethod === 'stars' ? PACKAGES_STARS : PACKAGES_FIAT
    const currencySymbol = activeMethod === 'stars' ? '⭐' : '₽'

    const handlePayment = async () => {
        impact('medium')
        if (activeMethod === 'stars') {
            setLoading(true)
            try {
                // Placeholder for Stars payment
                alert(`Оплата ${selectedPackage.tokens} токенов за ${selectedPackage.price} Stars (Coming Soon)`)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        } else {
            alert(`Оплата ${selectedPackage.tokens} токенов за ${selectedPackage.price} ₽ через ${activeMethod === 'card' ? 'Карту' : 'СБП'} пока не подключена`)
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-5 pb-3 flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white">Пополнение баланса</h2>
                        <p className="text-xs text-zinc-400 mt-0.5">Выберите пакет токенов</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Method Selector */}
                <div className="px-5 pb-3 shrink-0">
                    <div className="flex p-1 bg-zinc-800/50 rounded-xl border border-white/5">
                        <button
                            onClick={() => { impact('light'); setActiveMethod('stars') }}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${activeMethod === 'stars' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
                        >
                            <Star size={12} fill={activeMethod === 'stars' ? 'currentColor' : 'none'} /> Stars
                        </button>
                        <button
                            onClick={() => { impact('light'); setActiveMethod('card') }}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${activeMethod === 'card' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
                        >
                            <CreditCard size={12} /> Карта
                        </button>
                        <button
                            onClick={() => { impact('light'); setActiveMethod('sbp') }}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${activeMethod === 'sbp' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
                        >
                            <div className="w-2.5 h-2.5 bg-gradient-to-tr from-blue-500 via-green-500 to-yellow-500 rounded-sm" /> СБП
                        </button>
                    </div>
                </div>

                {/* Packages Grid */}
                <div className="px-5 pb-5 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                        {packages.map((pkg, index) => {
                            const isLast = index === packages.length - 1
                            const isSelected = selectedPackage.id === pkg.id
                            return (
                                <button
                                    key={pkg.id}
                                    onClick={() => { impact('light'); setSelectedPackage(pkg) }}
                                    className={`relative p-2 rounded-xl border transition-all flex flex-col items-start gap-1.5 ${isLast ? 'col-span-2 flex-row items-center' : ''
                                        } ${isSelected
                                            ? 'bg-violet-600/10 border-violet-500 ring-1 ring-violet-500'
                                            : 'bg-zinc-800/50 border-white/5 hover:bg-zinc-800'
                                        }`}
                                >
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-violet-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                                        <Zap size={14} fill="currentColor" />
                                    </div>

                                    <div className={`flex-1 text-left ${isLast ? 'flex justify-between items-center w-full pl-2' : ''}`}>
                                        <div>
                                            <div className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{pkg.tokens} токенов</div>
                                            {isLast && <div className="text-[10px] text-emerald-400 font-bold">+10% Бонус</div>}
                                        </div>
                                        <div className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                            {pkg.price} {currencySymbol}
                                        </div>
                                    </div>

                                    {pkg.popular && !isLast && (
                                        <div className="absolute -top-1.5 right-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                                            POPULAR
                                        </div>
                                    )}
                                    {pkg.bonus && (
                                        <div className="absolute -top-1.5 right-3 bg-gradient-to-r from-emerald-400 to-teal-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                                            BONUS +10%
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-5 pt-0 mt-auto shrink-0">
                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className={`w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg text-sm ${activeMethod === 'stars'
                                ? 'bg-[#0088cc] hover:bg-[#0077b5] text-white shadow-blue-900/20'
                                : 'bg-white text-black hover:bg-zinc-200 shadow-white/10'
                            }`}
                    >
                        {loading ? 'Обработка...' : `Оплатить ${selectedPackage.price} ${currencySymbol}`}
                    </button>
                </div>
            </div>
        </div>
    )
}
