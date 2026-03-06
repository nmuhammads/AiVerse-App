import type { NodeArtifact } from '@aiverse/shared/types/workflow'

export function getArtifactImageUrls(artifact?: NodeArtifact | null): string[] {
  if (!artifact || artifact.type !== 'image') return []
  return artifact.image_urls.filter((item) => typeof item === 'string' && item.trim().length > 0)
}

export function getArtifactPrimaryUrl(artifact?: NodeArtifact | null): string | null {
  if (!artifact) return null
  if (artifact.type === 'image') return getArtifactImageUrls(artifact)[0] || null
  if (artifact.type === 'video') return artifact.video_url || null
  return null
}

export function safeFileBase(input: string): string {
  const trimmed = input.trim().toLowerCase()
  const normalized = trimmed.replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'workflow-result'
}
