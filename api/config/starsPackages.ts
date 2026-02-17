export interface StarsPackage {
    id: string
    starsAmount: number
    tokens: number
    spins: number
}

export const STARS_PACKAGES: StarsPackage[] = [
    { id: 'star_20', starsAmount: 20, tokens: 10, spins: 0 },
    { id: 'star_50', starsAmount: 50, tokens: 25, spins: 0 },
    { id: 'star_100', starsAmount: 100, tokens: 50, spins: 0 },
    { id: 'star_200', starsAmount: 200, tokens: 100, spins: 0 },
    { id: 'star_300', starsAmount: 300, tokens: 150, spins: 0 },
    { id: 'star_600', starsAmount: 600, tokens: 300, spins: 1 },
    { id: 'star_1000', starsAmount: 1000, tokens: 550, spins: 2 },
]

export function getStarsPackageById(id: string): StarsPackage | null {
    return STARS_PACKAGES.find(pkg => pkg.id === id) || null
}

export function getStarsPackageByAmount(starsAmount: number): StarsPackage | null {
    return STARS_PACKAGES.find(pkg => pkg.starsAmount === starsAmount) || null
}

// --- Custom Stars pricing ---
export const STARS_PER_TOKEN = 2
export const MIN_CUSTOM_STARS_TOKENS = 10
export const MAX_CUSTOM_STARS_TOKENS = 5000

export function calculateStarsForTokens(tokens: number): number | null {
    if (!Number.isFinite(tokens) || tokens < MIN_CUSTOM_STARS_TOKENS || tokens > MAX_CUSTOM_STARS_TOKENS) return null
    return Math.ceil(tokens * STARS_PER_TOKEN)
}

export function calculateTokensForStars(stars: number): number | null {
    if (!Number.isFinite(stars) || stars <= 0) return null
    const tokens = Math.floor(stars / STARS_PER_TOKEN)
    return tokens >= MIN_CUSTOM_STARS_TOKENS ? tokens : null
}

export function buildStarsInvoicePayload(packageId: string): string {
    // Keep payload compact and deterministic (Telegram limit: 1..128 chars)
    return `stars:${packageId}`
}

export function buildCustomStarsPayload(tokens: number, starsAmount: number): string {
    return `custom:${tokens}:${starsAmount}`
}

export interface ParsedStarsPayload {
    type: 'package' | 'custom'
    packageId?: string
    tokens?: number
    starsAmount?: number
}

export function parseStarsInvoicePayload(payloadRaw: string): string | null {
    if (!payloadRaw) return null
    if (payloadRaw.startsWith('stars:')) {
        const id = payloadRaw.slice('stars:'.length).trim()
        return id || null
    }

    // Backward-compatible fallback for old JSON payloads
    try {
        const parsed = JSON.parse(payloadRaw) as { packageId?: string }
        return parsed.packageId || null
    } catch {
        return null
    }
}

export function parseStarsPayload(payloadRaw: string): ParsedStarsPayload | null {
    if (!payloadRaw) return null

    // Custom format: custom:<tokens>:<starsAmount>
    if (payloadRaw.startsWith('custom:')) {
        const parts = payloadRaw.split(':')
        if (parts.length === 3) {
            const tokens = Number(parts[1])
            const starsAmount = Number(parts[2])
            if (Number.isFinite(tokens) && tokens > 0 && Number.isFinite(starsAmount) && starsAmount > 0) {
                return { type: 'custom', tokens, starsAmount }
            }
        }
        return null
    }

    // Package format: stars:<packageId>
    if (payloadRaw.startsWith('stars:')) {
        const id = payloadRaw.slice('stars:'.length).trim()
        return id ? { type: 'package', packageId: id } : null
    }

    // Backward-compatible JSON
    try {
        const parsed = JSON.parse(payloadRaw) as { packageId?: string }
        return parsed.packageId ? { type: 'package', packageId: parsed.packageId } : null
    } catch {
        return null
    }
}
