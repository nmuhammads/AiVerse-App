/**
 * Invisible Fingerprint Utility (Frontend version)
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
