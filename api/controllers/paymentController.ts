import { Response } from 'express'
import { Telegraf } from 'telegraf'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js'
import {
    getStarsPackageById,
    buildStarsInvoicePayload,
    buildCustomStarsPayload,
    calculateStarsForTokens,
    getCustomStarsBonus,
    MIN_CUSTOM_STARS_TOKENS,
    MAX_CUSTOM_STARS_TOKENS,
} from '../config/starsPackages.js'

// Lazy initialization or just initialize inside handler to ensure env vars are loaded
const getBot = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN is not defined')
    }
    return new Telegraf(token)
}

export const createStarsInvoice = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id
        const packageId = String(req.body?.packageId || '')
        const customTokens = Number(req.body?.customTokens || 0)

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' })
        }

        let tokens: number
        let starsAmount: number
        let payload: string

        if (customTokens > 0) {
            // Custom token amount — server calculates the price
            const stars = calculateStarsForTokens(customTokens)
            if (!stars) {
                return res.status(400).json({
                    success: false,
                    error: `Token count must be between ${MIN_CUSTOM_STARS_TOKENS} and ${MAX_CUSTOM_STARS_TOKENS}`,
                })
            }
            const bonus = getCustomStarsBonus(customTokens)
            tokens = customTokens
            starsAmount = stars
            payload = buildCustomStarsPayload(tokens, starsAmount, bonus.bonusTokens)
        } else if (packageId) {
            // Predefined package
            const pkg = getStarsPackageById(packageId)
            if (!pkg) {
                return res.status(400).json({ success: false, error: 'Invalid stars package' })
            }
            tokens = pkg.tokens
            starsAmount = pkg.starsAmount
            payload = buildStarsInvoicePayload(pkg.id)
        } else {
            return res.status(400).json({ success: false, error: 'packageId or customTokens is required' })
        }

        const bot = getBot()
        const title = `${tokens} токенов`
        const description = `Пополнение баланса на ${tokens} токенов`
        const invoiceLink = await bot.telegram.createInvoiceLink({
            title,
            description,
            payload,
            provider_token: '',
            currency: 'XTR',
            prices: [{ label: title, amount: starsAmount }],
        })

        res.json({
            success: true,
            invoiceLink,
            starsAmount,
            tokens,
        })
    } catch (error: any) {
        console.error('Error creating invoice:', error)
        res.status(500).json({ success: false, error: error.message || 'Failed to create invoice' })
    }
}
