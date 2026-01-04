/**
 * Invisible Fingerprint Utility
 * Uses Zero Width Characters to encode author identifier in prompts
 */

// Zero Width Characters for binary encoding
const ZWC = {
    ZWSP: '\u200B',  // Zero Width Space - bit 0
    ZWNJ: '\u200C',  // Zero Width Non-Joiner - bit 1
}

// Marker to identify fingerprint start/end
const MARKER_START = '\u200D' // Zero Width Joiner
const MARKER_END = '\u2060'   // Word Joiner

/**
 * Encode a string identifier into Zero Width Characters
 */
export function encodeFingerprint(identifier: string): string {
    if (!identifier) return ''

    let binary = ''
    for (let i = 0; i < identifier.length; i++) {
        // Convert each character to 8-bit binary
        binary += identifier.charCodeAt(i).toString(2).padStart(8, '0')
    }

    // Convert binary to ZWC
    let zwc = MARKER_START
    for (const bit of binary) {
        zwc += bit === '0' ? ZWC.ZWSP : ZWC.ZWNJ
    }
    zwc += MARKER_END

    return zwc
}

/**
 * Decode Zero Width Characters back to identifier
 */
export function decodeFingerprint(text: string): string | null {
    if (!text) return null

    // Find fingerprint markers
    const startIdx = text.indexOf(MARKER_START)
    const endIdx = text.indexOf(MARKER_END)

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        return null
    }

    // Extract ZWC sequence
    const zwcSequence = text.slice(startIdx + 1, endIdx)

    // Convert ZWC back to binary
    let binary = ''
    for (const char of zwcSequence) {
        if (char === ZWC.ZWSP) binary += '0'
        else if (char === ZWC.ZWNJ) binary += '1'
    }

    // Convert binary to string (8 bits per character)
    if (binary.length % 8 !== 0) return null

    let result = ''
    for (let i = 0; i < binary.length; i += 8) {
        const byte = binary.slice(i, i + 8)
        result += String.fromCharCode(parseInt(byte, 2))
    }

    return result || null
}

/**
 * Add fingerprint to text
 * Priority: username > user_id
 */
export function addFingerprint(text: string, username: string | null, userId: number): string {
    // Use username if available, otherwise use user_id
    const identifier = username ? `@${username.replace(/^@/, '')}` : String(userId)
    const fingerprint = encodeFingerprint(identifier)

    return text + fingerprint
}

/**
 * Extract fingerprint from text and return clean text + identifier
 */
export function extractFingerprint(text: string): {
    text: string
    identifier: string | null
} {
    if (!text) return { text: '', identifier: null }

    const identifier = decodeFingerprint(text)

    // Remove fingerprint from text
    const startIdx = text.indexOf(MARKER_START)
    const endIdx = text.indexOf(MARKER_END)

    let cleanText = text
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleanText = text.slice(0, startIdx) + text.slice(endIdx + 1)
    }

    return { text: cleanText.trim(), identifier }
}

/**
 * Check if text contains a fingerprint
 */
export function hasFingerprint(text: string): boolean {
    if (!text) return false
    return text.includes(MARKER_START) && text.includes(MARKER_END)
}
