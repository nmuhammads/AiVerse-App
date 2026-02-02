import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FeedHeader, FeedFilters, FeedCard, FeedDetailModal, SearchBar, FeedItem, FeedGrid } from '../../components/feed';
import { FeedSkeletonGrid } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { api, getApiUrl } from '../../lib/api';
import { useUserStore } from '../../store/userStore';

export default function FeedScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const userId = useUserStore((state) => state.user.id);

    // State
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sort, setSort] = useState<'new' | 'popular'>('new');
    const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all');
    const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard');
    const [modelFilter, setModelFilter] = useState('all');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Fetch feed from API
    const fetchFeed = useCallback(async (isRefresh = false) => {
        if (!hasMore && !isRefresh) return;
        if (loadingMore && !isRefresh) return;

        try {
            if (isRefresh) {
                setRefreshing(true);
                setPage(1);
            } else if (items.length === 0) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const currentPage = isRefresh ? 1 : page;
            const params = new URLSearchParams({
                sort: sort === 'new' ? 'created_at' : 'likes',
                limit: '20',
                page: String(currentPage),
            });

            if (modelFilter !== 'all') {
                params.append('model', modelFilter);
            }

            console.log(`Fetching feed from: ${getApiUrl()}/api/feed?${params}`);
            const response = await fetch(`${getApiUrl()}/api/feed?${params}&user_id=${userId}`);

            if (!response.ok) {
                console.error(`Feed fetch failed: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to fetch feed: ${response.status}`);
            }

            const data = await response.json() as {
                items: Array<{
                    id: number;
                    image_url?: string;
                    compressed_url?: string;
                    prompt?: string;
                    model?: string;
                    likes_count?: number;
                    is_liked?: boolean;
                    author?: {
                        id: number;
                        username?: string;
                        first_name?: string;
                        avatar_url?: string;
                    };
                    created_at?: string;
                }>
            };

            const feedData = data.items || [];

            if (feedData.length < 20) {
                setHasMore(false);
            }

            // Transform API response to FeedItem format
            const feedItems: FeedItem[] = feedData.map((item) => ({
                id: String(item.id),
                image_url: item.compressed_url || item.image_url || '',
                original_url: item.image_url,
                prompt: item.prompt,
                model: item.model,
                likes_count: item.likes_count || 0,
                is_liked: item.is_liked || false,
                author: item.author ? {
                    id: item.author.id,
                    username: item.author.username || item.author.first_name,
                    avatar_url: item.author.avatar_url,
                } : undefined,
                created_at: item.created_at,
            }));

            if (isRefresh) {
                setItems(feedItems);
                setHasMore(true);
            } else {
                setItems(prev => {
                    const existingIds = new Set(prev.map(i => i.id));
                    const newItems = feedItems.filter(i => !existingIds.has(i.id));

                    if (newItems.length === 0 && feedItems.length > 0) {
                        setHasMore(false);
                        return prev;
                    }

                    return [...prev, ...newItems];
                });
            }

            if (!isRefresh) {
                setPage(prev => prev + 1);
            }

        } catch (error) {
            console.error('Error fetching feed:', error);
            if (isRefresh && items.length === 0) {
                setItems(generatePlaceholderData());
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    }, [sort, modelFilter, page, hasMore, loadingMore, items.length]);

    // Generate placeholder data for offline/error state
    const generatePlaceholderData = (): FeedItem[] => {
        return Array.from({ length: 10 }, (_, i) => ({
            id: String(i + 1),
            image_url: '',
            prompt: `Beautiful ${['sunset', 'landscape', 'portrait', 'abstract', 'space'][i % 5]} generated with AI`,
            model: ['NanoBanana', 'SeeDream 4', 'GPT Image', 'Flux'][i % 4],
            likes_count: Math.floor(Math.random() * 500),
            is_liked: Math.random() > 0.7,
            author: {
                id: i + 100,
                username: `user_${i + 1}`,
            },
        }));
    };

    useEffect(() => {
        fetchFeed();
    }, [fetchFeed]);

    const onRefresh = useCallback(() => {
        fetchFeed(true);
    }, [fetchFeed]);

    const handleLoadMore = useCallback(() => {
        fetchFeed(false);
    }, [fetchFeed]);

    const handleLike = useCallback(async (item: FeedItem) => {
        const wasLiked = item.is_liked;

        // Optimistic update
        setItems(prev =>
            prev.map(i =>
                i.id === item.id
                    ? {
                        ...i,
                        is_liked: !i.is_liked,
                        likes_count: i.is_liked ? i.likes_count - 1 : i.likes_count + 1,
                    }
                    : i
            )
        );

        // Update selected item if open
        if (selectedItem?.id === item.id) {
            setSelectedItem(prev => prev ? {
                ...prev,
                is_liked: !prev.is_liked,
                likes_count: prev.is_liked ? prev.likes_count - 1 : prev.likes_count + 1,
            } : null);
        }

        // Real API call for like
        try {
            await api.post('/feed/like', {
                generationId: Number(item.id),
                userId: userId,
            });
        } catch (error) {
            console.error('Like failed:', error);
            // Revert on error
            setItems(prev =>
                prev.map(i =>
                    i.id === item.id
                        ? {
                            ...i,
                            is_liked: wasLiked,
                            likes_count: wasLiked ? i.likes_count + 1 : i.likes_count - 1,
                        }
                        : i
                )
            );
        }
    }, [selectedItem, userId]);

    const handleItemPress = useCallback((item: FeedItem) => {
        setSelectedItem(item);
    }, []);

    const handleRemix = useCallback((item: FeedItem) => {
        setSelectedItem(null);
        // Navigate to studio with remix data
        router.push({
            pathname: '/studio',
            params: {
                remixId: item.id,
                prompt: item.prompt || '',
            },
        });
    }, [router]);

    const handleSearchClose = useCallback(() => {
        setIsSearchOpen(false);
        setSearchQuery('');
    }, []);

    // Filter items by search and model
    const filteredItems = items.filter(item => {
        // Model filter
        if (modelFilter !== 'all') {
            const itemModel = item.model?.toLowerCase() || '';
            if (!itemModel.includes(modelFilter.toLowerCase())) {
                return false;
            }
        }

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const matchesPrompt = (item.prompt || '').toLowerCase().includes(query);
            const matchesUser = (item.author?.username || '').toLowerCase().includes(query);
            return matchesPrompt || matchesUser;
        }

        return true;
    });

    const ListHeaderComponent = useCallback(() => (
        <View style={styles.header}>
            {isSearchOpen ? (
                <SearchBar
                    query={searchQuery}
                    onQueryChange={setSearchQuery}
                    onClose={handleSearchClose}
                />
            ) : (
                <FeedHeader
                    sort={sort}
                    feedFilter={feedFilter}
                    onSortChange={setSort}
                    onFeedFilterChange={setFeedFilter}
                    onSearchOpen={() => setIsSearchOpen(true)}
                />
            )}
            <FeedFilters
                viewMode={viewMode}
                modelFilter={modelFilter}
                onViewModeChange={setViewMode}
                onModelFilterChange={setModelFilter}
            />
        </View>
    ), [isSearchOpen, searchQuery, sort, feedFilter, viewMode, modelFilter, handleSearchClose]);

    const ListFooterComponent = useCallback(() => {
        if (loadingMore) {
            return (
                <View style={styles.footer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            );
        }
        return <View style={styles.footerSpacer} />;
    }, [loadingMore]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {loading && items.length === 0 ? (
                <>
                    <View style={styles.headerContainer}>
                        <ListHeaderComponent />
                    </View>
                    <FeedSkeletonGrid count={6} />
                </>
            ) : (
                <FeedGrid
                    items={filteredItems.length > 0 ? filteredItems : items} // Fallback to items if filtered empty? No, logic below handles empty
                    viewMode={viewMode}
                    onItemPress={handleItemPress}
                    onLike={handleLike}
                    onRemix={handleRemix}
                    ListHeaderComponent={<ListHeaderComponent />}
                    ListFooterComponent={<ListFooterComponent />}
                    onEndReached={handleLoadMore}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                />
            )}

            {/* Show empty state if no items found after filtering */}
            {!loading && filteredItems.length === 0 && items.length > 0 && (
                <View style={styles.emptyOverlay}>
                    <Text style={styles.emptyText}>No posts found matching your criteria</Text>
                </View>
            )}

            {/* Detail Modal */}
            <FeedDetailModal
                item={selectedItem}
                visible={selectedItem !== null}
                onClose={() => setSelectedItem(null)}
                onLike={handleLike}
                onRemix={handleRemix}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    headerContainer: {
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    header: {
        marginBottom: spacing.md,
        paddingTop: spacing.sm,
    },
    emptyOverlay: {
        position: 'absolute',
        top: '40%',
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: colors.textMuted,
        fontSize: 16,
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    footerSpacer: {
        height: 100, // Space for bottom tab bar
    },
});
