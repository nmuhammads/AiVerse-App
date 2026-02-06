/**
 * Tribute Shop API Controller
 * Handles order creation and status checking for web payments
 */

import { Request, Response } from 'express'
import { createOrder, getOrderStatus, type TributeCurrency } from '../services/tributeService.js'
import { findPackage, getPackageTitle, getPackageDescription, calculateCustomPrice } from '../config/tokenPackages.js'
import { supaPost, supaSelect, supaPatch } from '../services/supabaseService.js'
import { logBalanceChange } from '../services/balanceAuditService.js'
import { tg } from './telegramController.js'
import { isPromoActive, calculateBonusTokens, getBonusAmount } from '../utils/promoUtils.js'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js'

const APP_URL = process.env.APP_URL || 'https://aiverse.app'

interface CreateOrderBody {
    packageId?: string
    customTokens?: number
    currency: TributeCurrency
    email?: string
}

/**
 * POST /api/tribute/create-order
 * Create a new Tribute order and return payment URL
 */
export async function createTributeOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { packageId, customTokens, currency, email } = req.body as CreateOrderBody
        const userId = req.user?.id

        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' })
            return
        }

        if (!currency || (currency !== 'eur' && currency !== 'rub')) {
            res.status(400).json({ success: false, error: 'Invalid currency. Must be "eur" or "rub"' })
            return
        }

        if (!packageId && !customTokens) {
            res.status(400).json({ success: false, error: 'Missing packageId or customTokens' })
            return
        }

        let orderAmount: number
        let orderTokens: number
        let orderTitle: string
        let orderDescription: string

        if (customTokens) {
            // Custom token amount
            if (customTokens < 50 || customTokens > 10000 || !Number.isInteger(customTokens)) {
                res.status(400).json({ success: false, error: 'customTokens must be an integer between 50 and 10000' })
                return
            }
            const calc = calculateCustomPrice(customTokens, currency)
            orderAmount = calc.amount
            orderTokens = calc.tokens
            orderTitle = `${calc.tokens} AiVerse Tokens`
            orderDescription = `Purchase ${calc.tokens} tokens for AI image generation`
        } else {
            // Predefined package
            const pkg = findPackage(packageId!, currency)
            if (!pkg) {
                res.status(400).json({ success: false, error: 'Package not found' })
                return
            }
            orderAmount = pkg.amount
            orderTokens = pkg.tokens
            orderTitle = getPackageTitle(pkg)
            orderDescription = getPackageDescription(pkg)
        }

        // Create Tribute order
        const tributeOrder = await createOrder({
            amount: orderAmount,
            currency: currency,
            title: orderTitle,
            description: orderDescription,
            successUrl: `${APP_URL}/payment/success`,
            failUrl: `${APP_URL}/payment/fail`,
            email: email,
            customerId: String(userId),
        })

        // Save order to database
        const orderData = {
            uuid: tributeOrder.uuid,
            user_id: userId,
            amount: orderAmount,
            currency: currency,
            tokens: orderTokens,
            status: 'pending',
            payment_url: tributeOrder.paymentUrl,
        }

        const saveResult = await supaPost('tribute_orders', orderData)
        if (!saveResult.ok) {
            console.error('[TributeController] Failed to save order:', saveResult.data)
            // Still return payment URL even if save failed - webhook will handle the payment
        }

        console.log(`[TributeController] Order created: ${tributeOrder.uuid} for user ${userId} (${orderTokens} tokens, ${orderAmount} ${currency})`)

        res.json({
            success: true,
            paymentUrl: tributeOrder.paymentUrl,
            orderUuid: tributeOrder.uuid,
        })
    } catch (error: any) {
        console.error('[TributeController] Error creating order:', error)
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create order'
        })
    }
}

/**
 * GET /api/tribute/order/:uuid/status
 * Check order status
 */
export async function checkOrderStatus(req: Request, res: Response): Promise<void> {
    try {
        const { uuid } = req.params

        if (!uuid) {
            res.status(400).json({ success: false, error: 'Missing order UUID' })
            return
        }

        // First check our database
        const localResult = await supaSelect('tribute_orders', `?uuid=eq.${uuid}&select=*`)
        if (localResult.ok && Array.isArray(localResult.data) && localResult.data.length > 0) {
            const order = localResult.data[0]

            // If order is still pending, check Tribute API and reconcile if needed
            if (order.status === 'pending') {
                try {
                    const tributeStatus = await getOrderStatus(uuid)
                    if (tributeStatus.status === 'paid') {
                        console.log(`[TributeController] Reconciling order ${uuid}: pending -> paid`)
                        await reconcilePayment(order)
                        res.json({
                            success: true,
                            status: 'paid',
                            tokens: order.tokens,
                            paidAt: new Date().toISOString(),
                        })
                        return
                    } else if (tributeStatus.status === 'failed') {
                        await supaPatch('tribute_orders', `?uuid=eq.${uuid}`, { status: 'failed' })
                        res.json({ success: true, status: 'failed' })
                        return
                    }
                } catch (e) {
                    console.warn(`[TributeController] Could not check Tribute API for ${uuid}:`, e)
                }
            }

            res.json({
                success: true,
                status: order.status,
                tokens: order.tokens,
                paidAt: order.paid_at,
            })
            return
        }

        // Fallback to Tribute API
        const tributeStatus = await getOrderStatus(uuid)
        res.json({
            success: true,
            status: tributeStatus.status,
        })
    } catch (error: any) {
        console.error('[TributeController] Error checking order status:', error)
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to check order status'
        })
    }
}

/**
 * Reconcile a pending order that was actually paid (webhook missed)
 */
async function reconcilePayment(order: any): Promise<void> {
    const userId = order.user_id
    const baseTokens = order.tokens

    const promoActive = isPromoActive()
    const tokensToAdd = promoActive ? calculateBonusTokens(baseTokens) : baseTokens
    const bonusTokens = promoActive ? getBonusAmount(baseTokens) : 0

    // Get current user balance
    const userResult = await supaSelect('users', `?user_id=eq.${userId}&select=balance,telegram_id`)
    if (!userResult.ok || !Array.isArray(userResult.data) || userResult.data.length === 0) {
        console.error(`[TributeController] Reconcile: User not found: ${userId}`)
        await supaPatch('tribute_orders', `?uuid=eq.${order.uuid}`, { status: 'paid', paid_at: new Date().toISOString() })
        return
    }

    const user = userResult.data[0]
    const currentBalance = Number(user.balance || 0)
    const newBalance = currentBalance + tokensToAdd

    // Update user balance
    await supaPatch('users', `?user_id=eq.${userId}`, { balance: newBalance })

    // Log balance change
    await logBalanceChange({
        userId,
        oldBalance: currentBalance,
        newBalance,
        reason: 'payment',
        referenceId: order.uuid,
        metadata: {
            source: 'tribute_web_reconcile',
            baseTokens,
            bonusTokens,
            promoActive,
            currency: order.currency,
            amount: order.amount,
        }
    })

    // Update order status
    await supaPatch('tribute_orders', `?uuid=eq.${order.uuid}`, { status: 'paid', paid_at: new Date().toISOString() })

    console.log(`[TributeController] Reconciled: user ${userId} balance ${currentBalance} -> ${newBalance}`)

    // Send Telegram notification
    const telegramId = user.telegram_id
    if (telegramId) {
        const promoText = promoActive ? `\n(Включая бонус +${bonusTokens} 🎁)` : ''
        const currencySymbol = order.currency === 'eur' ? '€' : '₽'
        const amountFormatted = (order.amount / 100).toFixed(2)

        await tg('sendMessage', {
            chat_id: telegramId,
            text: `✅ Оплата через карту прошла успешно!\n\n` +
                  `💰 Начислено: ${tokensToAdd} токенов${promoText}\n` +
                  `💳 Сумма: ${amountFormatted} ${currencySymbol}\n\n` +
                  `Спасибо за покупку! 🙏`
        })
    }
}

/**
 * GET /api/tribute/packages
 * Get available packages for currency
 */
export async function getPackagesList(req: Request, res: Response): Promise<void> {
    try {
        const currency = (req.query.currency as TributeCurrency) || 'eur'

        if (currency !== 'eur' && currency !== 'rub') {
            res.status(400).json({ success: false, error: 'Invalid currency' })
            return
        }

        const { getPackages } = await import('../config/tokenPackages.js')
        const packages = getPackages(currency)

        res.json({
            success: true,
            currency,
            packages,
        })
    } catch (error: any) {
        console.error('[TributeController] Error getting packages:', error)
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get packages'
        })
    }
}
