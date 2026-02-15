/**
 * Human-readable labels for order source identifiers.
 * Used in admin notifications to show where the purchase was made.
 */

const SOURCE_LABELS: Record<string, string> = {
    'aiverse_telegram_app': '📱 Mini App',
    'aiverse_hub_bot': '🤖 Хаб-бот',
    'BananNanoBot': '🍌 @BananNanoBot',
    'seedreameditbot': '⚡ @seedreameditbot',
    'GPTimagePro_bot': '🤖 @GPTimagePro_bot',
    'sora_pro_bot': '🎬 Sora Pro Bot',
    'seedancepro_bot': '🌸 @seedancepro_bot',
    'TryOnAI_bot': '👗 @TryOnAI_bot',
    'wan3bot': '🎥 @wan3bot',
    'klingprobot': '🎬 @klingprobot',
}

/**
 * Get a human-readable label for the given source.
 * Falls back to the raw source string if no label is found.
 */
export function getSourceLabel(source?: string | null): string {
    if (!source) return '📱 Mini App'
    return SOURCE_LABELS[source] || source
}
