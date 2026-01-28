import { Request, Response } from 'express'
import { supaSelect, supaPatch, supaPost } from '../services/supabaseService.js'
import { logBalanceChange } from '../services/balanceAuditService.js'

// Segments configuration
// Indices mapping to UI Wheel segments: [500, 25, 50, 100, 50, 25, 250, 50, 200, 75, 120, 50]
const SEGMENTS = [
    { index: 0, value: 500, type: 'token', weight: 0.01 },   // 500 (1%)
    { index: 1, value: 25, type: 'token', weight: 0.12 },    // 25 (12%)
    { index: 2, value: 50, type: 'token', weight: 0.08 },    // 50 (8%)
    { index: 3, value: 100, type: 'token', weight: 0.10 },   // 100 (10%)
    { index: 4, value: 50, type: 'token', weight: 0.08 },    // 50 (8%)
    { index: 5, value: 25, type: 'token', weight: 0.12 },    // 25 (12%)
    { index: 6, value: 250, type: 'token', weight: 0.03 },   // 250 (3%)
    { index: 7, value: 50, type: 'token', weight: 0.08 },    // 50 (8%)
    { index: 8, value: 200, type: 'token', weight: 0.04 },   // 200 (4%)
    { index: 9, value: 75, type: 'token', weight: 0.11 },    // 75 (11%)
    { index: 10, value: 120, type: 'token', weight: 0.095 }, // 120 (9.5%)
    { index: 11, value: 50, type: 'token', weight: 0.085 },  // 50 (8.5%)
]

// Helper to select random segment based on weights
function getRandomSegment() {
    const random = Math.random()
    let accumulatedWeight = 0
    for (const segment of SEGMENTS) {
        accumulatedWeight += segment.weight
        if (random <= accumulatedWeight) {
            return segment
        }
    }
    return SEGMENTS[1] // Fallback to 25 tokens (High prob)
}

export async function handleSpin(req: Request, res: Response) {
    try {
        const { user_id } = req.body

        if (!user_id) {
            return res.status(400).json({ error: 'User ID is required' })
        }

        // 0. Check if spin event is enabled
        const eventCheck = await supaSelect('event_settings', `?event_key=eq.spin&select=enabled,start_date,end_date`)
        if (eventCheck.ok && eventCheck.data && eventCheck.data.length > 0) {
            const event = eventCheck.data[0]
            const now = new Date()

            let isActive = event.enabled
            if (event.start_date && new Date(event.start_date) > now) {
                isActive = false
            }
            if (event.end_date && new Date(event.end_date) < now) {
                isActive = false
            }

            if (!isActive) {
                return res.status(403).json({ error: 'Событие временно недоступно', event_disabled: true })
            }
        }

        // 1. Check User Spins and Balance
        const userRes = await supaSelect('users', `?user_id=eq.${user_id}&select=spins,balance`)

        if (!userRes.ok || !userRes.data || !Array.isArray(userRes.data) || userRes.data.length === 0) {
            return res.status(404).json({ error: 'User not found' })
        }

        const user = userRes.data[0]
        const currentSpins = user.spins || 0
        const currentBalance = user.balance || 0

        if (currentSpins < 1) {
            return res.status(403).json({ error: 'No spins remaining' })
        }

        // 2. Determine Result
        const prize = getRandomSegment()

        // 3. Update DB (Transaction-like logic)
        // Decrement Spin
        const newSpins = currentSpins - 1
        let newBalance = currentBalance

        if (prize.type === 'token') {
            newBalance += prize.value
        }

        // Update User
        const updateRes = await supaPatch('users', `?user_id=eq.${user_id}`, {
            spins: newSpins,
            balance: newBalance
        })

        if (!updateRes.ok) {
            console.error('Failed to update user spin/balance', updateRes)
            return res.status(500).json({ error: 'Transaction failed' })
        }

        // Log balance change (fire and forget)
        if (prize.type === 'token') {
            logBalanceChange({ userId: user_id, oldBalance: currentBalance, newBalance, reason: 'spin', metadata: { prizeValue: prize.value, prizeIndex: prize.index } })
        }

        // Log History (Fire and forget, or await)
        await supaPost('spin_history', {
            user_id: user_id,
            prize_type: prize.type,
            prize_amount: prize.value
        })

        // Return Result
        return res.json({
            success: true,
            prizeIndex: prize.index,
            prizeValue: prize.value,
            prizeType: prize.type,
            remainingSpins: newSpins,
            newBalance: newBalance
        })

    } catch (error) {
        console.error('Spin API Error:', error)
        return res.status(500).json({ error: 'Internal Server Error' })
    }
}
