import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Sparkles, Zap, Info, X } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { Wheel } from '@/components/Wheel'
import { toast } from 'sonner'

// Segments matching Backend Logic
const RAW_SEGMENTS = [
    { value: 500, type: 'token', label: '500', color: 'url(#sliceGold)', textColor: 'white' },
    { value: 25, type: 'token', label: '25', color: 'url(#sliceZinc)' },
    { value: 50, type: 'token', label: '50', color: 'url(#sliceSky)' },
    { value: 100, type: 'token', label: '100', color: 'url(#sliceZinc)' },
    { value: 50, type: 'token', label: '50', color: 'url(#sliceFuchsia)' },
    { value: 25, type: 'token', label: '25', color: 'url(#sliceZinc)' },
    { value: 250, type: 'token', label: '250', color: 'url(#sliceViolet)' },
    { value: 50, type: 'token', label: '50', color: 'url(#sliceZinc)' },
    { value: 200, type: 'token', label: '200', color: 'url(#sliceViolet)' },
    { value: 75, type: 'token', label: '75', color: 'url(#sliceZinc)' },
    { value: 120, type: 'token', label: '120', color: 'url(#sliceCyan)' },
    { value: 50, type: 'token', label: '50', color: 'url(#sliceZinc)' },
]

export default function SpinPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { impact, notify } = useHaptics()
    const { user, platform, tg } = useTelegram()

    const isFromDeepLink = location.state?.fromDeepLink

    const [balance, setBalance] = useState<number | null>(null)
    const [spins, setSpins] = useState<number>(0)
    const [loading, setLoading] = useState(false)
    const [spinning, setSpinning] = useState(false)
    const [rotation, setRotation] = useState(0)
    const [result, setResult] = useState<any>(null)
    const resultRef = useRef<any>(null) // Ref для хранения актуального результата
    const [showResultModal, setShowResultModal] = useState(false)
    const [modalResult, setModalResult] = useState<any>(null) // Результат для показа в попапе
    const [showInfoModal, setShowInfoModal] = useState(false)
    const [eventDisabled, setEventDisabled] = useState(false)

    // Fetch Info and check event status
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.id) return

            setLoading(true)

            // Check event status first
            try {
                const eventRes = await fetch('/api/events/status/spin')
                const eventData = await eventRes.json()
                if (!eventData.enabled) {
                    setEventDisabled(true)
                    setLoading(false)
                    return
                }
            } catch (e) {
                console.error('Failed to check event status', e)
            }

            // Then fetch user info
            try {
                const r = await fetch(`/api/user/info/${user.id}`)
                const j = await r.json().catch(() => null)
                if (r.ok && j) {
                    setBalance(j.balance)
                    setSpins(j.spins || 0)
                }
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [user?.id])

    const handleSpin = async () => {
        if (spinning || loading || spins < 1) return

        impact('heavy')
        setSpinning(true)
        setResult(null)
        // Закрываем попап если он был открыт от предыдущего спина
        setShowResultModal(false)
        setModalResult(null)

        try {
            const r = await fetch('/api/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user?.id })
            })
            const j = await r.json().catch(() => null)

            // Check if event was disabled
            if (j?.event_disabled) {
                setEventDisabled(true)
                setSpinning(false)
                toast.error('Событие временно недоступно')
                return
            }

            if (!r.ok || !j.success) {
                toast.error(j?.error || 'Ошибка вращения')
                setSpinning(false)
                return
            }

            const segmentAngle = 360 / RAW_SEGMENTS.length
            // Randomize landing position within the segment (safe zone +/- 40%)
            const randomOffset = (Math.random() - 0.5) * (segmentAngle * 0.8)
            const nextRotation = rotation + 1800 + (360 - (j.prizeIndex * segmentAngle)) + randomOffset

            console.log('🎰 SPIN RESULT:', {
                prizeIndex: j.prizeIndex,
                prizeValue: j.prizeValue,
                newBalance: j.newBalance
            })

            setRotation(nextRotation)
            setResult(j)
            resultRef.current = j // Сохраняем актуальный результат в ref
            console.log('🎰 resultRef.current set to:', resultRef.current?.prizeValue)
            setSpins(s => Math.max(0, s - 1))

        } catch (e) {
            setSpinning(false)
            toast.error('Ошибка сети')
        }
    }

    const handleSpinEnd = () => {
        setSpinning(false)
        const currentResult = resultRef.current
        console.log('🎰 handleSpinEnd called, currentResult:', currentResult?.prizeValue)

        setTimeout(() => {
            console.log('🎰 setTimeout callback, showing modal with:', currentResult?.prizeValue)
            impact('heavy')
            notify('success')
            // Сохраняем результат для попапа ПЕРЕД открытием
            setModalResult(currentResult)
            setShowResultModal(true)
            if (currentResult) {
                setBalance(currentResult.newBalance)
            }
        }, 1000)
    }

    useEffect(() => {
        // При входе через deeplink — не показываем BackButton,
        // пользователь может закрыть приложение нативной кнопкой закрытия Telegram
        if (platform === 'ios' || platform === 'android') {
            if (isFromDeepLink) {
                // Не показываем BackButton при входе через deeplink
                tg.BackButton.hide()
                return
            }
            tg.BackButton.show()
            tg.BackButton.onClick(() => navigate(-1))
            return () => {
                tg.BackButton.hide()
                tg.BackButton.offClick(() => navigate(-1))
            }
        }
    }, [platform, navigate, tg, isFromDeepLink])

    // Specific Margin to counteract App.tsx padding and fill background
    const getMarginTop = () => {
        if (platform === 'ios') return 'calc(-1 * env(safe-area-inset-top))'
        if (platform === 'android') return 'calc(-1 * (env(safe-area-inset-top) + 24px))'
        return '0px'
    }

    // Tighter padding to put elements close to the bar
    const getPaddingTop = () => {
        // Global header is roughly 50px-60px. We want to be just below it.
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 55px)'
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 85px)'
        return '80px'
    }

    const getPaddingBottom = () => {
        if (platform === 'android') return 'calc(6.5rem + env(safe-area-inset-bottom))'
        return 'calc(5rem + env(safe-area-inset-bottom))'
    }

    return (
        <div
            className="min-h-dvh bg-gradient-to-b from-violet-950/50 via-black to-black flex flex-col overflow-hidden relative"
            style={{
                marginTop: getMarginTop(),
                paddingTop: getPaddingTop(),
                paddingBottom: getPaddingBottom()
            }}
        >
            {/* Event Disabled State */}
            {eventDisabled && (
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                    <div className="w-20 h-20 mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
                        <Sparkles size={36} className="text-zinc-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Событие недоступно</h2>
                    <p className="text-zinc-400 mb-6 max-w-xs">
                        Колесо Фортуны временно недоступно. Следите за обновлениями!
                    </p>
                    <button
                        onClick={() => navigate('/events')}
                        className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-xl text-white font-medium active:scale-95 transition-transform"
                    >
                        Вернуться к событиям
                    </button>
                </div>
            )}

            {/* Main Content - only show if event is not disabled */}
            {!eventDisabled && (
                <div className="flex-1 flex flex-col px-4 pb-6">
                    {/* Header - fixed at top */}
                    <div className={`flex items-center justify-between shrink-0 z-10 relative mb-4`}>
                        <div className="flex items-center gap-3">
                            {(platform !== 'ios' && platform !== 'android') && (
                                <button
                                    onClick={() => navigate(-1)}
                                    className="w-10 h-10 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/80 active:scale-95 transition-transform"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                            )}
                            <h1 className="text-xl font-bold text-white/90 tracking-wide">Фортуна</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { impact('light'); setShowInfoModal(true) }}
                                className="w-8 h-8 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-white/90 active:scale-95 transition-all"
                            >
                                <Info size={16} />
                            </button>
                            <div className="flex items-center gap-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-3 py-1.5">
                                <Zap size={14} className="text-amber-400 fill-amber-400" />
                                {loading ? (
                                    <div className="h-4 w-10 bg-white/10 rounded animate-pulse" />
                                ) : (
                                    <span className="text-sm font-semibold text-white/90">{balance ?? '...'}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Game Area - aligned from bottom */}
                    <div className="flex-1 flex flex-col justify-end min-h-0 relative">
                        {/* Ambient Glow */}
                        <div className="absolute inset-x-0 bottom-1/3 h-1/2 pointer-events-none">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-full bg-violet-600/15 blur-[100px] rounded-full" />
                        </div>

                        {/* Wheel - positioned above controls */}
                        <div className="relative w-full max-w-[85vw] sm:max-w-sm mx-auto shrink-0 mb-4">
                            <Wheel
                                segments={RAW_SEGMENTS}
                                rotation={rotation}
                                isSpinning={spinning}
                                onSpinEnd={handleSpinEnd}
                                pointerY={(platform === 'ios' || platform === 'android') ? -20 : 3}
                            />
                        </div>

                        {/* Controls - at bottom above tab bar */}
                        <div className="w-full max-w-sm mx-auto space-y-4 shrink-0 z-10">
                            {/* Spins Badge */}
                            <div className="flex justify-center">
                                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/15">
                                    <span className="text-white/60 text-xs font-medium uppercase tracking-wider">Доступно:</span>
                                    {loading ? (
                                        <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
                                    ) : (
                                        <span className={`text-sm font-bold ${spins > 0 ? 'text-white' : 'text-rose-400'}`}>
                                            {spins} спинов
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Spin Button */}
                            <button
                                onClick={handleSpin}
                                disabled={spinning || spins < 1}
                                className={`relative w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 ${spins < 1
                                    ? 'bg-white/5 backdrop-blur-md border border-white/5 text-white/30 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30'
                                    }`}
                                style={spins >= 1 && !spinning ? {
                                    animation: 'pulse-glow 2s ease-in-out infinite',
                                } : {}}
                            >
                                {spinning ? (
                                    <span className="animate-pulse">Крутим...</span>
                                ) : (
                                    <>
                                        <Sparkles size={18} className="opacity-90" />
                                        КРУТИТЬ
                                    </>
                                )}
                            </button>

                            {spins < 1 && !spinning && (
                                <p className="text-xs text-white/40 text-center">
                                    Пополните баланс от 300 токенов, чтобы получить спины
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Result Modal */}
            {showResultModal && modalResult && (() => {
                const isBigWin = modalResult.prizeValue >= 200
                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md px-4">
                        {/* Confetti for big wins */}
                        {isBigWin && (
                            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                                {[...Array(50)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="confetti"
                                        style={{
                                            left: `${Math.random() * 100}%`,
                                            animationDelay: `${Math.random() * 3}s`,
                                            backgroundColor: ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'][Math.floor(Math.random() * 6)],
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        <div
                            className={`relative border rounded-3xl p-8 w-full max-w-sm text-center space-y-6 shadow-2xl ${isBigWin
                                ? 'bg-gradient-to-b from-violet-950/95 via-zinc-900/95 to-zinc-900/95 border-violet-500/30'
                                : 'bg-zinc-900/95 border-white/10'
                                }`}
                            style={{
                                animation: 'modal-appear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }}
                        >
                            {/* Glow effect for big wins */}
                            {isBigWin && (
                                <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-violet-600/20 rounded-3xl blur-xl -z-10" />
                            )}

                            {/* Icon */}
                            <div className={`relative w-24 h-24 mx-auto rounded-full flex items-center justify-center ${isBigWin
                                ? 'bg-gradient-to-br from-amber-400 via-yellow-500 to-orange-500 shadow-xl shadow-amber-500/40'
                                : 'bg-gradient-to-br from-violet-400 to-fuchsia-500 shadow-lg shadow-violet-500/30'
                                }`}
                                style={isBigWin ? { animation: 'icon-pulse 1.5s ease-in-out infinite' } : {}}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    className={`${isBigWin ? 'w-12 h-12' : 'w-10 h-10'}`}
                                >
                                    <path
                                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                                        fill={isBigWin ? '#1a1a1a' : '#ffffff'}
                                        stroke={isBigWin ? '#1a1a1a' : '#ffffff'}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                {isBigWin && (
                                    <div className="absolute -inset-2 rounded-full border-2 border-amber-400/50" style={{ animation: 'ring-expand 1.5s ease-out infinite' }} />
                                )}
                            </div>

                            {/* Content */}
                            <div className="space-y-3">
                                <h2 className={`text-2xl font-bold ${isBigWin ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500' : 'text-white'}`}>
                                    {isBigWin ? '🎉 Джекпот!' : 'Поздравляем!'}
                                </h2>
                                <p className="text-zinc-400 font-medium">Вы выиграли:</p>
                                <div className={`text-5xl font-black py-2 ${isBigWin
                                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-400'
                                    : 'text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400'
                                    }`}
                                    style={isBigWin ? { animation: 'value-glow 2s ease-in-out infinite' } : {}}
                                >
                                    +{modalResult.prizeValue}
                                </div>
                                <p className="text-zinc-500 text-sm font-medium uppercase tracking-wider">токенов</p>
                            </div>

                            {/* Button */}
                            <button
                                onClick={() => {
                                    setShowResultModal(false)
                                    setModalResult(null)
                                    setResult(null)
                                    resultRef.current = null
                                    // Сбрасываем колесо в начальное положение
                                    setRotation(0)
                                }}
                                className={`w-full py-4 rounded-xl font-bold text-base active:scale-95 transition-all ${isBigWin
                                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/30'
                                    : 'bg-white text-black shadow-lg'
                                    }`}
                            >
                                Забрать! ✨
                            </button>
                        </div>
                    </div>
                )
            })()}

            {/* Info Modal */}
            {showInfoModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md px-4">
                    <div
                        className="bg-zinc-900/95 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
                        style={{ animation: 'modal-appear 0.3s ease-out' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold text-white">Колесо Фортуны</h2>
                            <button
                                onClick={() => setShowInfoModal(false)}
                                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white active:scale-95 transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Description */}
                        <p className="text-zinc-400 text-sm mb-5">
                            Крутите колесо и выигрывайте токены! Все сегменты имеют равные шансы выпадения.
                        </p>

                        {/* Odds Table */}
                        <div className="space-y-2 mb-5">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Шансы выпадения</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { prize: '50 токенов', chance: '32.5%', color: 'bg-sky-600/30' },
                                    { prize: '25 токенов', chance: '24%', color: 'bg-zinc-700' },
                                    { prize: '75 токенов', chance: '11%', color: 'bg-zinc-700' },
                                    { prize: '100 токенов', chance: '10%', color: 'bg-zinc-700' },
                                    { prize: '120 токенов', chance: '9.5%', color: 'bg-cyan-600/30' },
                                    { prize: '200 токенов', chance: '4%', color: 'bg-violet-600/30' },
                                    { prize: '250 токенов', chance: '3%', color: 'bg-violet-600/30' },
                                    { prize: '500 токенов', chance: '1%', color: 'bg-amber-600/30' },
                                ].map((item, i) => (
                                    <div key={i} className={`${item.color} rounded-xl px-3 py-2 flex justify-between items-center`}>
                                        <span className="text-white text-sm font-medium">{item.prize}</span>
                                        <span className="text-white/60 text-xs">{item.chance}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* How to get spins */}
                        <div className="bg-white/5 rounded-xl p-4 mb-5">
                            <h4 className="text-white font-semibold text-sm mb-2">Как получить спины?</h4>
                            <ul className="text-zinc-400 text-xs space-y-1.5">
                                <li>• Пополните от 300 токенов → 1 спин</li>
                                <li>• Пополните от 800 токенов → 2 спина</li>
                                <li>• Пополните от 1500 токенов → 3 спина</li>
                            </ul>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setShowInfoModal(false)}
                            className="w-full py-3.5 bg-white/10 text-white rounded-xl font-bold text-sm active:scale-95 transition-transform"
                        >
                            Понятно
                        </button>
                    </div>
                </div>
            )}

            {/* CSS Animations */}
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { 
                        box-shadow: 0 10px 25px -5px rgba(139, 92, 246, 0.4);
                    }
                    50% { 
                        box-shadow: 0 10px 35px -5px rgba(139, 92, 246, 0.6);
                    }
                }
                @keyframes modal-appear {
                    from {
                        opacity: 0;
                        transform: scale(0.8) translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                @keyframes icon-pulse {
                    0%, 100% { 
                        transform: scale(1);
                    }
                    50% { 
                        transform: scale(1.05);
                    }
                }
                @keyframes ring-expand {
                    0% { 
                        transform: scale(1);
                        opacity: 1;
                    }
                    100% { 
                        transform: scale(1.4);
                        opacity: 0;
                    }
                }
                @keyframes value-glow {
                    0%, 100% { 
                        filter: brightness(1);
                    }
                    50% { 
                        filter: brightness(1.2);
                    }
                }
                @keyframes confetti-fall {
                    0% {
                        transform: translateY(-100vh) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }
                .confetti {
                    position: absolute;
                    width: 10px;
                    height: 10px;
                    top: -20px;
                    border-radius: 2px;
                    animation: confetti-fall 4s linear forwards;
                }
            `}</style>
        </div >
    )
}
