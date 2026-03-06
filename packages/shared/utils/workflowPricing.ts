import type { WorkflowNode } from '../types/workflow'

export const WORKFLOW_IMAGE_MODEL_OPTIONS = [
  'nanobanana',
  'nanobanana-2',
  'nanobanana-pro',
  'seedream4',
  'seedream4-5',
  'gpt-image-1.5',
  'qwen-image',
] as const

export const WORKFLOW_VIDEO_MODEL_OPTIONS = [
  'seedance-1.5-pro',
  'kling-t2v',
  'kling-i2v',
] as const

const MODEL_PRICES: Record<string, number> = {
  nanobanana: 3,
  'nanobanana-pro': 15,
  'nanobanana-2': 5,
  seedream4: 4,
  'seedream4-5': 7,
  flux: 4,
  'gpt-image-1.5': 5,
  'qwen-image': 2,
  'test-model': 0,
}

const GPT_IMAGE_PRICES: Record<string, number> = {
  medium: 5,
  high: 15,
}

const VIDEO_PRICES: Record<string, Record<string, { base: number; audio: number }>> = {
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

const KLING_VIDEO_PRICES: Record<string, { base: number; audio: number }> = {
  '5': { base: 55, audio: 110 },
  '10': { base: 110, audio: 220 },
}

function calculateVideoCost(resolution: string, duration: string, withAudio: boolean): number {
  const prices = VIDEO_PRICES[resolution]?.[duration]
  if (!prices) return 42
  return withAudio ? prices.audio : prices.base
}

function calculateKlingCost(duration: string, withSound: boolean): number {
  const prices = KLING_VIDEO_PRICES[duration] || KLING_VIDEO_PRICES['5']
  return withSound ? prices.audio : prices.base
}

export function isSeedanceI2V(node: WorkflowNode): boolean {
  if (node.type !== 'video.generate') return false
  const model = String(node.data?.model || 'seedance-1.5-pro')
  const mode = String(node.data?.mode || 'i2v')
  return model === 'seedance-1.5-pro' && mode === 'i2v'
}

export function calculateWorkflowNodeCost(node: WorkflowNode): number {
  if (node.type !== 'image.generate' && node.type !== 'video.generate') {
    return 0
  }

  const model = String(
    node.data?.model || (node.type === 'video.generate' ? 'seedance-1.5-pro' : 'gpt-image-1.5')
  )

  let basePrice = 0

  if (model === 'seedance-1.5-pro') {
    basePrice = calculateVideoCost(
      String(node.data?.video_resolution || '720p'),
      String(node.data?.video_duration || '8'),
      Boolean(node.data?.generate_audio ?? false)
    )
  } else if (model === 'kling-t2v' || model === 'kling-i2v') {
    basePrice = calculateKlingCost(
      String(node.data?.kling_duration || '5'),
      Boolean(node.data?.kling_sound ?? false)
    )
  } else if (model === 'gpt-image-1.5') {
    const quality = String(node.data?.gpt_image_quality || 'medium')
    basePrice = GPT_IMAGE_PRICES[quality] ?? 5
  } else if (model === 'nanobanana-pro') {
    basePrice = String(node.data?.resolution || '1K') === '2K' ? 10 : 15
  } else if (model === 'nanobanana-2') {
    const nb2Prices: Record<string, number> = { '1K': 5, '2K': 7, '4K': 10 }
    basePrice = nb2Prices[String(node.data?.resolution || '1K')] ?? 5
  } else {
    basePrice = MODEL_PRICES[model] ?? 0
  }

  if (node.type === 'image.generate') {
    const imageCount = Math.max(1, Math.min(4, Number(node.data?.image_count || 1)))
    return basePrice * imageCount
  }

  return basePrice
}

export function calculateWorkflowTotalCost(nodes: WorkflowNode[]): number {
  return nodes.reduce((total, node) => total + calculateWorkflowNodeCost(node), 0)
}
