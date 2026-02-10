/**
 * Partner Bonus Service
 * Handles partner commission accrual when referrals make payments
 */

import { supaSelect, supaPost, supaPatch } from './supabaseService.js'

// EUR → RUB conversion rate (approximate)
const EUR_TO_RUB_RATE = 91

/**
 * Process partner bonus after a successful payment
 * 
 * @param sourceUserId - user_id of the paying user (referral)
 * @param amount - payment amount (Stars for XTR, kopecks/cents for RUB/EUR)
 * @param currency - 'XTR' | 'RUB' | 'EUR'
 */
export async function processPartnerBonus(
    sourceUserId: number,
    amount: number,
    currency: string
): Promise<void> {
    try {
        // 1. Get paying user's ref (partner username)
        const userResult = await supaSelect('users', `?user_id=eq.${sourceUserId}&select=ref`)
        if (!userResult.ok || !Array.isArray(userResult.data) || !userResult.data[0]?.ref) {
            return // No referral — no bonus
        }

        const partnerUsername = userResult.data[0].ref

        // 2. Find partner by username
        const partnerResult = await supaSelect(
            'users',
            `?username=eq.${encodeURIComponent(partnerUsername)}&select=user_id,partner_percent,partner_balance_stars,partner_balance_rubles,telegram_id`
        )
        if (!partnerResult.ok || !Array.isArray(partnerResult.data) || !partnerResult.data[0]) {
            console.log(`[Partner] Partner not found by username: ${partnerUsername}`)
            return
        }

        const partner = partnerResult.data[0]
        const percent = Number(partner.partner_percent || 0)
        if (percent <= 0) {
            return // Not a partner (no percent set)
        }

        // 3. Calculate bonus
        const bonusAmount = Math.floor(amount * percent / 100)
        if (bonusAmount <= 0) return

        const currencyUpper = currency.toUpperCase()

        // 4. Create partner_transaction record
        await supaPost('partner_transactions', {
            partner_id: partner.user_id,
            source_user_id: sourceUserId,
            amount,
            currency: currencyUpper,
            bonus_amount: bonusAmount
        })

        // 5. Update partner balance
        if (currencyUpper === 'XTR') {
            // Stars payment
            const currentStars = Number(partner.partner_balance_stars || 0)
            await supaPatch('users', `?user_id=eq.${partner.user_id}`, {
                partner_balance_stars: currentStars + bonusAmount
            })
            console.log(`[Partner] Bonus: +${bonusAmount} Stars for partner @${partnerUsername} (${percent}% of ${amount} XTR from user ${sourceUserId})`)
        } else {
            // Card payment (RUB or EUR)
            // Convert EUR to RUB for unified rubles balance
            let rubAmount = bonusAmount
            if (currencyUpper === 'EUR') {
                rubAmount = Math.floor(bonusAmount * EUR_TO_RUB_RATE / 100) // amount in cents, rate per euro
            }

            const currentRubles = Number(partner.partner_balance_rubles || 0)
            await supaPatch('users', `?user_id=eq.${partner.user_id}`, {
                partner_balance_rubles: currentRubles + rubAmount / 100 // convert kopecks/cents to rubles
            })
            console.log(`[Partner] Bonus: +${(rubAmount / 100).toFixed(2)}₽ for partner @${partnerUsername} (${percent}% of ${amount} ${currencyUpper} from user ${sourceUserId})`)
        }
    } catch (e) {
        // Never let partner bonus errors break payment flow
        console.error('[Partner] processPartnerBonus error:', e)
    }
}
