import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Zap } from 'lucide-react'
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
    const { impact, notify } = useHaptics()
    const { user, platform, tg } = useTelegram()

    const [balance, setBalance] = useState<number | null>(null)
    const [spins, setSpins] = useState<number>(0)
    const [loading, setLoading] = useState(false)
    const [spinning, setSpinning] = useState(false)
    const [rotation, setRotation] = useState(0)
    const [result, setResult] = useState<any>(null)
    const [showResultModal, setShowResultModal] = useState(false)

    // Fetch Info
    useEffect(() => {
        if (user?.id) {
            setLoading(true)
            fetch(`/api/user/info/${user.id}`).then(async r => {
                const j = await r.json().catch(() => null)
                if (r.ok && j) {
                    setBalance(j.balance)
                    setSpins(j.spins || 0)
                }
            }).finally(() => setLoading(false))
        }
    }, [user?.id])

    const handleSpin = async () => {
        if (spinning || loading || spins < 1) return

        impact('heavy')
        setSpinning(true)
        setResult(null)

        try {
            const r = await fetch('/api/spin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user?.id })
            })
            const j = await r.json().catch(() => null)

            if (!r.ok || !j.success) {
                toast.error(j?.error || 'Ошибка вращения')
                setSpinning(false)
                return
            }

            const segmentAngle = 360 / RAW_SEGMENTS.length
            // Randomize landing position within the segment (safe zone +/- 40%)
            const randomOffset = (Math.random() - 0.5) * (segmentAngle * 0.8)
            const nextRotation = rotation + 1800 + (360 - (j.prizeIndex * segmentAngle)) + randomOffset

            setRotation(nextRotation)
            setResult(j)
            setSpins(s => Math.max(0, s - 1))

        } catch (e) {
            setSpinning(false)
            toast.error('Ошибка сети')
        }
    }

    const handleSpinEnd = () => {
        setSpinning(false)
        setTimeout(() => {
            impact('heavy')
            notify('success')
            setShowResultModal(true)
            if (result) {
                setBalance(result.newBalance)
            }
        }, 1000)
    }

    useEffect(() => {
        if (platform === 'ios' || platform === 'android') {
            tg.BackButton.show()
            tg.BackButton.onClick(() => navigate(-1))
            return () => {
                tg.BackButton.hide()
                tg.BackButton.offClick(() => navigate(-1))
            }
        }
    }, [platform, navigate, tg])

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

    return (
        <div
            className="min-h-dvh bg-gradient-to-b from-violet-950/50 via-black to-black flex flex-col overflow-hidden relative safe-bottom-tabbar"
            style={{
                marginTop: getMarginTop(),
                paddingTop: getPaddingTop()
            }}
        >

            {/* Main Content */}
            <div className="flex-1 flex flex-col px-4 pb-4">
                {/* Header */}
                <div className={`flex items-center justify-between shrink-0 z-10 relative ${(platform === 'ios' || platform === 'android') ? 'mb-20' : 'mb-20'}`}>
                    {(platform !== 'ios' && platform !== 'android') && (
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/80 active:scale-95 transition-transform"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    {(platform === 'ios' || platform === 'android') && <div className="w-4" />} {/* Spacer for native back button alignment if needed, or just standard flex */}

                    <h1 className="text-xl font-bold text-white/90 tracking-wide">Fortune</h1>
                    <div className="flex items-center gap-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-3 py-1.5">
                        <Zap size={14} className="text-amber-400 fill-amber-400" />
                        <span className="text-sm font-semibold text-white/90">{balance ?? '...'}</span>
                    </div>
                </div>

                {/* Wheel Container - Centered */}
                <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative">
                    {/* Ambient Glow */}
                    <div className="absolute inset-x-0 top-1/4 h-1/2 pointer-events-none">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-full bg-violet-600/15 blur-[100px] rounded-full" />
                    </div>

                    {/* Wheel */}
                    <div className="relative w-full max-w-[85vw] sm:max-w-sm mx-auto shrink-0">
                        <Wheel
                            segments={RAW_SEGMENTS}
                            rotation={rotation}
                            isSpinning={spinning}
                            onSpinEnd={handleSpinEnd}
                            pointerY={(platform === 'ios' || platform === 'android') ? -20 : 3}
                        />
                    </div>

                    {/* Controls */}
                    <div className="w-full max-w-sm mx-auto mt-6 space-y-4 shrink-0 z-10">
                        {/* Spins Badge */}
                        <div className="flex justify-center">
                            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/15">
                                <span className="text-white/60 text-xs font-medium uppercase tracking-wider">Доступно:</span>
                                <span className={`text-sm font-bold ${spins > 0 ? 'text-white' : 'text-rose-400'}`}>
                                    {spins} спинов
                                </span>
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
                                    SPIN
                                </>
                            )}
                        </button>

                        {spins < 1 && !spinning && (
                            <p className="text-xs text-white/40 text-center">
                                Пополните баланс токенов, чтобы получить спины
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Result Modal */}
            {showResultModal && result && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
                    <div
                        className="bg-zinc-900/95 border border-white/10 rounded-3xl p-8 w-full max-w-sm text-center space-y-6 shadow-2xl"
                        style={{
                            animation: 'modal-appear 0.3s ease-out',
                        }}
                    >
                        {/* Icon */}
                        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-300 to-yellow-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30">
                            <Sparkles size={32} className="text-black" />
                        </div>

                        {/* Content */}
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-white">Поздравляем!</h2>
                            <p className="text-zinc-400 font-medium">Вы выиграли:</p>
                            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 py-2">
                                {result.prizeValue} Токенов
                            </div>
                        </div>

                        {/* Button */}
                        <button
                            onClick={() => setShowResultModal(false)}
                            className="w-full py-3.5 bg-white text-black rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
                        >
                            Отлично!
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
                        transform: scale(0.9) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
            `}</style>
        </div>
    )
}
