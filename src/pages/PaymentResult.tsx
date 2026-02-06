import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, Loader2, Home, RefreshCw } from 'lucide-react'

type PaymentStatus = 'success' | 'fail' | 'checking'

export function PaymentResult() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const [status, setStatus] = useState<PaymentStatus>('checking')
    const [tokens, setTokens] = useState<number | null>(null)

    // Determine status from URL path
    const isSuccess = location.pathname.includes('/success')
    const isFail = location.pathname.includes('/fail')

    useEffect(() => {
        if (isFail) {
            setStatus('fail')
            return
        }

        if (isSuccess) {
            // Check if we have order UUID to verify (from URL params or localStorage)
            const orderUuid = searchParams.get('order') || localStorage.getItem('tribute_order_uuid')
            if (orderUuid) {
                localStorage.removeItem('tribute_order_uuid')
                checkOrderStatus(orderUuid)
            } else {
                // Assume success if no UUID provided
                setStatus('success')
            }
        }
    }, [isSuccess, isFail, searchParams])

    const checkOrderStatus = async (uuid: string) => {
        try {
            const response = await fetch(`/api/tribute/order/${uuid}/status`)
            const data = await response.json()

            if (data.success && data.status === 'paid') {
                setStatus('success')
                setTokens(data.tokens)
            } else if (data.status === 'failed') {
                setStatus('fail')
            } else {
                // Still pending - show success anyway (webhook will process)
                setStatus('success')
            }
        } catch {
            // On error, show success page (webhook will handle actual processing)
            setStatus('success')
        }
    }

    const handleGoHome = () => {
        navigate('/')
    }

    const handleTryAgain = () => {
        navigate('/', { state: { openPayment: true } })
    }

    if (status === 'checking') {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-16 h-16 text-violet-500 animate-spin mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-white mb-2">
                        {t('paymentResult.checking', 'Checking payment status...')}
                    </h1>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                {status === 'success' ? (
                    <>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle className="w-12 h-12 text-emerald-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            {t('paymentResult.successTitle', 'Payment Successful!')}
                        </h1>
                        <p className="text-zinc-400 mb-6">
                            {tokens
                                ? t('paymentResult.successMessageWithTokens', 'Your {{tokens}} tokens have been credited to your account.', { tokens })
                                : t('paymentResult.successMessage', 'Your tokens will be credited shortly.')
                            }
                        </p>
                        <button
                            onClick={handleGoHome}
                            className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                        >
                            <Home size={20} />
                            {t('paymentResult.goHome', 'Go to Home')}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                            <XCircle className="w-12 h-12 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">
                            {t('paymentResult.failTitle', 'Payment Failed')}
                        </h1>
                        <p className="text-zinc-400 mb-6">
                            {t('paymentResult.failMessage', 'Something went wrong with your payment. Please try again.')}
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={handleTryAgain}
                                className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                <RefreshCw size={20} />
                                {t('paymentResult.tryAgain', 'Try Again')}
                            </button>
                            <button
                                onClick={handleGoHome}
                                className="w-full h-12 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                <Home size={20} />
                                {t('paymentResult.goHome', 'Go to Home')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
