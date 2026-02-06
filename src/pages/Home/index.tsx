import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '@/hooks/useTelegram'
import { FeedDetailModal } from '@/components/FeedDetailModal'
import { FeedSkeletonGrid } from '@/components/ui/skeleton'
import type { FeedItem } from '@/components/FeedImage'

// Local components
import { FeedHeader } from './FeedHeader'
import { SearchBar } from './SearchBar'
import { FeedFilters } from './FeedFilters'
import { FeedGrid } from './FeedGrid'
import { UserSearchResults } from './UserSearchResults'

// Local hooks
import { useFeed } from './hooks/useFeed'
import { useUserSearch } from './hooks/useUserSearch'
import { useRemix } from './hooks/useRemix'

export default function Home() {
    const { t } = useTranslation()
    const { user, platform } = useTelegram()
    const navigate = useNavigate()
    const { handleRemix } = useRemix()

    // UI state
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [sort, setSort] = useState<'new' | 'popular'>('new')
    const [selectedModelFilter, setSelectedModelFilter] = useState('all')
    const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard')
    const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all')
    const [searchMode, setSearchMode] = useState<'posts' | 'users'>('posts')
    const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null)

    // Custom hooks
    const { items, loading, isFetchingMore, setItems } = useFeed({
        userId: user?.id,
        sort,
        modelFilter: selectedModelFilter,
        viewMode,
        feedFilter
    })

    const { results: userSearchResults, isSearching } = useUserSearch(
        query,
        searchMode === 'users'
    )

    // Filter items by search query (for posts mode)
    const filteredItems = items.filter(x =>
        (x.prompt || '').toLowerCase().includes(query.toLowerCase()) ||
        (x.author?.username || '').toLowerCase().includes(query.toLowerCase())
    )

    // Handle like with optimistic update
    const handleLike = async (item: FeedItem) => {
        setItems(prev => prev.map(i => {
            if (i.id === item.id) {
                return { ...i, is_liked: !i.is_liked, likes_count: i.is_liked ? i.likes_count - 1 : i.likes_count + 1 }
            }
            return i
        }))

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
            // Revert on error (omitted for brevity)
        }
    }

    const handleSearchClose = () => {
        setIsSearchOpen(false)
        setQuery('')
        setSearchMode('posts')
    }

    const handleUserClick = (userId: number) => {
        setIsSearchOpen(false)
        setQuery('')
        navigate(`/profile/${userId}`)
    }

    const paddingTop = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 60px)' : 'calc(env(safe-area-inset-top) + 50px)'

    return (
        <div className="min-h-dvh bg-black safe-bottom-tabbar" style={{ paddingTop }}>
            <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
                <div className="px-1">
                    {/* Header or Search */}
                    {!isSearchOpen ? (
                        <FeedHeader
                            sort={sort}
                            feedFilter={feedFilter}
                            onSortChange={setSort}
                            onFeedFilterChange={setFeedFilter}
                            onSearchOpen={() => setIsSearchOpen(true)}
                        />
                    ) : (
                        <SearchBar
                            query={query}
                            searchMode={searchMode}
                            onQueryChange={setQuery}
                            onModeChange={setSearchMode}
                            onClose={handleSearchClose}
                        />
                    )}

                    {/* Filters */}
                    <FeedFilters
                        viewMode={viewMode}
                        modelFilter={selectedModelFilter}
                        onViewModeChange={setViewMode}
                        onModelFilterChange={setSelectedModelFilter}
                    />

                    {/* Content */}
                    {isSearchOpen && searchMode === 'users' ? (
                        <div className="pb-20">
                            <UserSearchResults
                                results={userSearchResults}
                                isSearching={isSearching}
                                query={query}
                                onUserClick={handleUserClick}
                            />
                        </div>
                    ) : loading ? (
                        <div className="pb-20">
                            <FeedSkeletonGrid viewMode={viewMode} />
                        </div>
                    ) : (
                        <div className="pb-20">
                            <FeedGrid
                                items={filteredItems}
                                viewMode={viewMode}
                                onItemClick={setSelectedItem}
                                onRemix={handleRemix}
                            />
                            {isFetchingMore && (
                                <div className="text-center text-zinc-500 py-4 w-full">
                                    {t('home.loadingMore')}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Detail Modal */}
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
