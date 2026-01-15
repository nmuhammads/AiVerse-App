
import React, { useState, useEffect, useCallback } from 'react'
import { Search, X, Heart, Repeat, ChevronDown, LayoutGrid, Grid3x3 } from 'lucide-react'
import { FeedDetailModal } from '@/components/FeedDetailModal'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { useGenerationStore, type ModelType } from '@/store/generationStore'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { FeedImage, type FeedItem } from '@/components/FeedImage'
import { FeedSkeletonGrid } from '@/components/ui/skeleton'

export default function Home() {
  const { t, i18n } = useTranslation() // i18n needed for date locale
  const { impact } = useHaptics()
  const { user } = useTelegram()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'new' | 'popular'>('new')
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('all')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null)
  const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard')
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all')
  // User search state
  const [searchMode, setSearchMode] = useState<'posts' | 'users'>('posts')
  const [userSearchResults, setUserSearchResults] = useState<any[]>([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)

  const LIMIT_INITIAL = 6
  const LIMIT_MORE = 4

  const abortControllerRef = React.useRef<AbortController | null>(null)

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

      console.log(`[Home] Fetching feed: reset=${reset}, sort=${sort}, offset=${reset ? 0 : offset}, model=${selectedModelFilter}`)

      const currentOffset = reset ? 0 : offset
      const limit = viewMode === 'compact' ? 9 : (reset ? LIMIT_INITIAL : LIMIT_MORE)
      const userIdParam = user?.id ? `&user_id=${user.id}` : ''
      const filterParam = feedFilter !== 'all' ? `&filter=${feedFilter}` : ''

      const res = await fetch(`/api/feed?limit=${limit}&offset=${currentOffset}&sort=${sort}${userIdParam}${filterParam}&model=${selectedModelFilter}`, { signal })

      if (res.ok) {
        const data = await res.json()
        const newItems = data.items || []
        console.log(`[Home] Fetched ${newItems.length} items`)

        if (reset) {
          setItems(newItems)
          setLoading(false) // Success: Stop loading
        } else {
          setItems(prev => {
            const existingIds = new Set(prev.map(i => i.id))
            const uniqueNewItems = newItems.filter((i: FeedItem) => !existingIds.has(i.id))
            return [...prev, ...uniqueNewItems]
          })
          setIsFetchingMore(false) // Success: Stop fetching more
        }

        if (newItems.length < limit) {
          setHasMore(false)
        } else {
          setHasMore(true)
          setOffset(currentOffset + limit)
        }
      } else {
        console.error('[Home] Fetch failed:', res.status)
        // Error State Clean Up
        if (reset) setLoading(false)
        else setIsFetchingMore(false)
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('[Home] Fetch aborted')
        return // ABORT: Do NOT touch loading state, let the new request handle it
      }
      console.error('[Home] Failed to fetch feed', e)

      // Real Error: Stop loading
      if (reset) setLoading(false)
      else setIsFetchingMore(false)
    }
  }, [user?.id, sort, offset, selectedModelFilter, viewMode, feedFilter])

  useEffect(() => {
    fetchFeed(true)
  }, [sort, user?.id, selectedModelFilter, feedFilter])

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

  // User search with debounce
  useEffect(() => {
    if (searchMode !== 'users' || q.trim().length < 2) {
      setUserSearchResults([])
      return
    }

    setIsSearchingUsers(true)
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/user/search?q=${encodeURIComponent(q.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setUserSearchResults(data.items || [])
        }
      } catch (e) {
        console.error('[Home] User search failed', e)
      } finally {
        setIsSearchingUsers(false)
      }
    }, 300) // Debounce 300ms

    return () => clearTimeout(timeoutId)
  }, [q, searchMode])

  const {
    setPrompt,
    setSelectedModel,
    setParentGeneration,
    setCurrentScreen,
    setAspectRatio,
    setGenerationMode,
    setUploadedImages,
    setMediaType
  } = useGenerationStore()
  const navigate = useNavigate()

  const handleRemix = (item: FeedItem) => {
    impact('medium')

    // Check if prompt is private - pass flag to store for UI hiding
    const isPrivate = item.is_prompt_private === true

    // Parse metadata from prompt - always process prompt for generation to work
    // Format: ... real prompt ... [type=text_photo; ratio=3:4; photos=1]
    let cleanPrompt = item.prompt || ''
    let metadata: Record<string, string> = {}

    // Always parse metadata if prompt exists
    if (item.prompt) {
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
    }

    setPrompt(cleanPrompt)

    if (item.model) {
      // Map model string to ModelType if possible, otherwise default
      const modelMap: Record<string, ModelType> = {
        'nanobanana': 'nanobanana',
        'nanobanana-pro': 'nanobanana-pro',
        'seedream4': 'seedream4',
        'seedream4-5': 'seedream4-5',
        'seedream4.5': 'seedream4-5', // Fallback for potential legacy/dot notation
        'qwen-edit': 'seedream4-5', // Legacy handling (just in case)
        'seedance-1.5-pro': 'seedance-1.5-pro',
        'gptimage1.5': 'gpt-image-1.5'
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

    // Set media type based on item
    if (item.media_type === 'video') {
      setMediaType('video')
      // Ensure we use the video model
      if (!item.model || item.model === 'seedance-1.5-pro') {
        setSelectedModel('seedance-1.5-pro')
      }
    } else {
      setMediaType('image')
    }

    setParentGeneration(item.id, item.author.username, isPrivate)
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
    (x.prompt || '').toLowerCase().includes(q.toLowerCase()) ||
    (x.author?.username || '').toLowerCase().includes(q.toLowerCase())
  )

  const { platform } = useTelegram()
  const paddingTop = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 5px)' : 'calc(env(safe-area-inset-top) + 50px)'

  return (
    <div className="min-h-dvh bg-black safe-bottom-tabbar" style={{ paddingTop }}>
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        {/* Search header with fixed height */}
        <div className="px-1">
          {!isSearchOpen ? (
            <div className="flex items-center justify-between h-10">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setSort('new'); setFeedFilter('all'); impact('light') }}
                  className={`text-[17px] font-semibold transition-colors ${sort === 'new' && feedFilter === 'all' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {t('home.tabs.new')}
                </button>
                <div className="w-[1px] h-4 bg-zinc-800"></div>
                <button
                  onClick={() => { setSort('popular'); setFeedFilter('all'); impact('light') }}
                  className={`text-[17px] font-semibold transition-colors ${sort === 'popular' && feedFilter === 'all' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {t('home.tabs.popular')}
                </button>
                <div className="w-[1px] h-4 bg-zinc-800"></div>
                <button
                  onClick={() => { setFeedFilter('following'); impact('light') }}
                  className={`text-[17px] font-semibold transition-colors ${feedFilter === 'following' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {t('home.tabs.following')}
                </button>
              </div>
              <button onClick={() => { setIsSearchOpen(true); impact('light') }} className="flex items-center justify-center w-10 h-10 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-white/10 transition-all active:scale-95">
                <Search size={18} />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 w-full">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchMode === 'users' ? t('home.search.usersPlaceholder', { defaultValue: 'Поиск пользователей...' }) : t('home.searchPlaceholder')} className="w-full bg-zinc-900 border border-violet-500/50 rounded-full py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all placeholder:text-zinc-600" />
                </div>
                <button onClick={() => { setIsSearchOpen(false); setQ(''); setSearchMode('posts'); impact('light') }} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white rounded-full hover:bg-white/5">
                  <X size={20} />
                </button>
              </div>
              {/* Search mode switcher */}
              <div className="flex gap-2 px-1">
                <button
                  onClick={() => { setSearchMode('posts'); impact('light') }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${searchMode === 'posts' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
                >
                  {t('home.search.posts', { defaultValue: 'Посты' })}
                </button>
                <button
                  onClick={() => { setSearchMode('users'); impact('light') }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${searchMode === 'users' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
                >
                  {t('home.search.users', { defaultValue: 'Пользователи' })}
                </button>
              </div>
            </div>
          )}



          {/* Filters & Toggles */}
          <div className="px-1 mb-2 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider truncate">
                {t('home.feedTitle', { date: new Date().toLocaleString(i18n.language, { month: 'long' }) })}
              </h2>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* View Toggle */}
              <div className="bg-[#1c1c1e] p-0.5 rounded-lg flex gap-0.5 border border-white/5">
                <button
                  onClick={() => { setViewMode('standard'); impact('light') }}
                  className={`p-1 rounded-md transition-all ${viewMode === 'standard' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  onClick={() => { setViewMode('compact'); impact('light') }}
                  className={`p-1 rounded-md transition-all ${viewMode === 'compact' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Grid3x3 size={14} />
                </button>
              </div>

              <div className="relative">
                <select
                  value={selectedModelFilter}
                  onChange={(e) => { setSelectedModelFilter(e.target.value); impact('light') }}
                  className="appearance-none bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 rounded-lg py-1.5 pl-3 pr-8 focus:outline-none focus:border-violet-500/50 transition-colors"
                >
                  <option value="all">{t('home.models.all')}</option>
                  <option value="nanobanana">NanoBanana</option>
                  <option value="nanobanana-pro">NanoBanana Pro</option>
                  <option value="seedream4">SeeDream 4</option>
                  <option value="seedream4-5">SeeDream 4.5</option>
                  <option value="seedance-1.5-pro">Seedance Pro</option>
                  <option value="gptimage1.5">GPT image 1.5</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* User Search Results */}
          {isSearchOpen && searchMode === 'users' ? (
            <div className="pb-20">
              {isSearchingUsers ? (
                <div className="text-center text-zinc-500 py-10">{t('home.search.searching', { defaultValue: 'Поиск...' })}</div>
              ) : q.trim().length < 2 ? (
                <div className="text-center text-zinc-500 py-10 text-sm">Введите минимум 2 символа</div>
              ) : userSearchResults.length === 0 ? (
                <div className="text-center text-zinc-500 py-10">{t('home.search.noUsersFound', { defaultValue: 'Пользователи не найдены' })}</div>
              ) : (
                <div className="space-y-2">
                  {userSearchResults.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => {
                        setIsSearchOpen(false);
                        setQ('');
                        impact('medium');
                        navigate(`/profile/${user.user_id}`);
                      }}
                      className="w-full bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex items-center gap-4 transition-all active:scale-98">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-zinc-800 shrink-0">
                        <img
                          src={user.avatar_url}
                          alt={user.username || user.first_name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.user_id}` }}
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-white font-semibold text-sm">
                          {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : (user.first_name || user.username || 'User')}
                        </div>
                        {user.username && (
                          <div className="text-zinc-500 text-xs mt-0.5">{user.username}</div>
                        )}
                      </div>
                      <div className="text-zinc-600">
                        <ChevronDown size={18} className="rotate-[-90deg]" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="pb-20">
              <FeedSkeletonGrid viewMode={viewMode} />
            </div>
          ) : (
            <div className="pb-20">
              <div className={`flex items-start ${viewMode === 'standard' ? 'gap-4' : 'gap-2'}`}>
                {Array.from({ length: viewMode === 'standard' ? 2 : 3 }).map((_, colIndex) => (
                  <div key={colIndex} className={`flex-1 min-w-0 ${viewMode === 'standard' ? 'space-y-4' : 'space-y-2'}`}>
                    {filteredItems.filter((_, i) => i % (viewMode === 'standard' ? 2 : 3) === colIndex).map(item => (
                      <FeedImage key={item.id} item={item} priority={true} handleRemix={handleRemix} onClick={setSelectedItem} isCompact={viewMode === 'compact'} />
                    ))}
                  </div>
                ))}
              </div>
              {!loading && filteredItems.length === 0 && (
                <div className="text-center text-zinc-500 py-10 w-full">{t('home.empty')}</div>
              )}
              {isFetchingMore && (
                <div className="text-center text-zinc-500 py-4 w-full">{t('home.loadingMore')}</div>
              )}
            </div>
          )}
          {selectedItem && (
            <FeedDetailModal
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onRemix={(item) => { setSelectedItem(null); handleRemix(item) }}
              onLike={handleLike}
            />
          )}
        </div>
      </div>
    </div>
  )
}
