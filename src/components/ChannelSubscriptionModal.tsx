import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Gift, ExternalLink, Check } from 'lucide-react'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'

export function ChannelSubscriptionModal() {
    const { t } = useTranslation()
    const { user, tg } = useTelegram()
    const { impact, notify } = useHaptics()
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [claimed, setClaimed] = useState(false)

    useEffect(() => {
        if (!user?.id) return

        const checkStatus = async () => {
            try {
                const res = await fetch(`/api/user/channel-subscription/${user.id}`)
                const data = await res.json()

                console.log('Channel Subscription Check:', data)

                // Show if not claimed
                if (data && !data.rewardClaimed) {
                    // Check if user has dismissed it recently (7 days cooldown)
                    const dismissedAt = localStorage.getItem('channel_sub_dismissed_at')
                    const now = Date.now()
                    const sevenDays = 7 * 24 * 60 * 60 * 1000

                    if (dismissedAt) {
                        console.log('Dismissed at:', new Date(parseInt(dismissedAt)).toLocaleString())
                        console.log('Cooldown remaining (days):', (sevenDays - (now - parseInt(dismissedAt))) / (24 * 60 * 60 * 1000))
                    }

                    if (!dismissedAt || (now - parseInt(dismissedAt) > sevenDays)) {
                        console.log('Showing subscription popup')
                        setTimeout(() => {
                            setIsOpen(true)
                            impact('light')
                        }, 1500)
                    } else {
                        console.log('Popup prevented by cooldown')
                    }
                } else {
                    console.log('Reward already claimed')
                }
            } catch (e) {
                console.error('Failed to check subscription status', e)
            }
        }

        checkStatus()
    }, [user?.id])

    const handleClose = () => {
        impact('light')
        setIsOpen(false)
        localStorage.setItem('channel_sub_dismissed_at', Date.now().toString())
    }

    const handleSubscribe = () => {
        impact('medium')
        tg.openTelegramLink('https://t.me/aiversebots')
    }

    const handleClaim = async () => {
        if (claimed || loading) return
        setLoading(true)
        impact('medium')
        try {
            const res = await fetch('/api/user/claim-channel-reward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            })
            const data = await res.json()
            if (data.success) {
                setClaimed(true)
                notify('success')
                setTimeout(() => {
                    setIsOpen(false)
                    // No need to persist dismiss since reward is claimed
                }, 2000)
            } else {
                notify('error')
            }
        } catch (e) {
            console.error(e)
            notify('error')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300">

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Content */}
                <div className="p-6 flex flex-col items-center text-center">

                    {/* Icon/Image */}
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20 mb-5 relative group">
                        <Gift size={32} className="text-white drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
                        {/* Decorative sparkles */}
                        <div className="absolute -top-2 -right-2 text-yellow-300 animate-pulse">✨</div>
                        <div className="absolute bottom-0 -left-2 text-yellow-300 animate-pulse delay-75">✨</div>
                    </div>

                    <h2 className="text-xl font-bold text-white mb-2">
                        {claimed ? t('rewards.success', '+20 tokens claimed!') : t('rewards.subscribe', 'Subscribe → +20 tokens')}
                    </h2>

                    <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                        {t('rewards.modalDescription', 'Subscribe to our channel and get bonus tokens!')}
                    </p>

                    {/* Buttons */}
                    <div className="w-full space-y-3">
                        {!claimed && (
                            <>
                                <button
                                    onClick={handleSubscribe}
                                    className="w-full h-12 rounded-xl bg-[#2AABEE] hover:bg-[#229ED9] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                                >
                                    <ExternalLink size={18} />
                                    {t('rewards.subscribe', 'Subscribe').split('→')[0].trim()}
                                </button>

                                <button
                                    onClick={handleClaim}
                                    disabled={loading}
                                    className="w-full h-12 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                                >
                                    {loading ? (
                                        <span>{t('rewards.checking', 'Checking...')}</span>
                                    ) : (
                                        <>
                                            <Check size={18} />
                                            {t('rewards.claim', 'Claim')}
                                        </>
                                    )}
                                </button>
                            </>
                        )}

                        {claimed && (
                            <div className="w-full py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 font-bold text-sm flex items-center justify-center gap-2">
                                <Check size={18} />
                                {t('rewards.success')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
