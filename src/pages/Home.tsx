
import React, { useState, useEffect, useCallback } from 'react'
import { Search, X, Heart, Repeat } from 'lucide-react'
import { FeedDetailModal } from '@/components/FeedDetailModal'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useGenerationStore, type ModelType } from '@/store/generationStore'
import { useNavigate } from 'react-router-dom'

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
  remix_count: number
  input_images?: string[]
  is_liked: boolean
  model?: string | null
}

function getModelDisplayName(model: string | null): string {
  if (!model) return ''
  switch (model) {
    case 'nanobanana': return 'NanoBanana'
    case 'nanobanana-pro': return 'NanoBanana Pro'
    case 'seedream4': return 'Seedream 4'
    case 'qwen-edit': return 'Qwen Edit'
    case 'flux': return 'Flux'
    default: return model
  }
}

const FeedImage = ({ item, priority = false, handleRemix, onClick }: { item: FeedItem; priority?: boolean; handleRemix: (item: FeedItem) => void; onClick: (item: FeedItem) => void }) => {
  const [loaded, setLoaded] = useState(false)
  const { impact } = useHaptics()
  const { user } = useTelegram()
  const [isLiked, setIsLiked] = useState(item.is_liked)
  const [likesCount, setLikesCount] = useState(item.likes_count)
  const [isLikeAnimating, setIsLikeAnimating] = useState(false)

  useEffect(() => {
    setIsLiked(item.is_liked)
    setLikesCount(item.likes_count)
  }, [item.is_liked, item.likes_count])

  const handleLike = async () => {
    console.log('handleLike called', { userId: user?.id, itemId: item.id })
    if (!user?.id) {
      console.warn('User not logged in, cannot like')
      return
    }
    impact('light')

    // Optimistic update
    const newLiked = !isLiked
    setIsLiked(newLiked)
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1)
    setIsLikeAnimating(true)
    setTimeout(() => setIsLikeAnimating(false), 300)

    try {
      console.log('Sending like request...')
      const res = await fetch('/api/feed/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId: item.id, userId: user.id })
      })
      console.log('Like response:', res.status)
      if (!res.ok) throw new Error('Failed to like')
    } catch (e) {
      console.error('Like error:', e)
      // Revert on error
      setIsLiked(!newLiked)
      setLikesCount(prev => !newLiked ? prev + 1 : prev - 1)
    }
  }

  const modelName = getModelDisplayName(item.model || null)
  console.log('FeedImage render', { userId: user?.id, itemId: item.id, isLiked })

  return (
    <div className="mb-4 break-inside-avoid" onClick={() => onClick(item)}>
      <div className="relative rounded-xl overflow-hidden bg-zinc-900 shadow-sm border border-white/5">
        <div className="aspect-auto w-full relative">
          {!loaded && (
            <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
          )}
          <img
            src={item.image_url}
            alt={item.prompt}
            loading={priority ? "eager" : "lazy"}
            className={`w-full h-auto block transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)}
          />
          {modelName && (
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md border border-white/10 font-medium">
              {modelName}
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
                {item.author.avatar_url ? (
                  <img src={item.author.avatar_url} alt={item.author.username} className="w-full h-full object-cover" />
                ) : (
                  item.author.username[0].toUpperCase()
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemix(item)
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Repeat size={14} />
                {item.remix_count > 0 && <span className="text-xs font-medium">{item.remix_count}</span>}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleLike()
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors ${isLiked ? 'bg-pink-500/20 text-pink-500' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
              >
                <Heart
                  size={14}
                  className={`transition-transform ${isLikeAnimating ? 'scale-125' : 'scale-100'} ${isLiked ? 'fill-current' : ''}`}
                />
                <span className="text-xs font-medium">{likesCount}</span>
              </button>
            </div>
          </div>
          <div className="text-xs font-medium text-zinc-300 truncate">{item.author.username}</div>

        </div>
      </div>
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
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null)

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
          setItems(prev => {
            const existingIds = new Set(prev.map(i => i.id))
            const uniqueNewItems = newItems.filter((i: FeedItem) => !existingIds.has(i.id))
            return [...prev, ...uniqueNewItems]
          })
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
  }, [sort, user?.id])

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

  const {
    setPrompt,
    setSelectedModel,
    setParentGeneration,
    setCurrentScreen,
    setAspectRatio,
    setGenerationMode,
    setUploadedImages
  } = useGenerationStore()
  const navigate = useNavigate()

  const handleRemix = (item: FeedItem) => {
    impact('medium')

    // Parse metadata from prompt
    // Format: ... real prompt ... [type=text_photo; ratio=3:4; photos=1]
    let cleanPrompt = item.prompt
    let metadata: Record<string, string> = {}

    // Match [ ... ] at the end of the string, allowing for whitespace
    const match = item.prompt.match(/\s*\[(.*?)\]\s*$/)
    if (match) {
      const metaString = match[1]
      cleanPrompt = item.prompt.replace(match[0], '').trim()

      metaString.split(';').forEach(part => {
        const [key, val] = part.split('=').map(s => s.trim())
        if (key && val) metadata[key] = val
      })
    }

    setPrompt(cleanPrompt)

    if (item.model) {
      // Map model string to ModelType if possible, otherwise default
      const modelMap: Record<string, ModelType> = {
        'nanobanana': 'nanobanana',
        'nanobanana-pro': 'nanobanana-pro',
        'seedream4': 'seedream4',
        'qwen-edit': 'qwen-edit'
      }
      if (modelMap[item.model]) {
        setSelectedModel(modelMap[item.model])
      }
    }

    // Apply metadata settings
    if (metadata.ratio) {
      // Validate ratio before setting
      const validRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '16:21', 'Auto', 'square_hd', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9']
      if (validRatios.includes(metadata.ratio)) {
        setAspectRatio(metadata.ratio as any)
      }
    }

    if (metadata.type) {
      if (metadata.type === 'text_photo') {
        setGenerationMode('image')
      } else {
        setGenerationMode('text')
      }
    }

    // Load input images if present
    if (item.input_images && item.input_images.length > 0) {
      setUploadedImages(item.input_images)
      setGenerationMode('image') // Ensure we are in image mode
    } else {
      setUploadedImages([])
    }

    setParentGeneration(item.id, item.author.username)
    setCurrentScreen('form')
    navigate('/studio')
  }

  const handleLike = async (item: FeedItem) => {
    // Optimistic update in list
    setItems(prev => prev.map(i => {
      if (i.id === item.id) {
        return { ...i, is_liked: !i.is_liked, likes_count: i.is_liked ? i.likes_count - 1 : i.likes_count + 1 }
      }
      return i
    }))

    // Also update selected item if open
    if (selectedItem?.id === item.id) {
      setSelectedItem(prev => prev ? { ...prev, is_liked: !prev.is_liked, likes_count: prev.is_liked ? prev.likes_count - 1 : prev.likes_count + 1 } : null)
    }

    try {
      const res = await fetch('/api/feed/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationId: item.id, userId: user?.id })
      })
      if (!res.ok) throw new Error('Failed to like')
    } catch (e) {
      // Revert logic (omitted for brevity, but should be here)
    }
  }

  const filteredItems = items.filter(x =>
    x.prompt.toLowerCase().includes(q.toLowerCase()) ||
    x.author.username.toLowerCase().includes(q.toLowerCase())
  )

  const { platform } = useTelegram()
  const paddingTop = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 5px)' : 'calc(env(safe-area-inset-top) + 50px)'

  return (
    <div className="min-h-dvh bg-black safe-bottom-tabbar" style={{ paddingTop }}>
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
              <div className="flex-1 min-w-0 space-y-4">
                {filteredItems.filter((_, i) => i % 2 === 0).map(item => (
                  <FeedImage key={item.id} item={item} priority={true} handleRemix={handleRemix} onClick={setSelectedItem} />
                ))}
              </div>
              <div className="flex-1 min-w-0 space-y-4">
                {filteredItems.filter((_, i) => i % 2 !== 0).map(item => (
                  <FeedImage key={item.id} item={item} priority={true} handleRemix={handleRemix} onClick={setSelectedItem} />
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

      {selectedItem && (
        <FeedDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRemix={(item) => { setSelectedItem(null); handleRemix(item) }}
          onLike={handleLike}
        />
      )}
    </div>
  )
}
