import type { WorkflowNode } from '@aiverse/shared/types/workflow'
import {
  GPT_IMAGE_PRICES,
  MODEL_PRICES,
  calculateKlingCost,
  calculateVideoCost,
} from '@/pages/Studio/constants'

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

export type WorkflowImageModelId = (typeof WORKFLOW_IMAGE_MODEL_OPTIONS)[number]
export type WorkflowVideoModelId = (typeof WORKFLOW_VIDEO_MODEL_OPTIONS)[number]

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
      't2v',
      String(node.data?.kling_duration || '5') as '5' | '10',
      Boolean(node.data?.kling_sound ?? false)
    )
  } else if (model === 'gpt-image-1.5') {
    const quality = String(node.data?.gpt_image_quality || 'medium') as 'medium' | 'high'
    basePrice = GPT_IMAGE_PRICES[quality] ?? 5
  } else if (model === 'nanobanana-pro') {
    basePrice = String(node.data?.resolution || '1K') === '2K' ? 10 : 15
  } else if (model === 'nanobanana-2') {
    const nb2Prices: Record<string, number> = { '1K': 5, '2K': 7, '4K': 10 }
    basePrice = nb2Prices[String(node.data?.resolution || '1K')] ?? 5
  } else {
    basePrice = MODEL_PRICES[model as keyof typeof MODEL_PRICES] ?? 0
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
