/**
 * Tribute Webhook Controller
 * Handles payment notifications from Tribute Shop API
 */

import { Request, Response } from 'express'
import * as crypto from 'crypto'
import { supaSelect, supaPatch } from '../services/supabaseService.js'
import { logBalanceChange } from '../services/balanceAuditService.js'
import { tg } from './telegramController.js'
import { isPromoActive, calculateBonusTokens, getBonusAmount } from '../utils/promoUtils.js'

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
    currency: 'eur' | 'rub'
    customerId?: string
    email?: string
    title?: string
    description?: string
    comment?: string
    createdAt?: string
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

        console.log(`[TributeWebhook] Received webhook body:`, JSON.stringify(body))

        // Tribute uses envelope format: { name, created_at, sent_at, payload: { ... } }
        // Extract order data from the nested payload, or fall back to top-level fields
        const orderData: TributeWebhookOrderPayload = body.payload
            ? body.payload
            : body

        console.log(`[TributeWebhook] Parsed order data: uuid=${orderData.uuid}, status=${orderData.status}, event=${body.name || 'unknown'}`)

        if (!orderData.uuid) {
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

        // Skip if already processed (idempotency)
        if (order.status === 'paid') {
            console.log(`[TributeWebhook] Order already paid: ${orderData.uuid}`)
            res.status(200).json({ ok: true, message: 'Already processed' })
            return
        }

        // Process based on status
        if (orderData.status === 'paid') {
            await processSuccessfulPayment(order, orderData)
        } else if (orderData.status === 'failed') {
            await processFailedPayment(order, orderData)
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
async function processSuccessfulPayment(order: any, payload: TributeWebhookOrderPayload): Promise<void> {
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
        // Still mark order as paid to prevent duplicate processing
        await updateOrderStatus(order.uuid, 'paid')
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

    // Update order status
    await updateOrderStatus(order.uuid, 'paid')

    console.log(`[TributeWebhook] Payment processed: user ${userId} balance ${currentBalance} -> ${newBalance}`)

    // Send Telegram notification if user has telegram_id
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

    // Send notification to bot owner about successful payment
    const ownerTelegramId = process.env.OWNER_TELEGRAM_ID
    if (ownerTelegramId) {
        const userDisplay = user.username
            ? `@${user.username}`
            : `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Пользователь без имени'

        const email = payload.email || order.email || 'не указана'
        const currencySymbol = order.currency === 'eur' ? '€' : '₽'
        const amountFormatted = (order.amount / 100).toFixed(2)
        const promoText = promoActive ? ` (+${bonusTokens} бонус 🎁)` : ''

        await tg('sendMessage', {
            chat_id: ownerTelegramId,
            text: `🔔 Новая оплата!\n\n` +
                `👤 Пользователь: ${userDisplay}\n` +
                `📧 Email: ${email}\n` +
                `🆔 Telegram ID: ${telegramId}\n\n` +
                `💰 Оплачено: ${tokensToAdd} токенов${promoText}\n` +
                `💳 Сумма: ${amountFormatted} ${currencySymbol}\n\n` +
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
 * Update order status in database
 */
async function updateOrderStatus(uuid: string, status: 'paid' | 'failed'): Promise<void> {
    const updateData: any = { status }

    if (status === 'paid') {
        updateData.paid_at = new Date().toISOString()
    }

    await supaPatch('tribute_orders', `?uuid=eq.${uuid}`, updateData)
}
