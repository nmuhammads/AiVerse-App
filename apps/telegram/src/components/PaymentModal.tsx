import { X, CreditCard, Star, Zap, Gift, Globe } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram, getAuthHeaders } from '@/hooks/useTelegram'
import { isPromoActive, calculateBonusTokens, getBonusAmount } from '@/utils/promo'
import { isDevMode } from '@/components/DevModeBanner'
import { VisaIcon, MastercardIcon, AmexIcon, UnionPayIcon, MirIcon } from '@/components/CardBrandIcons'

interface PaymentModalProps {
    isOpen: boolean
    onClose: () => void
}

type PaymentMethod = 'stars' | 'card'
type WebCurrency = 'eur' | 'rub'

const PACKAGES_STARS = [
    { id: 'star_20', tokens: 10, price: 20, spins: 0 },
    { id: 'star_50', tokens: 25, price: 50, spins: 0 },
    { id: 'star_100', tokens: 50, price: 100, spins: 0 },
    { id: 'star_200', tokens: 100, price: 200, popular: true, spins: 0 },
    { id: 'star_300', tokens: 150, price: 300, spins: 0 },
    { id: 'star_600', tokens: 300, price: 600, spins: 1 },
    { id: 'star_1000', tokens: 550, price: 1000, bonus: '+50 FREE', popular: true, spins: 2 },
]

// EUR packages via Tribute Shop API (1 EUR ≈ 90 RUB)
const PACKAGES_EUR = [
    { id: 'eur_50', tokens: 50, price: 110, priceLabel: '€1.10' },
    { id: 'eur_120', tokens: 120, price: 255, bonus: '+4%', priceLabel: '€2.55' },
    { id: 'eur_300', tokens: 300, price: 600, bonus: '+11%', priceLabel: '€6.00' },
    { id: 'eur_800', tokens: 800, price: 1600, bonus: '+11%', priceLabel: '€16.00' },
]

// RUB packages via Tribute Shop API
const PACKAGES_RUB = [
    { id: 'rub_50', tokens: 50, price: 10000, priceLabel: '₽100' },
    { id: 'rub_120', tokens: 120, price: 23000, bonus: '+4%', priceLabel: '₽230' },
    { id: 'rub_300', tokens: 300, price: 54000, bonus: '+11%', priceLabel: '₽540' },
    { id: 'rub_800', tokens: 800, price: 144000, bonus: '+11%', priceLabel: '₽1,440' },
]

// Custom token pricing
const BASE_RATE_RUB = 200   // kopecks per token (2 RUB)
const BASE_RATE_EUR = 2.2   // cents per token (€0.022)
const MIN_CUSTOM_TOKENS = 50
const MAX_CUSTOM_TOKENS = 10000

function getDiscountTier(tokens: number): { discount: number; label: string } {
    if (tokens >= 300) return { discount: 0.10, label: '-10%' }
    if (tokens >= 100) return { discount: 0.05, label: '-5%' }
    return { discount: 0, label: '' }
}

function calculateCustomTokenPrice(tokens: number, currency: WebCurrency): { amount: number; priceLabel: string; discount: number } {
    const { discount } = getDiscountTier(tokens)
    const baseRate = currency === 'eur' ? BASE_RATE_EUR : BASE_RATE_RUB
    const amount = Math.round(tokens * baseRate * (1 - discount))
    const priceLabel = currency === 'eur'
        ? `€${(amount / 100).toFixed(2)}`
        : `₽${Math.round(amount / 100).toLocaleString('ru-RU')}`
    return { amount, priceLabel, discount }
}

export function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
    const { t } = useTranslation()
    const { impact } = useHaptics()
    const { user, isInTelegram } = useTelegram()

    // Check if we're in web mode (not in Telegram)
    const isWebMode = !isInTelegram

    const [activeMethod, setActiveMethod] = useState<PaymentMethod>(isWebMode ? 'card' : 'stars')
    const [webCurrency, setWebCurrency] = useState<WebCurrency>('eur')
    const [selectedPackage, setSelectedPackage] = useState<any>(isWebMode ? PACKAGES_EUR[0] : PACKAGES_STARS[3])
    const [loading, setLoading] = useState(false)
    const [customTokens, setCustomTokens] = useState('')
    const [isCustomMode, setIsCustomMode] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const [modalMaxHeight, setModalMaxHeight] = useState<string>('min(90vh, 800px)')

    // Capture modal height on open so keyboard resize doesn't shrink it (iOS Telegram)
    useEffect(() => {
        if (isOpen && isInTelegram) {
            setModalMaxHeight(`min(${window.innerHeight * 0.9}px, 800px)`)
        } else {
            setModalMaxHeight('min(90vh, 800px)')
        }
    }, [isOpen, isInTelegram])

    // Get packages based on method and currency
    const getPackages = () => {
        if (activeMethod === 'stars') return PACKAGES_STARS
        return webCurrency === 'eur' ? PACKAGES_EUR : PACKAGES_RUB
    }

    // Update selected package when method or currency changes
    useEffect(() => {
        const packages = getPackages()
        const match = packages.find(p => p.tokens === selectedPackage.tokens) || packages.find((p: any) => p.popular) || packages[0]
        setSelectedPackage(match)
        setIsCustomMode(false)
        setCustomTokens('')
    }, [activeMethod, webCurrency, isWebMode])

    if (!isOpen) return null

    const packages = getPackages()
    const currencySymbol = activeMethod === 'stars' ? '⭐' : (webCurrency === 'eur' ? '€' : '₽')

    const handlePayment = async () => {
        impact('medium')
        if (activeMethod === 'stars') {
            // In dev mode, redirect to hub bot for Stars payment
            if (isDevMode()) {
                const wa = (window as any).Telegram?.WebApp
                const link = `https://t.me/aiverse_hub_bot?start=pay-stars-${selectedPackage.tokens}`
                if (wa) {
                    wa.openTelegramLink(link)
                    onClose()
                } else {
                    window.open(link, '_blank')
                }
                return
            }

            setLoading(true)
            try {
                const response = await fetch('/api/payment/create-stars-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify({
                        title: t('payment.packages.tokens', { count: selectedPackage.tokens }),
                        description: t('payment.messages.description', { count: selectedPackage.tokens }),
                        payload: JSON.stringify({ packageId: selectedPackage.id, tokens: selectedPackage.tokens, spins: selectedPackage.spins || 0 }),
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
                                alert(t('payment.messages.success'))
                                onClose()
                                // TODO: Refresh balance
                            } else if (status === 'cancelled') {
                                impact('light')
                            } else {
                                alert(t('payment.messages.status', { status }))
                            }
                        })
                    } else {
                        window.open(data.invoiceLink, '_blank')
                    }
                } else {
                    alert(t('payment.messages.errorInvoice', { error: data.error || 'Unknown error' }))
                }
            } catch (e) {
                console.error(e)
                alert(t('payment.messages.errorNetwork'))
            } finally {
                setLoading(false)
            }
        } else {
            // Card Payment via Tribute Shop API
            const customCount = isCustomMode ? parseInt(customTokens) : 0
            if (isCustomMode && (!customCount || customCount < MIN_CUSTOM_TOKENS || customCount > MAX_CUSTOM_TOKENS)) {
                return
            }

            setLoading(true)
            try {
                const body = isCustomMode
                    ? { customTokens: customCount, currency: webCurrency }
                    : { packageId: selectedPackage.id, currency: webCurrency }

                const response = await fetch('/api/tribute/create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify(body)
                })
                const data = await response.json()

                if (data.success && data.paymentUrl) {
                    // Save order UUID for status verification after redirect
                    if (data.orderUuid) {
                        localStorage.setItem('tribute_order_uuid', data.orderUuid)
                    }
                    // Open Tribute payment page
                    const wa = (window as any).Telegram?.WebApp
                    if (wa && isInTelegram) {
                        wa.openLink(data.paymentUrl)
                        onClose()
                    } else {
                        window.location.href = data.paymentUrl
                    }
                } else {
                    alert(t('payment.messages.errorInvoice', { error: data.error || 'Unknown error' }))
                }
            } catch (e) {
                console.error(e)
                alert(t('payment.messages.errorNetwork'))
            } finally {
                setLoading(false)
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
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col" style={{ maxHeight: modalMaxHeight }}>
                {/* Header */}
                <div className="p-5 pb-3 flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white">{t('payment.title')}</h2>
                        <p className="text-xs text-zinc-400 mt-0.5">{t('payment.subtitle')}</p>
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
                        {!isWebMode && (
                            <button
                                onClick={() => { impact('light'); setActiveMethod('stars') }}
                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${activeMethod === 'stars' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
                            >
                                <Star size={12} fill={activeMethod === 'stars' ? 'currentColor' : 'none'} /> Stars
                            </button>
                        )}
                        <button
                            onClick={() => { impact('light'); setActiveMethod('card') }}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${activeMethod === 'card' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
                        >
                            <CreditCard size={12} /> {t('payment.methods.card')}
                        </button>
                    </div>
                </div>

                {/* Currency Selector */}
                {activeMethod === 'card' && (
                    <div className="px-5 pb-3 shrink-0">
                        <div className="flex p-1 bg-zinc-800/50 rounded-xl border border-white/5">
                            <button
                                onClick={() => { impact('light'); setWebCurrency('eur') }}
                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${webCurrency === 'eur' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
                            >
                                <Globe size={12} /> EUR (€)
                            </button>
                            <button
                                onClick={() => { impact('light'); setWebCurrency('rub') }}
                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${webCurrency === 'rub' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
                            >
                                <Globe size={12} /> RUB (₽)
                            </button>
                        </div>
                        {/* Card Brand Icons */}
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <span className="text-[10px] text-zinc-500">{t('payment.acceptedCards', 'Accepted:')}</span>
                            <div className="flex items-center gap-1.5 text-zinc-400">
                                {webCurrency === 'eur' ? (
                                    <>
                                        <VisaIcon size={20} />
                                        <MastercardIcon size={16} />
                                        <AmexIcon size={16} />
                                        <UnionPayIcon size={16} />
                                    </>
                                ) : (
                                    <>
                                        <MirIcon size={20} />
                                        <VisaIcon size={20} />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Dev Mode Warning Banner */}
                {isDevMode() && (
                    <div className="mx-5 mb-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 shrink-0">
                        <div className="flex items-start gap-2">
                            <div className="text-amber-400 mt-0.5">⚠️</div>
                            <div className="text-xs">
                                <div className="font-bold text-amber-300">{t('payment.devModeWarning')}</div>
                                <div className="text-zinc-300 mt-0.5">{t('payment.devModeDescription')}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* New Year Promo Banner */}
                {isPromoActive() && (
                    <div className="mx-5 mb-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 via-red-500/20 to-emerald-500/20 border border-emerald-500/30 shrink-0">
                        <div className="flex items-center gap-2">
                            <Gift size={18} className="text-emerald-400 shrink-0" />
                            <div className="text-xs">
                                <span className="font-bold text-white">{t('promo.banner')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Packages Grid */}
                <div ref={scrollRef} className="px-5 pb-5 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                        {packages.map((pkg: any, index: number) => {
                            const isLast = index === packages.length - 1 && packages.length % 2 !== 0
                            const isSelected = selectedPackage.id === pkg.id
                            return (
                                <button
                                    key={pkg.id}
                                    onClick={() => { impact('light'); setSelectedPackage(pkg); setIsCustomMode(false); setCustomTokens('') }}
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
                                            {isPromoActive() ? (
                                                <div className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                                    <span className="line-through text-zinc-500 mr-1">{pkg.tokens}</span>
                                                    <span className="text-emerald-400">{calculateBonusTokens(pkg.tokens)} ✨</span>
                                                </div>
                                            ) : (
                                                <div className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{t('payment.packages.tokens', { count: pkg.tokens })}</div>
                                            )}
                                            {isPromoActive() && (
                                                <div className="text-[10px] text-emerald-400 font-bold">+{getBonusAmount(pkg.tokens)} 🎁</div>
                                            )}
                                            {pkg.bonus && !isPromoActive() && <div className="text-[10px] text-emerald-400 font-bold">{t('payment.packages.bonus')} {pkg.bonus}</div>}
                                            {pkg.spins > 0 && <div className="text-[10px] text-violet-400 font-bold">{t('payment.packages.spins', { count: pkg.spins })}</div>}
                                        </div>
                                        <div className={`font-bold text-xs ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                                            {pkg.priceLabel || `${pkg.price} ${currencySymbol}`}
                                        </div>
                                    </div>

                                    {activeMethod === 'stars' && pkg.popular && !isLast && (
                                        <div className="absolute -top-1.5 right-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg z-10">
                                            {t('payment.packages.popular')}
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

                    {/* Custom Token Input (card only) */}
                    {activeMethod === 'card' && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                            <div className="text-[11px] text-zinc-400 mb-2 text-center font-medium">
                                {t('payment.customInput.label', 'Или введите своё количество')}
                            </div>
                            <div className="relative">
                                <input
                                    ref={inputRef}
                                    type="number"
                                    min={MIN_CUSTOM_TOKENS}
                                    max={MAX_CUSTOM_TOKENS}
                                    placeholder={t('payment.customInput.placeholder', 'Введите количество токенов...')}
                                    value={customTokens}
                                    inputMode="numeric"
                                    onFocus={() => {
                                        setIsCustomMode(true)
                                    }}
                                    onChange={(e) => {
                                        setCustomTokens(e.target.value)
                                        setIsCustomMode(true)
                                    }}
                                    className="w-full h-12 px-4 pr-20 rounded-xl bg-zinc-800/70 border border-white/10 text-white text-sm font-medium placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">{t('payment.customInput.tokens', 'tokens')}</span>
                            </div>
                            {isCustomMode && customTokens && (() => {
                                const count = parseInt(customTokens)
                                if (!count || count < MIN_CUSTOM_TOKENS) {
                                    return (
                                        <div className="text-xs text-red-400 mt-2 text-center font-medium">
                                            {t('payment.customInput.min', { min: MIN_CUSTOM_TOKENS })}
                                        </div>
                                    )
                                }
                                if (count > MAX_CUSTOM_TOKENS) {
                                    return (
                                        <div className="text-xs text-red-400 mt-2 text-center font-medium">
                                            {t('payment.customInput.max', { max: MAX_CUSTOM_TOKENS.toLocaleString() })}
                                        </div>
                                    )
                                }
                                const { priceLabel, discount } = calculateCustomTokenPrice(count, webCurrency)
                                return (
                                    <div className="flex items-center justify-center gap-2 mt-2">
                                        <span className="text-sm text-white font-bold">{priceLabel}</span>
                                        {discount > 0 && (
                                            <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                {getDiscountTier(count).label}
                                            </span>
                                        )}
                                    </div>
                                )
                            })()}
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-5 pt-0 mt-auto shrink-0 space-y-3">
                    <button
                        onClick={handlePayment}
                        disabled={loading}
                        className={`w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg text-sm ${activeMethod === 'stars'
                            ? 'bg-[#0088cc] hover:bg-[#0077b5] text-white shadow-blue-900/20'
                            : 'bg-white text-black hover:bg-zinc-200 shadow-white/10'
                            }`}
                    >
                        {loading ? t('payment.button.processing') : (
                            isCustomMode && customTokens && parseInt(customTokens) >= MIN_CUSTOM_TOKENS
                                ? `${t('payment.button.paySimple')} ${calculateCustomTokenPrice(parseInt(customTokens), webCurrency).priceLabel}`
                                : selectedPackage.priceLabel
                                    ? `${t('payment.button.paySimple')} ${selectedPackage.priceLabel}`
                                    : t('payment.button.pay', {
                                        amount: selectedPackage.price,
                                        symbol: currencySymbol,
                                        method: activeMethod === 'stars' ? t('payment.methods.stars') : t('payment.methods.card')
                                    })
                        )}
                    </button>

                    {/* Bonus Purchase Button */}
                    <button
                        onClick={() => {
                            impact('medium')
                            const wa = (window as any).Telegram?.WebApp
                            const link = 'https://t.me/aiversebots?direct'
                            if (wa) {
                                wa.openTelegramLink(link)
                                onClose()
                            } else {
                                window.open(link, '_blank')
                            }
                        }}
                        className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-900/20"
                    >
                        <Gift size={16} />
                        {t('payment.button.bonus')}
                    </button>
                    <div className="text-[10px] text-red-400 font-bold text-center -mt-1 shadow-black/50 drop-shadow-sm">
                        {t('payment.messages.minPurchase')}
                    </div>
                </div>
            </div>
        </div>
    )
}
