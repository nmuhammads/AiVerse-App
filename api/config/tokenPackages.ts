/**
 * Token Packages Configuration
 * For Tribute Shop API payments (EUR + RUB)
 */

import type { TributeCurrency } from '../services/tributeService.js'

export interface TokenPackage {
    id: string
    tokens: number
    amount: number      // in cents (EUR) or kopecks (RUB)
    label: string       // display label
    price: string       // formatted price
    bonus?: string      // bonus text like "+4%"
}

export interface PackagesByСurrency {
    eur: TokenPackage[]
    rub: TokenPackage[]
}

/**
 * Web payment packages (via Tribute Shop API)
 * Amount is in smallest currency units (cents/kopecks)
 */
export const WEB_PACKAGES: PackagesByСurrency = {
    // EUR packages (1 EUR ≈ 90 RUB)
    eur: [
        { id: 'eur_50', tokens: 50, amount: 110, label: '50 tokens', price: '€1.10' },
        { id: 'eur_120', tokens: 120, amount: 255, label: '120 tokens', price: '€2.55', bonus: '+4%' },
        { id: 'eur_300', tokens: 300, amount: 600, label: '300 tokens', price: '€6.00', bonus: '+11%' },
        { id: 'eur_800', tokens: 800, amount: 1600, label: '800 tokens', price: '€16.00', bonus: '+11%' },
    ],
    // RUB packages (1 EUR ≈ 90 RUB)
    rub: [
        { id: 'rub_50', tokens: 50, amount: 10000, label: '50 токенов', price: '₽100' },
        { id: 'rub_120', tokens: 120, amount: 23000, label: '120 токенов', price: '₽230', bonus: '+4%' },
        { id: 'rub_300', tokens: 300, amount: 54000, label: '300 токенов', price: '₽540', bonus: '+11%' },
        { id: 'rub_800', tokens: 800, amount: 144000, label: '800 токенов', price: '₽1,440', bonus: '+11%' },
    ],
}

/**
 * Find package by ID
 */
export function findPackage(packageId: string, currency: TributeCurrency): TokenPackage | undefined {
    return WEB_PACKAGES[currency].find(pkg => pkg.id === packageId)
}

/**
 * Get all packages for currency
 */
export function getPackages(currency: TributeCurrency): TokenPackage[] {
    return WEB_PACKAGES[currency]
}

/**
 * Get package title for Tribute order
 */
export function getPackageTitle(pkg: TokenPackage): string {
    return `${pkg.tokens} AiVerse Tokens`
}

/**
 * Get package description for Tribute order
 */
export function getPackageDescription(pkg: TokenPackage): string {
    return `Purchase ${pkg.tokens} tokens for AI image generation`
}

// Base rates per token in smallest currency units
const BASE_RATE_RUB = 200    // 2 RUB = 200 kopecks per token
const BASE_RATE_EUR = 2.2    // €0.022 = 2.2 cents per token

/**
 * Get discount tier for a given token count
 * 50-99: 0%, 100-299: 5%, 300+: 10%
 */
export function getDiscountForTokens(tokens: number): number {
    if (tokens >= 300) return 0.10
    if (tokens >= 100) return 0.05
    return 0
}

/**
 * Calculate price for a custom token amount
 * Returns amount in smallest currency units (cents/kopecks)
 */
export function calculateCustomPrice(tokens: number, currency: TributeCurrency): { amount: number; tokens: number; discount: number } {
    const discount = getDiscountForTokens(tokens)
    const baseRate = currency === 'eur' ? BASE_RATE_EUR : BASE_RATE_RUB
    const amount = Math.round(tokens * baseRate * (1 - discount))
    return { amount, tokens, discount }
}
