import { Request, Response } from 'express'
import { Telegraf } from 'telegraf'

// Lazy initialization or just initialize inside handler to ensure env vars are loaded
const getBot = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN is not defined')
    }
    return new Telegraf(token)
}

export const createStarsInvoice = async (req: Request, res: Response) => {
    try {
        const { title, description, payload, currency, amount } = req.body

        if (!title || !description || !payload || !currency || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' })
        }

        const bot = getBot()
        const invoiceLink = await bot.telegram.createInvoiceLink({
            title,
            description,
            payload,
            provider_token: '', // Empty for Stars
            currency: 'XTR', // Currency for Stars
            prices: [{ label: title, amount: parseInt(amount) }],
        })

        res.json({ success: true, invoiceLink })
    } catch (error: any) {
        console.error('Error creating invoice:', error)
        res.status(500).json({ success: false, error: error.message || 'Failed to create invoice' })
    }
}
