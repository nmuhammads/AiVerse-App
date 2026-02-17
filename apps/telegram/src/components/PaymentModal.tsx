import { X, CreditCard, Star, Gift, Globe, ChevronLeft, Trash2, Check, Loader2 } from 'lucide-react'
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
type WebCurrency = 'eur' | 'rub' | 'usd'
type CardStep = 'package' | 'payment-method'

interface SavedCard {
    token: string
    cardLast4: string
    cardBrand: string
}

const PACKAGES_STARS = [
    { id: 'star_20', tokens: 10, price: 20 },
    { id: 'star_50', tokens: 25, price: 50 },
    { id: 'star_100', tokens: 50, price: 100 },
    { id: 'star_200', tokens: 100, price: 200, popular: true },
    { id: 'star_300', tokens: 150, price: 300 },
    { id: 'star_600', tokens: 300, price: 600 },
    { id: 'star_1000', tokens: 550, price: 1000 },
    { id: 'star_2000', tokens: 1100, price: 2000, bonus: '+100 FREE', popular: true },
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

// USD packages via Tribute Shop API (1 USD ≈ 77 RUB)
const PACKAGES_USD = [
    { id: 'usd_50', tokens: 50, price: 130, priceLabel: '$1.30' },
    { id: 'usd_120', tokens: 120, price: 300, bonus: '+4%', priceLabel: '$3.00' },
    { id: 'usd_300', tokens: 300, price: 700, bonus: '+11%', priceLabel: '$7.00' },
    { id: 'usd_800', tokens: 800, price: 1870, bonus: '+11%', priceLabel: '$18.70' },
]

// Custom token pricing — Stars
const STARS_PER_TOKEN = 2
const MIN_CUSTOM_STARS_TOKENS = 10
const MAX_CUSTOM_STARS_TOKENS = 5000

function calculateStarsForTokens(tokens: number): number {
    return Math.ceil(tokens * STARS_PER_TOKEN)
}

function getCustomStarsBonus(tokens: number): { bonusTokens: number; label: string } {
    if (tokens >= 1000) return { bonusTokens: 100, label: '+100 FREE' }
    if (tokens >= 500) return { bonusTokens: 50, label: '+50 FREE' }
    return { bonusTokens: 0, label: '' }
}

// Custom token pricing — Card
const BASE_RATE_RUB = 200   // kopecks per token (2 RUB)
const BASE_RATE_EUR = 2.2   // cents per token (€0.022)
const BASE_RATE_USD = 2.6   // cents per token ($0.026)
const MIN_CUSTOM_TOKENS = 50
const MAX_CUSTOM_TOKENS = 10000

function getDiscountTier(tokens: number): { discount: number; label: string } {
    if (tokens >= 300) return { discount: 0.10, label: '-10%' }
    if (tokens >= 100) return { discount: 0.05, label: '-5%' }
    return { discount: 0, label: '' }
}

function calculateCustomTokenPrice(tokens: number, currency: WebCurrency): { amount: number; priceLabel: string; discount: number } {
    const { discount } = getDiscountTier(tokens)
    const baseRate = currency === 'eur' ? BASE_RATE_EUR : currency === 'usd' ? BASE_RATE_USD : BASE_RATE_RUB
    const amount = Math.round(tokens * baseRate * (1 - discount))
    let priceLabel: string
    if (currency === 'eur') {
        priceLabel = `€${(amount / 100).toFixed(2)}`
    } else if (currency === 'usd') {
        priceLabel = `$${(amount / 100).toFixed(2)}`
    } else {
        priceLabel = `₽${Math.round(amount / 100).toLocaleString('ru-RU')}`
    }
    return { amount, priceLabel, discount }
}

function getCardBrandIcon(brand: string) {
    const b = brand.toUpperCase()
    if (b.includes('VISA')) return '💳 Visa'
    if (b.includes('MASTER')) return '💳 Mastercard'
    if (b.includes('MIR')) return '💳 Мир'
    if (b.includes('AMEX')) return '💳 Amex'
    if (b.includes('UNION')) return '💳 UnionPay'
    return '💳'
}

export function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
    const { t, i18n } = useTranslation()
    const { impact } = useHaptics()
    const { user, isInTelegram } = useTelegram()

    // Check if we're in web mode (not in Telegram)
    const isWebMode = !isInTelegram

    // Determine default currency based on user's language
    const getDefaultCurrency = (): WebCurrency => {
        const lang = i18n.language
        if (lang === 'ru') return 'rub'
        if (lang === 'de' || lang === 'fr') return 'eur'
        return 'usd'
    }

    const [activeMethod, setActiveMethod] = useState<PaymentMethod>(isWebMode ? 'card' : 'stars')
    const [webCurrency, setWebCurrency] = useState<WebCurrency>(getDefaultCurrency())
    const [selectedPackage, setSelectedPackage] = useState<any>(
        isWebMode
            ? (getDefaultCurrency() === 'eur' ? PACKAGES_EUR[0] : PACKAGES_RUB[0])
            : PACKAGES_STARS[3]
    )
    const [loading, setLoading] = useState(false)
    const [customTokens, setCustomTokens] = useState('')
    const [isCustomMode, setIsCustomMode] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const [modalMaxHeight, setModalMaxHeight] = useState<string>('min(90vh, 800px)')

    // --- Token Charging state ---
    const [cardStep, setCardStep] = useState<CardStep>('package')
    const [savedCards, setSavedCards] = useState<SavedCard[]>([])
    const [savedCardsLoading, setSavedCardsLoading] = useState(false)
    const [selectedCard, setSelectedCard] = useState<SavedCard | null>(null)
    const [saveCardChecked, setSaveCardChecked] = useState(true)
    const [chargeStatus, setChargeStatus] = useState<'idle' | 'charging' | 'success' | 'failed'>('idle')
    const [deletingToken, setDeletingToken] = useState<string | null>(null)
    const [tokenChargingEnabled, setTokenChargingEnabled] = useState(true)

    // Capture modal height on open so keyboard resize doesn't shrink it (iOS Telegram)
    useEffect(() => {
        if (isOpen && isInTelegram) {
            setModalMaxHeight(`min(${window.innerHeight * 0.9}px, 800px)`)
        } else {
            setModalMaxHeight('min(90vh, 800px)')
        }
    }, [isOpen, isInTelegram])

    // Reset card step when modal opens/closes or method changes
    useEffect(() => {
        setCardStep('package')
        setSelectedCard(null)
        setChargeStatus('idle')
    }, [isOpen, activeMethod])

    // Fetch saved cards when entering payment method step
    useEffect(() => {
        if (cardStep === 'payment-method' && activeMethod === 'card' && tokenChargingEnabled) {
            fetchSavedCards()
        }
    }, [cardStep, activeMethod, tokenChargingEnabled])

    useEffect(() => {
        if (isOpen && activeMethod === 'card') {
            fetchSavedCards()
        }
    }, [isOpen, activeMethod])

    const fetchSavedCards = async () => {
        setSavedCardsLoading(true)
        try {
            const response = await fetch('/api/tribute/saved-cards', {
                headers: { ...getAuthHeaders() },
            })
            const data = await response.json()
            if (typeof data.tokenChargingEnabled === 'boolean') {
                setTokenChargingEnabled(data.tokenChargingEnabled)
            }
            if (data.tokenChargingEnabled === false) {
                setSavedCards([])
                setSelectedCard(null)
                return
            }
            if (data.success && Array.isArray(data.cards)) {
                setSavedCards(data.cards)
            }
        } catch (e) {
            console.error('Failed to fetch saved cards:', e)
        } finally {
            setSavedCardsLoading(false)
        }
    }

    const handleDeleteCard = async (token: string) => {
        setDeletingToken(token)
        try {
            const response = await fetch(`/api/tribute/saved-cards/${token}`, {
                method: 'DELETE',
                headers: { ...getAuthHeaders() },
            })
            const data = await response.json()
            if (data.success) {
                setSavedCards(prev => prev.filter(c => c.token !== token))
                if (selectedCard?.token === token) setSelectedCard(null)
                impact('light')
            }
        } catch (e) {
            console.error('Failed to delete card:', e)
        } finally {
            setDeletingToken(null)
        }
    }

    const handleChargeWithSavedCard = async (card: SavedCard) => {
        impact('medium')
        setChargeStatus('charging')

        const customCount = isCustomMode ? parseInt(customTokens) : 0
        const body = isCustomMode
            ? { customTokens: customCount, currency: webCurrency, token: card.token }
            : { packageId: selectedPackage.id, currency: webCurrency, token: card.token }

        try {
            const response = await fetch('/api/tribute/charge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify(body),
            })
            const data = await response.json()

            if (data.success && (data.status === 'success' || data.status === 'processing')) {
                setChargeStatus('success')
                impact('heavy')
                setTimeout(() => {
                    onClose()
                    setChargeStatus('idle')
                    setCardStep('package')
                }, 2000)
            } else {
                setChargeStatus('failed')
                impact('error' as any)
            }
        } catch (e) {
            console.error('Charge error:', e)
            setChargeStatus('failed')
        }
    }

    // Get packages based on method and currency
    const getPackages = () => {
        if (activeMethod === 'stars') return PACKAGES_STARS
        if (webCurrency === 'eur') return PACKAGES_EUR
        if (webCurrency === 'usd') return PACKAGES_USD
        return PACKAGES_RUB
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
    const currencySymbol = activeMethod === 'stars' ? '⭐' : (webCurrency === 'eur' ? '€' : webCurrency === 'usd' ? '$' : '₽')

    // Get current price label for the selected package/custom amount
    const getCurrentPriceLabel = (): string => {
        if (isCustomMode && customTokens) {
            const count = parseInt(customTokens)
            if (activeMethod === 'stars' && count >= MIN_CUSTOM_STARS_TOKENS && count <= MAX_CUSTOM_STARS_TOKENS) {
                return `${calculateStarsForTokens(count)} ⭐`
            }
            if (activeMethod === 'card' && count >= MIN_CUSTOM_TOKENS && count <= MAX_CUSTOM_TOKENS) {
                return calculateCustomTokenPrice(count, webCurrency).priceLabel
            }
        }
        return selectedPackage.priceLabel || `${selectedPackage.price} ${currencySymbol}`
    }

    const handleCardNextStep = () => {
        const customCount = isCustomMode ? parseInt(customTokens) : 0
        if (isCustomMode && (!customCount || customCount < MIN_CUSTOM_TOKENS || customCount > MAX_CUSTOM_TOKENS)) {
            return
        }
        if (!tokenChargingEnabled) {
            void handlePayment()
            return
        }
        impact('medium')
        setCardStep('payment-method')
    }

    const handlePayment = async () => {
        impact('medium')
        if (activeMethod === 'stars') {
            // Validate custom mode for Stars
            const starsCustomCount = isCustomMode ? parseInt(customTokens) : 0
            if (isCustomMode && (!starsCustomCount || starsCustomCount < MIN_CUSTOM_STARS_TOKENS || starsCustomCount > MAX_CUSTOM_STARS_TOKENS)) {
                return
            }

            // In dev mode, redirect to hub bot for Stars payment
            if (isDevMode()) {
                const wa = (window as any).Telegram?.WebApp
                const tokensForLink = isCustomMode ? starsCustomCount : selectedPackage.tokens
                const link = `https://t.me/aiverse_hub_bot?start=pay-stars-${tokensForLink}`
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
                const customCount = isCustomMode ? parseInt(customTokens) : 0
                const starsBody = (isCustomMode && customCount >= MIN_CUSTOM_STARS_TOKENS && customCount <= MAX_CUSTOM_STARS_TOKENS)
                    ? { customTokens: customCount }
                    : { packageId: selectedPackage.id }

                const response = await fetch('/api/payment/create-stars-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    body: JSON.stringify(starsBody)
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
            // Card Payment — new card via Tribute Shop API
            const customCount = isCustomMode ? parseInt(customTokens) : 0
            if (isCustomMode && (!customCount || customCount < MIN_CUSTOM_TOKENS || customCount > MAX_CUSTOM_TOKENS)) {
                return
            }

            setLoading(true)
            try {
                const saveCard = tokenChargingEnabled ? saveCardChecked : false
                const body = isCustomMode
                    ? { customTokens: customCount, currency: webCurrency, saveCard }
                    : { packageId: selectedPackage.id, currency: webCurrency, saveCard }

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

    // --- Render Payment Method Step (Step 2) ---
    const renderPaymentMethodStep = () => (
        <>
            {/* Header with Back button */}
            <div className="p-5 pb-3 flex justify-between items-start shrink-0">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { impact('light'); setCardStep('package'); setChargeStatus('idle') }}
                        className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-white">{t('payment.savedCards.title', 'Способ оплаты')}</h2>
                        <p className="text-xs text-zinc-400 mt-0.5">{getCurrentPriceLabel()}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="px-5 pt-1 pb-5 overflow-y-auto flex-1">
                {/* Charging overlay */}
                {chargeStatus === 'charging' && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <Loader2 size={40} className="text-violet-400 animate-spin" />
                        <p className="text-sm text-zinc-300 font-medium">{t('payment.savedCards.charging', 'Обработка оплаты...')}</p>
                    </div>
                )}

                {/* Success overlay */}
                {chargeStatus === 'success' && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check size={32} className="text-emerald-400" />
                        </div>
                        <p className="text-sm text-emerald-300 font-bold">{t('payment.savedCards.success', '✅ Оплата прошла!')}</p>
                    </div>
                )}

                {/* Failed overlay */}
                {chargeStatus === 'failed' && (
                    <div className="flex flex-col items-center justify-center py-8 gap-4">
                        <p className="text-sm text-red-400 font-bold">{t('payment.savedCards.failed', '❌ Оплата не прошла')}</p>
                        <button
                            onClick={() => setChargeStatus('idle')}
                            className="text-xs text-zinc-400 underline"
                        >
                            {t('payment.savedCards.tryAgain', 'Попробовать другой картой')}
                        </button>
                    </div>
                )}

                {/* Normal state — card list */}
                {chargeStatus === 'idle' && (
                    <>
                        {/* Saved cards list */}
                        {savedCardsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 size={24} className="text-zinc-400 animate-spin" />
                            </div>
                        ) : savedCards.length > 0 ? (
                            <div className="space-y-2 mb-4">
                                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wide mb-2">
                                    {t('payment.savedCards.saved', 'Сохранённые карты')}
                                </p>
                                {savedCards.map(card => (
                                    <div
                                        key={card.token}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${selectedCard?.token === card.token
                                            ? 'bg-violet-600/10 border-violet-500 ring-1 ring-violet-500'
                                            : 'bg-zinc-800/50 border-white/5 hover:bg-zinc-800'
                                            }`}
                                        onClick={() => { impact('light'); setSelectedCard(card) }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <CreditCard size={18} className={selectedCard?.token === card.token ? 'text-violet-400' : 'text-zinc-400'} />
                                            <div>
                                                <p className="text-sm font-bold text-white">
                                                    {getCardBrandIcon(card.cardBrand)} •••• {card.cardLast4}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.token) }}
                                            disabled={deletingToken === card.token}
                                            className="w-7 h-7 rounded-full bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition-colors"
                                        >
                                            {deletingToken === card.token
                                                ? <Loader2 size={12} className="animate-spin" />
                                                : <Trash2 size={12} />
                                            }
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {/* Divider */}
                        {savedCards.length > 0 && (
                            <div className="flex items-center gap-3 my-3">
                                <div className="flex-1 h-px bg-white/5" />
                                <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
                                    {t('payment.savedCards.or', 'или')}
                                </span>
                                <div className="flex-1 h-px bg-white/5" />
                            </div>
                        )}

                        {/* New card option */}
                        <div
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${!selectedCard
                                ? 'bg-violet-600/10 border-violet-500 ring-1 ring-violet-500'
                                : 'bg-zinc-800/50 border-white/5 hover:bg-zinc-800'
                                }`}
                            onClick={() => { impact('light'); setSelectedCard(null) }}
                        >
                            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                                <CreditCard size={16} className="text-violet-400" />
                            </div>
                            <p className="text-sm font-bold text-white">
                                {t('payment.savedCards.newCard', '+ Новая карта')}
                            </p>
                        </div>

                        {/* Save card checkbox (for new card) */}
                        {!selectedCard && (
                            <label className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-zinc-800/30 border border-white/5 cursor-pointer select-none">
                                <div
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${saveCardChecked
                                        ? 'bg-violet-600 border-violet-500'
                                        : 'bg-transparent border-zinc-600'
                                        }`}
                                    onClick={(e) => { e.preventDefault(); setSaveCardChecked(!saveCardChecked); impact('light') }}
                                >
                                    {saveCardChecked && <Check size={12} className="text-white" />}
                                </div>
                                <span className="text-xs text-zinc-300">
                                    {t('payment.savedCards.saveCheckbox', 'Сохранить карту для будущих покупок')}
                                </span>
                            </label>
                        )}
                    </>
                )}
            </div>

            {/* Footer Action */}
            {chargeStatus === 'idle' && (
                <div className="p-5 pt-0 mt-auto shrink-0">
                    <button
                        onClick={() => {
                            if (selectedCard) {
                                handleChargeWithSavedCard(selectedCard)
                            } else {
                                handlePayment()
                            }
                        }}
                        disabled={loading}
                        className="w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg text-sm bg-white text-black hover:bg-zinc-200 shadow-white/10"
                    >
                        {loading ? t('payment.button.processing') : (
                            selectedCard
                                ? `${t('payment.button.paySimple')} ${getCurrentPriceLabel()} •••• ${selectedCard.cardLast4}`
                                : `${t('payment.button.paySimple')} ${getCurrentPriceLabel()}`
                        )}
                    </button>
                </div>
            )}
        </>
    )

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col" style={{ maxHeight: modalMaxHeight }}>

                {/* Step 2: Payment Method Selection (card only) */}
                {activeMethod === 'card' && tokenChargingEnabled && cardStep === 'payment-method' ? (
                    renderPaymentMethodStep()
                ) : (
                    <>
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
                                        onClick={() => { impact('light'); setWebCurrency('usd') }}
                                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${webCurrency === 'usd' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'}`}
                                    >
                                        <Globe size={12} /> USD ($)
                                    </button>
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
                                        {webCurrency === 'rub' ? (
                                            <>
                                                <MirIcon size={20} />
                                                <VisaIcon size={20} />
                                            </>
                                        ) : (
                                            <>
                                                <VisaIcon size={20} />
                                                <MastercardIcon size={16} />
                                                <AmexIcon size={16} />
                                                <UnionPayIcon size={16} />
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
                        <div ref={scrollRef} className="px-5 pt-1 pb-5 overflow-y-auto">
                            {(() => {
                                const remainder = packages.length % 3
                                const fullRows = remainder === 0 ? packages : packages.slice(0, packages.length - remainder)
                                const lastRow = remainder === 0 ? [] : packages.slice(packages.length - remainder)

                                const renderPkg = (pkg: any) => {
                                    const isSelected = selectedPackage.id === pkg.id && !isCustomMode
                                    return (
                                        <button
                                            key={pkg.id}
                                            onClick={() => { impact('light'); setSelectedPackage(pkg); setIsCustomMode(false); setCustomTokens('') }}
                                            className={`relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all ${pkg.popular
                                                    ? (isSelected ? 'bg-gradient-to-b from-amber-500/20 to-yellow-600/20 border-amber-500 ring-1 ring-amber-500' : 'bg-gradient-to-b from-amber-500/10 to-yellow-600/10 border-amber-500/50')
                                                    : (isSelected ? 'bg-violet-600/10 border-violet-500 ring-1 ring-violet-500' : 'bg-zinc-800/50 border-white/5 hover:bg-zinc-800')
                                                }`}
                                        >
                                            {pkg.popular && (
                                                <span className="absolute -top-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[7px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                                                    {t('payment.packages.popular')}
                                                </span>
                                            )}
                                            <div className={`font-bold text-[13px] leading-tight ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                                                {isPromoActive() ? (
                                                    <>
                                                        <span className="line-through text-zinc-500 text-[11px]">{pkg.tokens}</span>
                                                        {' '}
                                                        <span className="text-emerald-400">{calculateBonusTokens(pkg.tokens)}</span>
                                                    </>
                                                ) : (
                                                    pkg.tokens
                                                )}
                                            </div>
                                            <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                                {pkg.priceLabel || `${pkg.price} ${currencySymbol}`}
                                            </div>
                                            {pkg.bonus && !isPromoActive() && (
                                                <div className="text-[8px] text-emerald-400 font-bold mt-0.5">{pkg.bonus}</div>
                                            )}
                                            {isPromoActive() && (
                                                <div className="text-[8px] text-emerald-400 font-bold mt-0.5">+{getBonusAmount(pkg.tokens)} 🎁</div>
                                            )}
                                        </button>
                                    )
                                }

                                return (
                                    <>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {fullRows.map(renderPkg)}
                                        </div>
                                        {lastRow.length > 0 && (
                                            <div className={`grid gap-1.5 mt-1.5 ${lastRow.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                                {lastRow.map(renderPkg)}
                                            </div>
                                        )}
                                    </>
                                )
                            })()}

                            {/* Custom Token Input */}
                            <div className="mt-3 pt-3 border-t border-white/5">
                                <div className="text-[11px] text-zinc-400 mb-2 text-center font-medium">
                                    {t('payment.customInput.label', 'Или введите своё количество')}
                                </div>
                                <div className="relative">
                                    <input
                                        ref={inputRef}
                                        type="number"
                                        min={activeMethod === 'stars' ? MIN_CUSTOM_STARS_TOKENS : MIN_CUSTOM_TOKENS}
                                        max={activeMethod === 'stars' ? MAX_CUSTOM_STARS_TOKENS : MAX_CUSTOM_TOKENS}
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
                                    const minTokens = activeMethod === 'stars' ? MIN_CUSTOM_STARS_TOKENS : MIN_CUSTOM_TOKENS
                                    const maxTokens = activeMethod === 'stars' ? MAX_CUSTOM_STARS_TOKENS : MAX_CUSTOM_TOKENS
                                    if (!count || count < minTokens) {
                                        return (
                                            <div className="text-xs text-red-400 mt-2 text-center font-medium">
                                                {t('payment.customInput.min', { min: minTokens })}
                                            </div>
                                        )
                                    }
                                    if (count > maxTokens) {
                                        return (
                                            <div className="text-xs text-red-400 mt-2 text-center font-medium">
                                                {t('payment.customInput.max', { max: maxTokens.toLocaleString() })}
                                            </div>
                                        )
                                    }
                                    if (activeMethod === 'stars') {
                                        const stars = calculateStarsForTokens(count)
                                        const bonus = getCustomStarsBonus(count)
                                        return (
                                            <div className="flex items-center justify-center gap-2 mt-2">
                                                <span className="text-sm text-white font-bold">{stars} ⭐</span>
                                                {bonus.bonusTokens > 0 && (
                                                    <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                        {bonus.label}
                                                    </span>
                                                )}
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
                        </div>

                        {/* Footer Action */}
                        <div className="p-5 pt-0 mt-auto shrink-0 space-y-3">
                            <button
                                onClick={activeMethod === 'card' ? handleCardNextStep : handlePayment}
                                disabled={loading}
                                className={`w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg text-sm ${activeMethod === 'stars'
                                    ? 'bg-[#0088cc] hover:bg-[#0077b5] text-white shadow-blue-900/20'
                                    : 'bg-white text-black hover:bg-zinc-200 shadow-white/10'
                                    }`}
                            >
                                {loading
                                    ? t('payment.button.processing')
                                    : `${t('payment.button.paySimple')} ${getCurrentPriceLabel()}`
                                }
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
                    </>
                )}
            </div>
        </div>
    )
}
