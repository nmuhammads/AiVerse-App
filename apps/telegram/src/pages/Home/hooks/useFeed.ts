import { useState, useEffect, useCallback, useRef } from 'react'
import type { FeedItem } from '@/components/FeedImage'

interface UseFeedOptions {
    userId?: number
    sort: 'new' | 'popular'
    modelFilter: string
    viewMode: 'standard' | 'compact'
    feedFilter: 'all' | 'following'
    scrollContainerId?: string
}

interface UseFeedReturn {
    items: FeedItem[]
    loading: boolean
    isFetchingMore: boolean
    hasMore: boolean
    setItems: React.Dispatch<React.SetStateAction<FeedItem[]>>
}

const LIMIT_INITIAL = 6
const LIMIT_MORE = 4
const SCROLL_THRESHOLD = 500

export function useFeed({
    userId,
    sort,
    modelFilter,
    viewMode,
    feedFilter,
    scrollContainerId
}: UseFeedOptions): UseFeedReturn {
    const [items, setItems] = useState<FeedItem[]>([])
    const [loading, setLoading] = useState(true)
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [isFetchingMore, setIsFetchingMore] = useState(false)

    const abortControllerRef = useRef<AbortController | null>(null)

    const fetchFeed = useCallback(async (reset = false) => {
        try {
            let signal = abortControllerRef.current?.signal

            if (reset) {
                // Cancel previous request if we are resetting
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort()
                }
                const controller = new AbortController()
                abortControllerRef.current = controller
                signal = controller.signal

                setLoading(true)
                setOffset(0)
            } else {
                setIsFetchingMore(true)
            }

            console.log(`[useFeed] Fetching feed: reset=${reset}, sort=${sort}, offset=${reset ? 0 : offset}, model=${modelFilter}`)

            const currentOffset = reset ? 0 : offset
            const limit = viewMode === 'compact' ? 9 : (reset ? LIMIT_INITIAL : LIMIT_MORE)
            const userIdParam = userId ? `&user_id=${userId}` : ''
            const filterParam = feedFilter !== 'all' ? `&filter=${feedFilter}` : ''

            const res = await fetch(`/api/feed?limit=${limit}&offset=${currentOffset}&sort=${sort}${userIdParam}${filterParam}&model=${modelFilter}`, { signal })

            if (res.ok) {
                const data = await res.json()
                const newItems = data.items || []
                console.log(`[useFeed] Fetched ${newItems.length} items`)

                if (reset) {
                    setItems(newItems)
                    setLoading(false)
                } else {
                    setItems(prev => {
                        const existingIds = new Set(prev.map(i => i.id))
                        const uniqueNewItems = newItems.filter((i: FeedItem) => !existingIds.has(i.id))
                        return [...prev, ...uniqueNewItems]
                    })
                    setIsFetchingMore(false)
                }

                if (newItems.length < limit) {
                    setHasMore(false)
                } else {
                    setHasMore(true)
                    setOffset(currentOffset + limit)
                }
            } else {
                console.error('[useFeed] Fetch failed:', res.status)
                if (reset) setLoading(false)
                else setIsFetchingMore(false)
            }
        } catch (e: any) {
            if (e.name === 'AbortError') {
                console.log('[useFeed] Fetch aborted')
                return
            }
            console.error('[useFeed] Failed to fetch feed', e)

            if (reset) setLoading(false)
            else setIsFetchingMore(false)
        }
    }, [userId, sort, offset, modelFilter, viewMode, feedFilter])

    // Initial fetch and refetch on filter changes
    useEffect(() => {
        fetchFeed(true)
    }, [sort, userId, modelFilter, feedFilter])

    // Infinite scroll handler (prefers app scroll container, falls back to window)
    useEffect(() => {
        const canFetchMore = () => !loading && !isFetchingMore && hasMore

        const fetchIfNeeded = () => {
            if (canFetchMore()) {
                fetchFeed(false)
            }
        }

        const scrollContainer = scrollContainerId
            ? document.getElementById(scrollContainerId)
            : null

        if (scrollContainer) {
            const handleContainerScroll = () => {
                const reachedBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - SCROLL_THRESHOLD
                if (reachedBottom) {
                    fetchIfNeeded()
                }
            }

            scrollContainer.addEventListener('scroll', handleContainerScroll, { passive: true })
            handleContainerScroll()

            return () => {
                scrollContainer.removeEventListener('scroll', handleContainerScroll)
            }
        }

        const handleWindowScroll = () => {
            const reachedBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - SCROLL_THRESHOLD
            if (reachedBottom) {
                fetchIfNeeded()
            }
        }

        window.addEventListener('scroll', handleWindowScroll, { passive: true })
        return () => {
            window.removeEventListener('scroll', handleWindowScroll)
        }
    }, [loading, isFetchingMore, hasMore, fetchFeed, scrollContainerId])

    return {
        items,
        loading,
        isFetchingMore,
        hasMore,
        setItems
    }
}

