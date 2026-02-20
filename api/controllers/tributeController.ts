/**
 * Tribute Shop API Controller
 * Handles order creation and status checking for web payments
 */

import { Request, Response } from 'express'
import { createOrder, getOrderStatus, listTokens, createCharge, getCharge, deactivateToken, type TributeCurrency } from '../services/tributeService.js'
import { findPackage, getPackageTitle, getPackageDescription, calculateCustomPrice } from '../config/tokenPackages.js'
import { supaPost, supaSelect, supaPatch } from '../services/supabaseService.js'
import { logBalanceChange } from '../services/balanceAuditService.js'
import { processPartnerBonus } from '../services/partnerService.js'
import { tg } from './telegramController.js'
import { isPromoActive, calculateBonusTokens, getBonusAmount } from '../utils/promoUtils.js'
import { getSourceLabel } from '../utils/sourceLabels.js'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js'

const APP_URL = process.env.APP_URL || 'https://aiverse.app'
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const TRIBUTE_TOKEN_CHARGING_ENABLED = TRUE_VALUES.has((process.env.TRIBUTE_TOKEN_CHARGING_ENABLED || 'false').trim().toLowerCase())

interface CreateOrderBody {
    packageId?: string
    customTokens?: number
    currency: TributeCurrency
    email?: string
    saveCard?: boolean
    source?: string           // e.g. 'aiverse_hub_bot' — caller can identify itself
    successUrl?: string       // override default success redirect URL
    failUrl?: string          // override default fail redirect URL
}

/**
 * POST /api/tribute/create-order
 * Create a new Tribute order and return payment URL
 */
export async function createTributeOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { packageId, customTokens, currency, email, saveCard } = req.body as CreateOrderBody
        const userId = req.user?.id

        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' })
            return
        }

        if (!currency || (currency !== 'eur' && currency !== 'rub' && currency !== 'usd')) {
            res.status(400).json({ success: false, error: 'Invalid currency. Must be "eur", "rub" or "usd"' })
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

        // Get tribute_customer_id for secure Tribute identification
        const userResult = await supaSelect('users', `?user_id=eq.${userId}&select=tribute_customer_id`)
        const tributeCustomerId = userResult.ok && Array.isArray(userResult.data) && userResult.data.length > 0
            ? userResult.data[0].tribute_customer_id
            : String(userId) // fallback to user_id if tribute_customer_id not found

        // Create Tribute order
        const tributeOrder = await createOrder({
            amount: orderAmount,
            currency: currency,
            title: orderTitle,
            description: orderDescription,
            successUrl: req.body.successUrl || `${APP_URL}/payment/success`,
            failUrl: req.body.failUrl || `${APP_URL}/payment/fail`,
            email: email,
            customerId: tributeCustomerId,
            savePaymentMethod: TRIBUTE_TOKEN_CHARGING_ENABLED && saveCard === true,
        })

        // Save order to database
        const orderData: any = {
            uuid: tributeOrder.uuid,
            user_id: userId,
            amount: orderAmount,
            currency: currency,
            tokens: orderTokens,
            status: 'pending',
            payment_url: tributeOrder.paymentUrl,
        }
        if (req.body.source) orderData.source = req.body.source

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
    // ATOMIC CLAIM: Try to update the order to 'paid' where it is currently 'pending'
    const claimResult = await supaPatch('tribute_orders', `?uuid=eq.${order.uuid}&status=eq.pending`, {
        status: 'paid',
        paid_at: new Date().toISOString()
    }, true)

    // If no rows were returned, webhook already claimed it (race condition avoided)
    if (!claimResult.ok || !Array.isArray(claimResult.data) || claimResult.data.length === 0) {
        console.log(`[TributeController] Reconcile: Order ${order.uuid} already processed by webhook, skipping token credit.`)
        return
    }

    const userId = order.user_id
    const baseTokens = order.tokens

    const promoActive = isPromoActive()
    const tokensToAdd = promoActive ? calculateBonusTokens(baseTokens) : baseTokens
    const bonusTokens = promoActive ? getBonusAmount(baseTokens) : 0

    // Get current user balance
    const userResult = await supaSelect('users', `?user_id=eq.${userId}&select=balance,telegram_id,username,first_name,last_name`)
    if (!userResult.ok || !Array.isArray(userResult.data) || userResult.data.length === 0) {
        console.error(`[TributeController] Reconcile: User not found: ${userId}`)
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
    await processPartnerBonus(userId, order.amount, (order.currency || 'rub').toUpperCase())

    console.log(`[TributeController] Reconciled: user ${userId} balance ${currentBalance} -> ${newBalance}`)

    // Send Telegram notification
    const telegramId = user.telegram_id
    if (telegramId) {
        const promoText = promoActive ? `\n(Включая бонус +${bonusTokens} 🎁)` : ''
        const currencySymbol = order.currency === 'eur' ? '€' : order.currency === 'usd' ? '$' : '₽'
        const amountFormatted = (order.amount / 100).toFixed(2)

        await tg('sendMessage', {
            chat_id: telegramId,
            text: `✅ Оплата через карту прошла успешно!\n\n` +
                `💰 Начислено: ${tokensToAdd} токенов${promoText}\n` +
                `💳 Сумма: ${amountFormatted} ${currencySymbol}\n\n` +
                `Спасибо за покупку! 🙏`
        })
    }

    // Send notification to bot owner about reconciled payment
    const ownerTelegramId = process.env.OWNER_TELEGRAM_ID
    if (ownerTelegramId) {
        const userDisplay = user.username
            ? `@${user.username}`
            : `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Пользователь без имени'

        const currencySymbol = order.currency === 'eur' ? '€' : order.currency === 'usd' ? '$' : '₽'
        const amountFormatted = (order.amount / 100).toFixed(2)
        const promoText = promoActive ? ` (+${bonusTokens} бонус 🎁)` : ''
        const sourceLabel = getSourceLabel(order.source)

        await tg('sendMessage', {
            chat_id: ownerTelegramId,
            text: `🔔 Оплата согласована! (вебхук пропущен)\n\n` +
                `👤 Пользователь: ${userDisplay}\n` +
                `🆔 Telegram ID: ${telegramId}\n\n` +
                `💰 Оплачено: ${tokensToAdd} токенов${promoText}\n` +
                `💳 Сумма: ${amountFormatted} ${currencySymbol}\n` +
                `📍 Источник: ${sourceLabel}\n\n` +
                `🔗 Order ID: ${order.uuid}`
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

        if (currency !== 'eur' && currency !== 'rub' && currency !== 'usd') {
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

// ============ Saved Cards (Token Charging) ============

/**
 * GET /api/tribute/saved-cards
 * List user's saved payment methods
 */
export async function getSavedCards(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id
        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' })
            return
        }

        if (!TRIBUTE_TOKEN_CHARGING_ENABLED) {
            res.json({ success: true, cards: [], tokenChargingEnabled: false })
            return
        }

        // Get tribute_customer_id
        const userResult = await supaSelect('users', `?user_id=eq.${userId}&select=tribute_customer_id`)
        if (!userResult.ok || !Array.isArray(userResult.data) || userResult.data.length === 0) {
            res.json({ success: true, cards: [], tokenChargingEnabled: true })
            return
        }

        const tributeCustomerId = userResult.data[0].tribute_customer_id
        if (!tributeCustomerId) {
            res.json({ success: true, cards: [], tokenChargingEnabled: true })
            return
        }

        const tokens = await listTokens({ customerId: tributeCustomerId, active: true })
        const cards = tokens.map(t => ({
            token: t.token,
            cardLast4: t.cardLast4,
            cardBrand: t.cardBrand || 'CARD',
        }))

        res.json({ success: true, cards, tokenChargingEnabled: true })
    } catch (error: any) {
        console.error('[TributeController] Error getting saved cards:', error)
        // Don't expose internal errors — just return empty list
        res.json({
            success: true,
            cards: [],
            tokenChargingEnabled: TRIBUTE_TOKEN_CHARGING_ENABLED,
        })
    }
}

/**
 * POST /api/tribute/charge
 * Charge a saved payment method (token)
 */
export async function chargeWithSavedCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const { packageId, customTokens, currency, token: cardToken } = req.body as {
            packageId?: string
            customTokens?: number
            currency: TributeCurrency
            token: string // UUID of saved card token
        }
        const userId = req.user?.id

        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' })
            return
        }

        if (!TRIBUTE_TOKEN_CHARGING_ENABLED) {
            res.status(503).json({
                success: false,
                status: 'disabled',
                error: 'Saved-card payments are temporarily disabled',
            })
            return
        }

        if (!cardToken) {
            res.status(400).json({ success: false, error: 'Missing token (saved card UUID)' })
            return
        }

        if (!currency || (currency !== 'eur' && currency !== 'rub' && currency !== 'usd')) {
            res.status(400).json({ success: false, error: 'Invalid currency' })
            return
        }

        if (!packageId && !customTokens) {
            res.status(400).json({ success: false, error: 'Missing packageId or customTokens' })
            return
        }

        // Calculate order amount and tokens
        let orderAmount: number
        let orderTokens: number

        if (customTokens) {
            if (customTokens < 50 || customTokens > 10000 || !Number.isInteger(customTokens)) {
                res.status(400).json({ success: false, error: 'customTokens must be an integer between 50 and 10000' })
                return
            }
            const calc = calculateCustomPrice(customTokens, currency)
            orderAmount = calc.amount
            orderTokens = calc.tokens
        } else {
            const pkg = findPackage(packageId!, currency)
            if (!pkg) {
                res.status(400).json({ success: false, error: 'Package not found' })
                return
            }
            orderAmount = pkg.amount
            orderTokens = pkg.tokens
        }

        // Generate idempotency key to prevent double charges
        const idempotencyKey = `charge_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

        // Create charge via Tribute API
        console.log(`[TributeController] Creating charge: user ${userId}, token ${cardToken}, amount ${orderAmount} ${currency}`)
        const charge = await createCharge({
            token: cardToken,
            amount: orderAmount,
            reference: `user_${userId}_tokens_${orderTokens}`,
            idempotencyKey,
        })

        // Save order to database
        const orderData: any = {
            uuid: charge.chargeUuid,
            user_id: userId,
            amount: orderAmount,
            currency: currency,
            tokens: orderTokens,
            status: 'pending',
            payment_method: 'saved_card',
        }
        if (req.body.source) orderData.source = req.body.source
        await supaPost('tribute_orders', orderData)

        // Poll charge status (max 3 attempts, 2 sec interval)
        let finalStatus = charge.status
        for (let attempt = 0; attempt < 3 && (finalStatus === 'pending' || finalStatus === 'processing'); attempt++) {
            await new Promise(resolve => setTimeout(resolve, 2000))
            try {
                const updated = await getCharge(charge.chargeUuid)
                finalStatus = updated.status
                if (finalStatus === 'success' || finalStatus === 'failed') break
            } catch (e) {
                console.error(`[TributeController] Charge poll attempt ${attempt + 1} failed:`, e)
            }
        }

        if (finalStatus === 'success') {
            // Atomic claim to prevent race condition with webhook
            const claimResult = await supaPatch('tribute_orders', `?uuid=eq.${charge.chargeUuid}&status=eq.pending`, {
                status: 'paid',
                paid_at: new Date().toISOString()
            }, true)

            // If no rows returned, webhook already processed it
            if (!claimResult.ok || !Array.isArray(claimResult.data) || claimResult.data.length === 0) {
                res.json({ success: true, status: 'success', tokensAdded: 0 })
                return
            }

            // Credit tokens to user
            const userResult = await supaSelect('users', `?user_id=eq.${userId}&select=balance,telegram_id,username,first_name,last_name`)
            if (userResult.ok && Array.isArray(userResult.data) && userResult.data.length > 0) {
                const user = userResult.data[0]
                const currentBalance = user.balance || 0
                const newBalance = currentBalance + orderTokens

                await supaPatch('users', `?user_id=eq.${userId}`, { balance: newBalance })

                await logBalanceChange({
                    userId: userId,
                    oldBalance: currentBalance,
                    newBalance,
                    reason: 'tribute_card_charge',
                    metadata: {
                        chargeUuid: charge.chargeUuid,
                        currency,
                        amount: orderAmount,
                        paymentMethod: 'saved_card',
                    }
                })
                await processPartnerBonus(userId, orderAmount, currency.toUpperCase())

                console.log(`[TributeController] Charge success: user ${userId} balance ${currentBalance} -> ${newBalance}`)

                // Send notification to owner
                const ownerTelegramId = process.env.OWNER_TELEGRAM_ID
                if (ownerTelegramId) {
                    const userDisplay = user.username
                        ? `@${user.username}`
                        : `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Без имени'
                    const currencySymbol = currency === 'eur' ? '€' : currency === 'usd' ? '$' : '₽'
                    const amountFormatted = (orderAmount / 100).toFixed(2)

                    await tg('sendMessage', {
                        chat_id: ownerTelegramId,
                        text: `🔔 Оплата сохранённой картой!\n\n` +
                            `👤 ${userDisplay}\n` +
                            `🆔 Telegram ID: ${user.telegram_id}\n\n` +
                            `💰 ${orderTokens} токенов\n` +
                            `💳 ${amountFormatted} ${currencySymbol}\n` +
                            `📍 Сохранённая карта\n\n` +
                            `🔗 Charge ID: ${charge.chargeUuid}`
                    })
                }
            }

            res.json({ success: true, status: 'success', tokensAdded: orderTokens })
        } else if (finalStatus === 'failed') {
            await supaPatch('tribute_orders', `?uuid=eq.${charge.chargeUuid}`, { status: 'failed' })
            res.status(402).json({ success: false, error: 'Payment failed', status: 'failed' })
        } else {
            // Still pending/processing — webhook will handle it
            res.json({ success: true, status: 'processing', message: 'Payment is being processed' })
        }
    } catch (error: any) {
        console.error('[TributeController] Error charging saved card:', error)
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to charge saved card'
        })
    }
}

/**
 * DELETE /api/tribute/saved-cards/:token
 * Deactivate a saved payment method
 */
export async function deleteSavedCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const userId = req.user?.id
        const tokenUuid = req.params.token

        if (!userId) {
            res.status(401).json({ success: false, error: 'Unauthorized' })
            return
        }

        if (!TRIBUTE_TOKEN_CHARGING_ENABLED) {
            res.status(503).json({
                success: false,
                status: 'disabled',
                error: 'Saved cards are temporarily disabled',
            })
            return
        }

        if (!tokenUuid) {
            res.status(400).json({ success: false, error: 'Missing token UUID' })
            return
        }

        await deactivateToken(tokenUuid)
        console.log(`[TributeController] Token deactivated: ${tokenUuid} by user ${userId}`)

        res.json({ success: true })
    } catch (error: any) {
        console.error('[TributeController] Error deactivating token:', error)
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete saved card'
        })
    }
}
