import type { ModelType, AspectRatio, GptImageQuality, KlingVideoMode, KlingDuration, KlingMCQuality } from '@/store/generationStore'

// Модели для генерации изображений
const ALL_IMAGE_MODELS: { id: ModelType; color: string; icon: string; devOnly?: boolean }[] = [
    { id: 'nanobanana', color: 'from-yellow-400 to-orange-500', icon: '/models/optimized/nanobanana.png' },
    { id: 'nanobanana-pro', color: 'from-pink-500 to-rose-500', icon: '/models/optimized/nanobanana-pro.png' },
    { id: 'seedream4', color: 'from-purple-400 to-fuchsia-500', icon: '/models/optimized/seedream.png' },
    { id: 'seedream4-5', color: 'from-blue-400 to-indigo-500', icon: '/models/optimized/seedream-4-5.png' },
    { id: 'gpt-image-1.5', color: 'from-cyan-400 to-blue-500', icon: '/models/optimized/gpt-image.png' },
    { id: 'test-model', color: 'from-green-400 to-emerald-500', icon: '/models/optimized/nanobanana.png', devOnly: true },
]

// Фильтруем модели по DEV режиму
const IS_DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'
export const IMAGE_MODELS = ALL_IMAGE_MODELS.filter(m => !m.devOnly || IS_DEV_MODE)

// Модели для генерации видео
export const VIDEO_MODELS: { id: ModelType; color: string; icon: string }[] = [
    { id: 'seedance-1.5-pro', color: 'from-red-500 to-orange-500', icon: '/models/optimized/seedream.png' },
    { id: 'kling-t2v', color: 'from-cyan-500 to-blue-500', icon: '/models/optimized/kling.png' },
]

export const MODEL_PRICES: Record<ModelType, number> = {
    nanobanana: 3,
    'nanobanana-pro': 15,
    seedream4: 4,
    'seedream4-5': 7,
    'p-image-edit': 2,
    'seedance-1.5-pro': 42,
    'gpt-image-1.5': 5,
    'test-model': 0,
    'kling-t2v': 55,
    'kling-i2v': 55,
    'kling-mc': 30,
}

// Цены для GPT Image 1.5 по качеству
export const GPT_IMAGE_PRICES: Record<GptImageQuality, number> = {
    medium: 5,
    high: 15,
}

export const SUPPORTED_RATIOS: Record<ModelType, AspectRatio[]> = {
    'nanobanana-pro': ['Auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
    seedream4: ['16:9', '4:3', '1:1', '3:4', '9:16'],
    nanobanana: ['Auto', '16:9', '4:3', '1:1', '3:4', '9:16'],
    'seedream4-5': ['16:9', '4:3', '1:1', '3:4', '9:16'],
    'p-image-edit': ['Auto', '1:1', '16:9', '9:16', '4:3', '3:4'],
    'seedance-1.5-pro': ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
    'gpt-image-1.5': ['1:1', '2:3', '3:2'],
    'test-model': ['1:1', '16:9', '9:16'],
    'kling-t2v': ['1:1', '16:9', '9:16'],
    'kling-i2v': ['1:1', '16:9', '9:16'],
    'kling-mc': ['1:1', '16:9', '9:16'],
}

// Цены для видео Seedance 1.5 Pro
export const VIDEO_PRICES: Record<string, Record<string, { base: number; audio: number }>> = {
    '480p': {
        '4': { base: 12, audio: 24 },
        '8': { base: 21, audio: 42 },
        '12': { base: 29, audio: 58 },
    },
    '720p': {
        '4': { base: 24, audio: 48 },
        '8': { base: 42, audio: 84 },
        '12': { base: 58, audio: 116 },
    },
}

export const calculateVideoCost = (resolution: string, duration: string, withAudio: boolean): number => {
    const prices = VIDEO_PRICES[resolution]?.[duration]
    if (!prices) return 42
    return withAudio ? prices.audio : prices.base
}

// === Цены для Kling AI ===
export const KLING_VIDEO_PRICES: Record<string, { base: number; audio: number }> = {
    '5': { base: 55, audio: 110 },
    '10': { base: 110, audio: 220 },
}

export const KLING_MC_PRICES: Record<string, number> = {
    '720p': 6,
    '1080p': 9,
}

export const calculateKlingCost = (
    mode: KlingVideoMode,
    duration: KlingDuration,
    withSound: boolean,
    mcQuality: KlingMCQuality = '720p',
    videoDurationSeconds: number = 0
): number => {
    if (mode === 'motion-control') {
        const pricePerSec = KLING_MC_PRICES[mcQuality]
        const effectiveDuration = Math.max(5, videoDurationSeconds)
        return effectiveDuration * pricePerSec
    }
    const prices = KLING_VIDEO_PRICES[duration]
    return withSound ? prices.audio : prices.base
}

export const RATIO_EMOJIS: Record<AspectRatio, string> = {
    'Auto': '✨',
    '1:1': '🟧',
    '16:9': '🖥️',
    '9:16': '📱',
    '4:3': '📺',
    '3:4': '📕',
    '21:9': '🎬',
    '16:21': '📜',
    '2:3': '📷',
    '3:2': '🖼️',
    'square_hd': '🟧',
    'portrait_4_3': '📕',
    'portrait_16_9': '📱',
    'landscape_4_3': '📺',
    'landscape_16_9': '🖥️'
}

export const RATIO_DISPLAY_NAMES: Record<string, string> = {
    'square_hd': '1:1',
    'portrait_4_3': '3:4',
    'portrait_16_9': '9:16',
    'landscape_4_3': '4:3',
    'landscape_16_9': '16:9',
}
