/**
 * Tribute Webhook Controller
 * Handles payment notifications from Tribute Shop API
 */

import { Request, Response } from 'express'
import * as crypto from 'crypto'
import { supaSelect, supaPatch } from '../services/supabaseService.js'
import { processPartnerBonus } from '../services/partnerService.js'
import { logBalanceChange } from '../services/balanceAuditService.js'
import { tg } from './telegramController.js'
import { isPromoActive, calculateBonusTokens, getBonusAmount } from '../utils/promoUtils.js'
import { getSourceLabel } from '../utils/sourceLabels.js'

const TRIBUTE_API_KEY = process.env.TRIBUTE_API_KEY || ''

/**
 * Tribute webhook envelope format:
 * { name: "event_name", created_at: "...", sent_at: "...", payload: { ... } }
 */
interface TributeWebhookEnvelope {
    name: string
    created_at: string
    sent_at: string
    payload: TributeWebhookOrderPayload
}

interface TributeWebhookOrderPayload {
    uuid: string
    status: 'pending' | 'paid' | 'failed'
    amount: number
    currency: 'eur' | 'rub' | 'usd'
    customerId?: string
    email?: string
    title?: string
    description?: string
    comment?: string
    createdAt?: string
    source?: string           // e.g. 'aiverse_hub_bot' — origin of the order
    transactionId?: number    // payment transaction ID (for refunds)
    chargeUuid?: string       // UUID of charge (for token charge events)
    charge_uuid?: string      // alternative key name
}

/**
 * Verify webhook signature (HMAC-SHA256)
 */
function verifySignature(body: string, signature: string): boolean {
    if (!signature || !TRIBUTE_API_KEY) {
        console.warn('[TributeWebhook] Missing signature or API key')
        return false
    }

    const hmac = crypto.createHmac('sha256', TRIBUTE_API_KEY)
    hmac.update(body)
    const expectedSignature = hmac.digest('hex')

    // Use timing-safe comparison
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        )
    } catch {
        return signature === expectedSignature
    }
}

/**
 * POST /api/tribute/webhook
 * Handle Tribute payment webhook
 */
export async function handleTributeWebhook(req: Request, res: Response): Promise<void> {
    try {
        // With express.raw() middleware, req.body is a Buffer
        const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
        const signature = req.headers['trbt-signature'] as string

        // Verify signature
        if (!verifySignature(rawBody, signature)) {
            console.warn('[TributeWebhook] Invalid signature')
            res.status(401).json({ error: 'Invalid signature' })
            return
        }

        // Parse the webhook body
        const body = JSON.parse(rawBody)
        const eventName = body.name || 'unknown'

        console.log(`[TributeWebhook] Received event: ${eventName}`, JSON.stringify(body))

        // Tribute uses envelope format: { name, created_at, sent_at, payload: { ... } }
        // Extract order data from the nested payload, or fall back to top-level fields
        const orderData: TributeWebhookOrderPayload = body.payload
            ? body.payload
            : body

        console.log(`[TributeWebhook] Parsed order data: uuid=${orderData.uuid}, status=${orderData.status}, event=${eventName}`)

        // --- Source field check (P0) ---
        // If order was created by the hub bot, skip Telegram notifications
        // to avoid duplicates (hub bot already sends its own notifications)
        const skipNotifications = orderData.source === 'aiverse_hub_bot'
        if (skipNotifications) {
            console.log(`[TributeWebhook] Source is hub bot — will skip Telegram notifications`)
        }

        if (!orderData.uuid) {
            // Non-order events (e.g. token charge events) — handle separately
            if (eventName === 'shopTokenChargeSuccess' || eventName === 'shopTokenChargeFailed') {
                const chargeUuid = orderData.chargeUuid || orderData.charge_uuid || (body.payload && body.payload.chargeUuid)
                console.log(`[TributeWebhook] Token charge event: ${eventName}, chargeUuid=${chargeUuid}`)

                if (chargeUuid) {
                    // Find order by charge UUID
                    const chargeOrderResult = await supaSelect('tribute_orders', `?uuid=eq.${chargeUuid}&select=*`)
                    if (chargeOrderResult.ok && Array.isArray(chargeOrderResult.data) && chargeOrderResult.data.length > 0) {
                        const chargeOrder = chargeOrderResult.data[0]

                        if (eventName === 'shopTokenChargeSuccess') {
                            // Atomic claim to prevent race condition
                            const updateResult = await supaPatch('tribute_orders', `?uuid=eq.${chargeUuid}&status=eq.pending`, { status: 'paid', paid_at: new Date().toISOString() }, true)

                            if (updateResult.ok && Array.isArray(updateResult.data) && updateResult.data.length > 0) {
                                // Credit tokens if successfully claimed
                                const userResult = await supaSelect('users', `?user_id=eq.${chargeOrder.user_id}&select=balance`)
                                if (userResult.ok && Array.isArray(userResult.data) && userResult.data.length > 0) {
                                    const currentBalance = userResult.data[0].balance || 0
                                    const newBalance = currentBalance + chargeOrder.tokens
                                    await supaPatch('users', `?user_id=eq.${chargeOrder.user_id}`, { balance: newBalance })
                                    await processPartnerBonus(
                                        chargeOrder.user_id,
                                        chargeOrder.amount,
                                        (chargeOrder.currency || 'rub').toUpperCase()
                                    )
                                    console.log(`[TributeWebhook] Charge credited: user ${chargeOrder.user_id} balance ${currentBalance} -> ${newBalance}`)
                                }
                            } else {
                                console.log(`[TributeWebhook] Charge ${chargeUuid} already processed by polling.`)
                            }
                        } else if (eventName === 'shopTokenChargeFailed' && chargeOrder.status !== 'failed') {
                            await supaPatch('tribute_orders', `?uuid=eq.${chargeUuid}`, { status: 'failed' })
                            console.log(`[TributeWebhook] Charge failed: ${chargeUuid}`)
                        }
                    }
                }

                res.status(200).json({ ok: true, message: `Processed ${eventName}` })
                return
            }
            console.warn(`[TributeWebhook] No uuid found in webhook payload`)
            res.status(200).json({ ok: true, message: 'No uuid in payload' })
            return
        }

        // Find order in database
        const orderResult = await supaSelect(
            'tribute_orders',
            `?uuid=eq.${orderData.uuid}&select=*`
        )

        if (!orderResult.ok || !Array.isArray(orderResult.data) || orderResult.data.length === 0) {
            console.warn(`[TributeWebhook] Order not found: ${orderData.uuid}`)
            // Return 200 to prevent retries for unknown orders
            res.status(200).json({ ok: true, message: 'Order not found' })
            return
        }

        const order = orderResult.data[0]

        // --- Event-based routing (P1) ---
        switch (eventName) {
            case 'shopOrderSuccess':
                // Skip if already processed (idempotency)
                if (order.status === 'paid') {
                    console.log(`[TributeWebhook] Order already paid: ${orderData.uuid}`)
                    res.status(200).json({ ok: true, message: 'Already processed' })
                    return
                }
                await processSuccessfulPayment(order, orderData, skipNotifications)
                break

            case 'shopOrderPaymentFailed':
                await processFailedPayment(order, orderData)
                break

            case 'shopOrderRefunded':
                await processRefundedPayment(order, orderData, skipNotifications)
                break

            case 'shopRecurrentCancelled':
                console.log(`[TributeWebhook] Recurrent subscription cancelled for order ${orderData.uuid}`)
                break

            default:
                // Legacy: fall back to status-based processing
                if (order.status === 'paid') {
                    console.log(`[TributeWebhook] Order already paid: ${orderData.uuid}`)
                    res.status(200).json({ ok: true, message: 'Already processed' })
                    return
                }
                if (orderData.status === 'paid') {
                    await processSuccessfulPayment(order, orderData, skipNotifications)
                } else if (orderData.status === 'failed') {
                    await processFailedPayment(order, orderData)
                }
                break
        }

        res.status(200).json({ ok: true })
    } catch (error: any) {
        console.error('[TributeWebhook] Error processing webhook:', error)
        // Return 500 to trigger retry
        res.status(500).json({ error: 'Internal error' })
    }
}

/**
 * Process successful payment
 */
async function processSuccessfulPayment(order: any, payload: TributeWebhookOrderPayload, skipNotifications: boolean = false): Promise<void> {
    // ATOMIC CLAIM: Try to update the order to 'paid' where it is currently 'pending'
    const claimResult = await supaPatch('tribute_orders', `?uuid=eq.${order.uuid}&status=eq.pending`, {
        status: 'paid',
        paid_at: new Date().toISOString()
    }, true)

    // If no rows were returned, another process already claimed it (race condition avoided)
    if (!claimResult.ok || !Array.isArray(claimResult.data) || claimResult.data.length === 0) {
        console.log(`[TributeWebhook] Order ${order.uuid} already processed or not pending, skipping token credit.`)
        return
    }

    const userId = order.user_id
    const baseTokens = order.tokens

    // Apply promo bonus if active
    const promoActive = isPromoActive()
    const tokensToAdd = promoActive ? calculateBonusTokens(baseTokens) : baseTokens
    const bonusTokens = promoActive ? getBonusAmount(baseTokens) : 0

    console.log(`[TributeWebhook] Processing payment for user ${userId}: base=${baseTokens}, bonus=${bonusTokens}, total=${tokensToAdd}`)

    // Get current user balance
    const userResult = await supaSelect('users', `?user_id=eq.${userId}&select=balance,telegram_id,username,first_name,last_name`)

    if (!userResult.ok || !Array.isArray(userResult.data) || userResult.data.length === 0) {
        console.error(`[TributeWebhook] User not found: ${userId}`)
        return
    }

    const user = userResult.data[0]
    const currentBalance = Number(user.balance || 0)
    const newBalance = currentBalance + tokensToAdd
    const telegramId = user.telegram_id

    // Update user balance
    const updateResult = await supaPatch('users', `?user_id=eq.${userId}`, {
        balance: newBalance
    })

    if (!updateResult.ok) {
        console.error(`[TributeWebhook] Failed to update balance for user ${userId}`)
        return
    }

    // Log balance change
    await logBalanceChange({
        userId,
        oldBalance: currentBalance,
        newBalance,
        reason: 'payment',
        referenceId: order.uuid,
        metadata: {
            source: 'tribute_web',
            baseTokens,
            bonusTokens,
            promoActive,
            currency: order.currency,
            amount: order.amount,
        }
    })

    // Partner bonus accrual
    await processPartnerBonus(userId, order.amount, (order.currency || 'rub').toUpperCase())

    console.log(`[TributeWebhook] Payment processed: user ${userId} balance ${currentBalance} -> ${newBalance}`)

    // Send Telegram notification if user has telegram_id (and not from hub bot)
    if (telegramId && !skipNotifications) {
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

    // Send notification to bot owner about successful payment
    const ownerTelegramId = process.env.OWNER_TELEGRAM_ID
    if (ownerTelegramId) {
        const userDisplay = user.username
            ? `@${user.username}`
            : `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Пользователь без имени'

        const email = payload.email || order.email || 'не указана'
        const currencySymbol = order.currency === 'eur' ? '€' : order.currency === 'usd' ? '$' : '₽'
        const amountFormatted = (order.amount / 100).toFixed(2)
        const promoText = promoActive ? ` (+${bonusTokens} бонус 🎁)` : ''
        const sourceLabel = getSourceLabel(order.source)

        await tg('sendMessage', {
            chat_id: ownerTelegramId,
            text: `🔔 Новая оплата!\n\n` +
                `👤 Пользователь: ${userDisplay}\n` +
                `📧 Email: ${email}\n` +
                `🆔 Telegram ID: ${telegramId}\n\n` +
                `💰 Оплачено: ${tokensToAdd} токенов${promoText}\n` +
                `💳 Сумма: ${amountFormatted} ${currencySymbol}\n` +
                `📍 Источник: ${sourceLabel}\n\n` +
                `🔗 Order ID: ${order.uuid}`
        })
    }
}

/**
 * Process failed payment
 */
async function processFailedPayment(order: any, payload: TributeWebhookOrderPayload): Promise<void> {
    console.log(`[TributeWebhook] Payment failed for order ${order.uuid}`)
    await updateOrderStatus(order.uuid, 'failed')
}

/**
 * Process refunded payment (new in v2)
 * Revokes tokens and notifies user
 */
async function processRefundedPayment(order: any, payload: TributeWebhookOrderPayload, skipNotifications: boolean = false): Promise<void> {
    const userId = order.user_id
    const tokensToRevoke = order.tokens

    console.log(`[TributeWebhook] Processing refund for order ${order.uuid}, user ${userId}, tokens ${tokensToRevoke}`)

    // Get current user balance
    const userResult = await supaSelect('users', `?user_id=eq.${userId}&select=balance,telegram_id,username,first_name,last_name`)
    if (!userResult.ok || !Array.isArray(userResult.data) || userResult.data.length === 0) {
        console.error(`[TributeWebhook] Refund: User not found: ${userId}`)
        await updateOrderStatus(order.uuid, 'refunded')
        return
    }

    const user = userResult.data[0]
    const currentBalance = Number(user.balance || 0)
    const newBalance = Math.max(0, currentBalance - tokensToRevoke)
    const telegramId = user.telegram_id

    // Update user balance (deduct tokens)
    await supaPatch('users', `?user_id=eq.${userId}`, { balance: newBalance })

    // Log balance change
    await logBalanceChange({
        userId,
        oldBalance: currentBalance,
        newBalance,
        reason: 'refund',
        referenceId: order.uuid,
        metadata: {
            source: 'tribute_web_refund',
            tokensRevoked: tokensToRevoke,
            currency: order.currency,
            amount: order.amount,
        }
    })

    // Update order status
    await updateOrderStatus(order.uuid, 'refunded')

    console.log(`[TributeWebhook] Refund processed: user ${userId} balance ${currentBalance} -> ${newBalance}`)

    // Notify user about refund
    if (telegramId && !skipNotifications) {
        const currencySymbol = order.currency === 'eur' ? '€' : order.currency === 'usd' ? '$' : '₽'
        const amountFormatted = (order.amount / 100).toFixed(2)

        await tg('sendMessage', {
            chat_id: telegramId,
            text: `↩️ Возврат средств\n\n` +
                `💰 Списано: ${tokensToRevoke} токенов\n` +
                `💳 Сумма возврата: ${amountFormatted} ${currencySymbol}\n\n` +
                `Если у вас есть вопросы, напишите нам.`
        })
    }

    // Notify bot owner
    const ownerTelegramId = process.env.OWNER_TELEGRAM_ID
    if (ownerTelegramId) {
        const userDisplay = user.username
            ? `@${user.username}`
            : `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User'
        const currencySymbol = order.currency === 'eur' ? '€' : order.currency === 'usd' ? '$' : '₽'
        const amountFormatted = (order.amount / 100).toFixed(2)
        const sourceLabel = getSourceLabel(order.source)

        await tg('sendMessage', {
            chat_id: ownerTelegramId,
            text: `⚠️ Возврат платежа!\n\n` +
                `👤 Пользователь: ${userDisplay}\n` +
                `🆔 Telegram ID: ${telegramId}\n\n` +
                `💰 Списано: ${tokensToRevoke} токенов\n` +
                `💳 Сумма: ${amountFormatted} ${currencySymbol}\n` +
                `📍 Источник: ${sourceLabel}\n\n` +
                `🔗 Order ID: ${order.uuid}`
        })
    }
}

/**
 * Update order status in database
 */
async function updateOrderStatus(uuid: string, status: 'paid' | 'failed' | 'refunded'): Promise<void> {
    const updateData: any = { status }

    if (status === 'paid') {
        updateData.paid_at = new Date().toISOString()
    }
    if (status === 'refunded') {
        updateData.refunded_at = new Date().toISOString()
    }

    await supaPatch('tribute_orders', `?uuid=eq.${uuid}`, updateData)
}
