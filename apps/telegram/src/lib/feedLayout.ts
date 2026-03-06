import { useEffect, useState } from 'react'

export type FeedViewMode = 'standard' | 'compact'

export function getFeedColumns(viewMode: FeedViewMode, viewportWidth: number): number {
  if (viewMode === 'standard') {
    if (viewportWidth >= 1440) return 5
    if (viewportWidth >= 1024) return 4
    if (viewportWidth >= 768) return 3
    return 2
  }

  if (viewportWidth >= 1440) return 6
  if (viewportWidth >= 1024) return 5
  if (viewportWidth >= 768) return 4
  return 3
}

export function useFeedColumns(viewMode: FeedViewMode): number {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerWidth
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onResize = () => {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return getFeedColumns(viewMode, viewportWidth)
}

