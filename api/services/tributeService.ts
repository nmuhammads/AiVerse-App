/**
 * Tribute Shop API Service
 * REST client for creating orders, managing transactions, tokens and charges
 * Docs: https://wiki.tribute.tg/for-shops/api
 */

import * as dotenv from 'dotenv'
import * as crypto from 'crypto'

dotenv.config()

const TRIBUTE_API_URL = 'https://tribute.tg/api/v1'
const TRIBUTE_API_KEY = process.env.TRIBUTE_API_KEY || ''

// ============ Types ============

export type TributeCurrency = 'eur' | 'rub' | 'usd'
export type TributeOrderStatus = 'pending' | 'paid' | 'failed'

export interface CreateOrderParams {
    amount: number           // in cents (EUR/USD) or kopecks (RUB)
    currency: TributeCurrency
    title: string            // max 100 UTF-16 chars
    description: string      // max 300 UTF-16 chars
    successUrl: string
    failUrl: string
    email?: string
    customerId: string       // tribute_customer_id (UUID)
    savePaymentMethod?: boolean // save card for future charges (requires shop.recurrent = true)
}

export interface TributeOrderResponse {
    uuid: string
    paymentUrl: string
}

export interface TributeOrderStatusResponse {
    status: TributeOrderStatus
}

export interface TributeShopInfo {
    userId: number
    name: string
    link: string
    callbackUrl: string
    recurrent: boolean
    onlyStars: boolean
    status: number
}

export interface TributeApiError {
    error: string
    message: string
}

// --- Transaction types ---

export interface TributeTransaction {
    id: number
    type: string
    objectId?: number
    amount: number
    currency: TributeCurrency
    createdAt: number        // Unix timestamp
    serviceFee?: number
    total: number
    paymentMethod?: string
    isRefunded?: boolean
    isRefundable?: boolean
    isRecurring?: boolean
}

export interface TributeTransactionsResponse {
    transactions: TributeTransaction[]
    nextFrom: string
}

// --- Token (payment method) types ---

export interface TributeShopToken {
    token: string            // UUID
    cardLast4: string
    cardBrand?: string
    customerId?: string
    amount: number
    currency: TributeCurrency
    active: boolean
    createdAt: string
    lastUsedAt?: string
}

// --- Charge types ---

export type TributeChargeStatus = 'pending' | 'processing' | 'success' | 'failed' | 'timeout'

export interface TributeShopCharge {
    chargeUuid: string
    status: TributeChargeStatus
    reference?: string
    amount: number
    currency: TributeCurrency
    token: string
    errorCode?: string
    errorMessage?: string
    createdAt: string
    processedAt?: string
}

export interface CreateChargeParams {
    token: string
    amount: number
    reference?: string
    idempotencyKey?: string
}

export interface TributeRefundResponse {
    success: boolean
    message: string
    status: string
}

export interface ListTokensParams {
    customerId?: string
    orderUuid?: string
    active?: boolean
    limit?: number
    offset?: number
}

// ============ API Client ============

function tributeHeaders(): Record<string, string> {
    return {
        'Api-Key': TRIBUTE_API_KEY,
        'Content-Type': 'application/json',
    }
}

/**
 * Create a new shop order
 * POST /shop/orders
 */
export async function createOrder(params: CreateOrderParams): Promise<TributeOrderResponse> {
    const response = await fetch(`${TRIBUTE_API_URL}/shop/orders`, {
        method: 'POST',
        headers: tributeHeaders(),
        body: JSON.stringify({
            amount: params.amount,
            currency: params.currency,
            title: params.title,
            description: params.description,
            successUrl: params.successUrl,
            failUrl: params.failUrl,
            email: params.email,
            customerId: params.customerId,
            ...(params.savePaymentMethod ? { savePaymentMethod: true } : {}),
        }),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown', message: 'Unknown error' })) as TributeApiError
        console.error('[TributeService] Create order error:', error)
        throw new Error(error.message || `Tribute API error: ${response.status}`)
    }

    return response.json() as Promise<TributeOrderResponse>
}

/**
 * Get order status by UUID
 * GET /shop/orders/{orderUuid}/status
 */
export async function getOrderStatus(orderUuid: string): Promise<TributeOrderStatusResponse> {
    const response = await fetch(`${TRIBUTE_API_URL}/shop/orders/${orderUuid}/status`, {
        method: 'GET',
        headers: tributeHeaders(),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown', message: 'Unknown error' })) as TributeApiError
        console.error('[TributeService] Get order status error:', error)
        throw new Error(error.message || `Tribute API error: ${response.status}`)
    }

    return response.json() as Promise<TributeOrderStatusResponse>
}

/**
 * Get shop information
 * GET /shop
 */
export async function getShopInfo(): Promise<TributeShopInfo> {
    const response = await fetch(`${TRIBUTE_API_URL}/shop`, {
        method: 'GET',
        headers: tributeHeaders(),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown', message: 'Unknown error' })) as TributeApiError
        console.error('[TributeService] Get shop info error:', error)
        throw new Error(error.message || `Tribute API error: ${response.status}`)
    }

    return response.json() as Promise<TributeShopInfo>
}

/**
 * Get transactions for an order
 * GET /shop/orders/{orderUuid}/transactions
 */
export async function getOrderTransactions(orderUuid: string, startFrom?: number): Promise<TributeTransactionsResponse> {
    const params = startFrom ? `?startFrom=${startFrom}` : ''
    const response = await fetch(`${TRIBUTE_API_URL}/shop/orders/${orderUuid}/transactions${params}`, {
        method: 'GET',
        headers: tributeHeaders(),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown', message: 'Unknown error' })) as TributeApiError
        console.error('[TributeService] Get order transactions error:', error)
        throw new Error(error.message || `Tribute API error: ${response.status}`)
    }

    return response.json() as Promise<TributeTransactionsResponse>
}

/**
 * Refund a transaction
 * POST /shop/orders/{orderUuid}/transactions/{txId}/refund
 */
export async function refundTransaction(orderUuid: string, txId: number): Promise<TributeRefundResponse> {
    const response = await fetch(`${TRIBUTE_API_URL}/shop/orders/${orderUuid}/transactions/${txId}/refund`, {
        method: 'POST',
        headers: tributeHeaders(),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown', message: 'Unknown error' })) as TributeApiError
        console.error('[TributeService] Refund transaction error:', error)
        throw new Error(error.message || `Tribute API error: ${response.status}`)
    }

    return response.json() as Promise<TributeRefundResponse>
}

/**
 * List payment tokens
 * GET /shop/tokens
 */
export async function listTokens(params?: ListTokensParams): Promise<TributeShopToken[]> {
    const query = new URLSearchParams()
    if (params?.customerId) query.set('customerId', params.customerId)
    if (params?.orderUuid) query.set('orderUuid', params.orderUuid)
    if (params?.active !== undefined) query.set('active', String(params.active))
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))

    const qs = query.toString() ? `?${query.toString()}` : ''
    const response = await fetch(`${TRIBUTE_API_URL}/shop/tokens${qs}`, {
        method: 'GET',
        headers: tributeHeaders(),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown', message: 'Unknown error' })) as TributeApiError
        console.error('[TributeService] List tokens error:', error)
        throw new Error(error.message || `Tribute API error: ${response.status}`)
    }

    return response.json() as Promise<TributeShopToken[]>
}

/**
 * Get a specific payment token
 * GET /shop/tokens/{token}
 */
export async function getToken(tokenUuid: string): Promise<TributeShopToken> {
    const response = await fetch(`${TRIBUTE_API_URL}/shop/tokens/${tokenUuid}`, {
        method: 'GET',
        headers: tributeHeaders(),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown', message: 'Unknown error' })) as TributeApiError
        console.error('[TributeService] Get token error:', error)
        throw new Error(error.message || `Tribute API error: ${response.status}`)
    }

    return response.json() as Promise<TributeShopToken>
}

/**
 * Deactivate a payment token
 * DELETE /shop/tokens/{token}
 */
export async function deactivateToken(tokenUuid: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${TRIBUTE_API_URL}/shop/tokens/${tokenUuid}`, {
        method: 'DELETE',
        headers: tributeHeaders(),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown', message: 'Unknown error' })) as TributeApiError
        console.error('[TributeService] Deactivate token error:', error)
        throw new Error(error.message || `Tribute API error: ${response.status}`)
    }

    return response.json() as Promise<{ success: boolean; message: string }>
}

/**
 * Create a charge on a saved token
 * POST /shop/charges
 */
export async function createCharge(params: CreateChargeParams): Promise<TributeShopCharge> {
    const response = await fetch(`${TRIBUTE_API_URL}/shop/charges`, {
        method: 'POST',
        headers: tributeHeaders(),
        body: JSON.stringify(params),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown', message: 'Unknown error' })) as TributeApiError
        console.error('[TributeService] Create charge error:', error)
        throw new Error(error.message || `Tribute API error: ${response.status}`)
    }

    return response.json() as Promise<TributeShopCharge>
}

/**
 * Get charge status
 * GET /shop/charges/{chargeUuid}
 */
export async function getCharge(chargeUuid: string): Promise<TributeShopCharge> {
    const response = await fetch(`${TRIBUTE_API_URL}/shop/charges/${chargeUuid}`, {
        method: 'GET',
        headers: tributeHeaders(),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'unknown', message: 'Unknown error' })) as TributeApiError
        console.error('[TributeService] Get charge error:', error)
        throw new Error(error.message || `Tribute API error: ${response.status}`)
    }

    return response.json() as Promise<TributeShopCharge>
}

/**
 * Verify webhook signature
 * HMAC-SHA256 of body signed with API key
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
    if (!signature || !TRIBUTE_API_KEY) {
        return false
    }

    const hmac = crypto.createHmac('sha256', TRIBUTE_API_KEY)
    hmac.update(body)
    const expectedSignature = hmac.digest('hex')

    return signature === expectedSignature
}
