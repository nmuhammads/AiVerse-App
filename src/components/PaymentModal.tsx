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
    { id: 'star_1000', tokens: 550, price: 1000, bonus: '+50 FREE', popular: true },
]

const PACKAGES_FIAT = [
    {
        id: 'fiat_50',
        tokens: 50,
        price: 100,
        webLink: 'https://web.tribute.tg/p/m04',
        link: 'https://t.me/tribute/app?startapp=pm04'
    },
    {
        id: 'fiat_120',
        tokens: 120,
        price: 230,
        bonus: '+4%',
        webLink: 'https://web.tribute.tg/p/m05',
        link: 'https://t.me/tribute/app?startapp=pm05'
    },
    {
        id: 'fiat_300',
        tokens: 300,
        price: 540,
        bonus: '+11%',
        webLink: 'https://web.tribute.tg/p/m06',
        link: 'https://t.me/tribute/app?startapp=pm06'
    },
    {
        id: 'fiat_800',
        tokens: 800,
        price: 1440,
        bonus: '+11%',
        webLink: 'https://web.tribute.tg/p/m07',
        link: 'https://t.me/tribute/app?startapp=pm07'
    },
]

export function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
    const { impact } = useHaptics()
    const { user } = useTelegram()
    const [activeMethod, setActiveMethod] = useState<PaymentMethod>('stars')
    const [selectedPackage, setSelectedPackage] = useState<any>(PACKAGES_STARS[3])
    const [loading, setLoading] = useState(false)

    // Update selected package when method changes to keep relative position or default
    useEffect(() => {
        const packages: any[] = activeMethod === 'stars' ? PACKAGES_STARS : PACKAGES_FIAT
        // Try to find matching token amount, otherwise default to popular or middle
        const match = packages.find(p => p.tokens === selectedPackage.tokens) || packages.find(p => p.popular) || packages[0]
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
                const response = await fetch('/api/payment/create-stars-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: `${selectedPackage.tokens} токенов`,
                        description: `Покупка ${selectedPackage.tokens} токенов AiVerse`,
                        payload: JSON.stringify({ packageId: selectedPackage.id, tokens: selectedPackage.tokens }),
                        currency: 'XTR',
                        amount: selectedPackage.price
                    })
                })
                const data = await response.json()

                if (data.success && data.invoiceLink) {
                    const wa = (window as any).Telegram?.WebApp
                    if (wa) {
                        wa.openInvoice(data.invoiceLink, (status: string) => {
                            if (status === 'paid') {
                                impact('heavy')
                                alert('Оплата прошла успешно! Токены начислены.')
                                onClose()
                                // TODO: Refresh balance
                            } else if (status === 'cancelled') {
                                impact('light')
                            } else {
                                alert('Статус оплаты: ' + status)
                            }
                        })
                    } else {
                        window.open(data.invoiceLink, '_blank')
                    }
                } else {
                    alert('Ошибка создания счета: ' + (data.error || 'Unknown error'))
                }
            } catch (e) {
                console.error(e)
                alert('Ошибка соединения с сервером')
            } finally {
                setLoading(false)
            }
        } else {
            // Tribute Payment (Card or SBP) via Bot Hub Deep Link
            const wa = (window as any).Telegram?.WebApp
            const method = activeMethod === 'card' ? 'card' : 'sbp'
            const link = `https://t.me/aiverse_hub_bot?start=pay-${method}-${selectedPackage.tokens}`

            if (wa) {
                wa.openTelegramLink(link)
                onClose()
            } else {
                window.open(link, '_blank')
            }
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
                        {packages.map((pkg: any, index: number) => {
                            const isLast = index === packages.length - 1 && packages.length % 2 !== 0
                            const isSelected = selectedPackage.id === pkg.id
                            return (
                                <button
                                    key={pkg.id}
                                    onClick={() => { impact('light'); setSelectedPackage(pkg) }}
                                    className={`relative p-2 rounded-xl border transition-all flex flex-col items-start gap-1.5 ${isLast ? 'col-span-2 flex-row items-center' : ''
                                        } ${pkg.price === 1000
                                            ? (isSelected ? 'bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border-amber-500 ring-1 ring-amber-500' : 'bg-gradient-to-br from-amber-500/10 to-yellow-600/10 border-amber-500/50 hover:from-amber-500/20 hover:to-yellow-600/20')
                                            : (isSelected ? 'bg-violet-600/10 border-violet-500 ring-1 ring-violet-500' : 'bg-zinc-800/50 border-white/5 hover:bg-zinc-800')
                                        }`}
                                >
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-violet-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                                        <Zap size={14} fill="currentColor" />
                                    </div>

                                    <div className={`flex-1 text-left ${isLast ? 'flex justify-between items-center w-full pl-2' : ''}`}>
                                        <div>
                                            <div className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{pkg.tokens} токенов</div>
                                            {pkg.bonus && <div className="text-[10px] text-emerald-400 font-bold">Бонус {pkg.bonus}</div>}
                                        </div>
                                        <div className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                            {pkg.price} {currencySymbol}
                                        </div>
                                    </div>

                                    {activeMethod === 'stars' && pkg.popular && !isLast && (
                                        <div className="absolute -top-1.5 right-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg z-10">
                                            POPULAR
                                        </div>
                                    )}
                                    {activeMethod === 'stars' && pkg.bonus && !isLast && (
                                        <div className={`absolute text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg z-10 ${pkg.popular ? '-bottom-1.5 right-1.5' : '-top-1.5 right-1.5'} bg-gradient-to-r from-emerald-400 to-teal-500`}>
                                            {pkg.bonus}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-5 pt-0 mt-auto shrink-0 space-y-3">
                    {activeMethod === 'sbp' && (
                        <div className="text-[10px] text-zinc-500 text-center">
                            При оплате через СБП взимается комиссия сервиса
                        </div>
                    )}
                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className={`w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg text-sm ${activeMethod === 'stars'
                            ? 'bg-[#0088cc] hover:bg-[#0077b5] text-white shadow-blue-900/20'
                            : 'bg-white text-black hover:bg-zinc-200 shadow-white/10'
                            }`}
                    >
                        {loading ? 'Обработка...' : `Оплатить ${selectedPackage.price} ${currencySymbol} через ${activeMethod === 'stars' ? 'Stars' : activeMethod === 'card' ? 'Карту' : 'СБП'}`}
                    </button>
                </div>
            </div>
        </div>
    )
}
