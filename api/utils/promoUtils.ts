// New Year Promo Configuration (Server-side)
// Period: December 25, 2025 - January 5, 2026

export const PROMO_START = new Date('2025-12-25T00:00:00');
export const PROMO_END = new Date('2026-01-05T23:59:59');
export const BONUS_MULTIPLIER = 1.2; // +20% bonus

/**
 * Check if the New Year promo is currently active
 */
export function isPromoActive(): boolean {
    const now = new Date();
    return now >= PROMO_START && now <= PROMO_END;
}

/**
 * Calculate total tokens including bonus if promo is active
 * @param baseTokens - Original token amount
 * @returns Total tokens (with bonus if promo active)
 */
export function calculateBonusTokens(baseTokens: number): number {
    if (isPromoActive()) {
        return Math.floor(baseTokens * BONUS_MULTIPLIER);
    }
    return baseTokens;
}

/**
 * Get bonus amount (difference between total and base)
 * @param baseTokens - Original token amount
 * @returns Bonus tokens (0 if promo not active)
 */
export function getBonusAmount(baseTokens: number): number {
    if (isPromoActive()) {
        return Math.floor(baseTokens * BONUS_MULTIPLIER) - baseTokens;
    }
    return 0;
}
