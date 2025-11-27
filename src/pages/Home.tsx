import React, { useState, useEffect, useCallback } from 'react'
import { Search, X, Heart } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'

interface FeedItem {
  id: number
  image_url: string
  prompt: string
  created_at: string
  author: {
    id: number
    username: string
    first_name?: string
    avatar_url: string
  }
  likes_count: number
  is_liked: boolean
}

// Component for smooth image loading
const FeedImage = ({ src, alt }: { src: string, alt: string }) => {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <div className="relative w-full bg-zinc-900 aspect-[3/4]">
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800" />
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  )
}

export default function Home() {
  const { impact } = useHaptics()
  const { user } = useTelegram()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'new' | 'popular'>('new')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)

  const LIMIT_INITIAL = 6
  const LIMIT_MORE = 4

  const fetchFeed = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true)
        setOffset(0)
      } else {
        setIsFetchingMore(true)
      }

      const currentOffset = reset ? 0 : offset
      const limit = reset ? LIMIT_INITIAL : LIMIT_MORE
      const userIdParam = user?.id ? `&user_id=${user.id}` : ''

      const res = await fetch(`/api/feed?limit=${limit}&offset=${currentOffset}&sort=${sort}${userIdParam}`)

      if (res.ok) {
        const data = await res.json()
        const newItems = data.items || []

        if (reset) {
          setItems(newItems)
        } else {
          setItems(prev => [...prev, ...newItems])
        }

        if (newItems.length < limit) {
          setHasMore(false)
        } else {
          setHasMore(true)
          setOffset(currentOffset + limit)
        }
      }
    } catch (e) {
      console.error('Failed to fetch feed', e)
    } finally {
      setLoading(false)
      setIsFetchingMore(false)
    }
  }, [user?.id, sort, offset])

  useEffect(() => {
    fetchFeed(true)
  }, [sort])

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        if (!loading && !isFetchingMore && hasMore) {
          fetchFeed(false)
        }
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loading, isFetchingMore, hasMore, fetchFeed])

  const handleLike = async (id: number) => {
    impact('light')
    if (!user?.id) return

    // Optimistic update
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          is_liked: !item.is_liked,
          likes_count: item.is_liked ? item.likes_count - 1 : item.likes_count + 1
        }
      }
      return item
    }))

    try {
      await fetch('/api/feed/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId: id, userId: user.id })
      })
    } catch (e) {
      console.error('Like failed', e)
      // Revert on error could be added here
    }
  }

  const filteredItems = items.filter(x =>
    x.prompt.toLowerCase().includes(q.toLowerCase()) ||
    x.author.username.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="min-h-dvh bg-black safe-bottom-tabbar">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <div className="flex items-center justify-between mb-4 px-1 h-10">
          {!isSearchOpen ? (
            <>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setSort('new'); impact('light') }}
                  className={`text-lg font-bold tracking-tight transition-colors ${sort === 'new' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Новое
                </button>
                <div className="w-[1px] h-4 bg-zinc-800"></div>
                <button
                  onClick={() => { setSort('popular'); impact('light') }}
                  className={`text-lg font-bold tracking-tight transition-colors ${sort === 'popular' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Популярное
                </button>
              </div>
              <button onClick={() => { setIsSearchOpen(true); impact('light') }} className="flex items-center justify-center w-10 h-10 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-white/10 transition-all active:scale-95">
                <Search size={18} />
              </button>
            </>
          ) : (
            <div className="flex-1 flex items-center gap-2 w-full">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти промпт..." className="w-full bg-zinc-900 border border-violet-500/50 rounded-full py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all placeholder:text-zinc-600" />
              </div>
              <button onClick={() => { setIsSearchOpen(false); setQ(''); impact('light') }} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white rounded-full hover:bg-white/5">
                <X size={20} />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center text-zinc-500 py-10">Загрузка...</div>
        ) : (
          <div className="pb-20">
            <div className="flex gap-4 items-start">
              <div className="flex-1 space-y-4">
                {filteredItems.filter((_, i) => i % 2 === 0).map(item => (
                  <div key={item.id} className="rounded-lg overflow-hidden border border-white/10 bg-white/5">
                    <FeedImage src={item.image_url} alt={item.prompt} />
                    <div className="p-3 text-white text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={item.author.avatar_url} alt={item.author.username} className="w-5 h-5 rounded-full bg-zinc-800 flex-shrink-0" />
                        <span className="truncate text-xs text-zinc-300">{item.author.username}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400 flex-shrink-0">
                        <button onClick={() => handleLike(item.id)} className="flex items-center gap-1 hover:text-white transition-colors">
                          <Heart size={14} className={item.is_liked ? "fill-rose-500 text-rose-500" : ""} />
                          <span className="text-xs">{item.likes_count}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex-1 space-y-4">
                {filteredItems.filter((_, i) => i % 2 !== 0).map(item => (
                  <div key={item.id} className="rounded-lg overflow-hidden border border-white/10 bg-white/5">
                    <FeedImage src={item.image_url} alt={item.prompt} />
                    <div className="p-3 text-white text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img src={item.author.avatar_url} alt={item.author.username} className="w-5 h-5 rounded-full bg-zinc-800 flex-shrink-0" />
                        <span className="truncate text-xs text-zinc-300">{item.author.username}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400 flex-shrink-0">
                        <button onClick={() => handleLike(item.id)} className="flex items-center gap-1 hover:text-white transition-colors">
                          <Heart size={14} className={item.is_liked ? "fill-rose-500 text-rose-500" : ""} />
                          <span className="text-xs">{item.likes_count}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {!loading && filteredItems.length === 0 && (
              <div className="text-center text-zinc-500 py-10 w-full">Нет публикаций</div>
            )}
            {isFetchingMore && (
              <div className="text-center text-zinc-500 py-4 w-full">Загрузка еще...</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
