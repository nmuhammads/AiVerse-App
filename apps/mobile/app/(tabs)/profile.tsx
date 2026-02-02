import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ImageBackground, Platform, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import {
    Settings,
    Wallet,
    Camera,
    Video,
    Share2,
    Clock,
    Filter,
    Image as ImageIcon,
    Pencil,
    Globe,
    Lock,
    Unlock,
    ChevronLeft,
    ChevronRight,
    Copy,
    Check,
    Trash2
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { useUserStore } from '../../store/userStore';
import { colors } from '../../theme';
import { ResultModal } from '../../components/ResultModal';

interface Generation {
    id: number;
    image_url: string;
    compressed_url?: string; // Optimized thumbnail
    video_url?: string;
    prompt: string;
    likes_count: number;
    created_at: string;
    media_type: 'image' | 'video';
    is_published: boolean;
    is_prompt_private: boolean;
    model?: string;
    edit_variants?: string[];
    input_images?: string[];
}

interface UserInfo {
    user_id: number;
    username: string;
    first_name: string;
    last_name?: string;
    avatar_url?: string;
    balance: number;
    cover_url?: string;
    likes_count?: number;
    remix_count?: number;
    followers_count?: number;
    following_count?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const ITEM_SIZE = Math.floor((SCREEN_WIDTH - 32 - (GRID_GAP * (GRID_COLUMNS - 1))) / GRID_COLUMNS);

// Memoized Grid Item Component
const GridItem = React.memo(({ item, index, onPress }: { item: Generation, index: number, onPress: () => void }) => {
    // Use compressed_url if available, falling back to image_url or video_url
    const sourceUrl = item.compressed_url || item.image_url || item.video_url;

    return (
        <TouchableOpacity style={styles.gridItem} onPress={onPress}>
            <Image
                source={sourceUrl}
                style={styles.gridImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
            />
            {(item.media_type === 'video' || !!item.video_url) && (
                <View style={styles.mediaTypeBadge}>
                    <Video size={10} color="#fff" />
                </View>
            )}
            {item.is_published && (
                <View style={styles.statusBadge}>
                    <Globe size={8} color="#fff" />
                </View>
            )}
        </TouchableOpacity>
    );
});

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user, setBalance } = useUserStore();

    // Data State
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Pagination State
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const PAGE_SIZE = 6;

    // Filters State
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [visibility, setVisibility] = useState<'all' | 'published' | 'private'>('all');
    const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'image' | 'video'>('all');
    const [showEditedOnly, setShowEditedOnly] = useState(false);

    // Stats State
    const [stats, setStats] = useState({
        generations: 0,
        followers: 0,
        likes: 0,
        remixes: 0
    });

    // Modal State
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [startIndex, setStartIndex] = useState(0);

    const openModal = useCallback((index: number) => {
        setStartIndex(index);
        setIsModalVisible(true);
    }, []);

    const handleUpdateItem = useCallback((id: number, updates: Partial<Generation>) => {
        setGenerations(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    }, []);

    const fetchUserInfo = useCallback(async () => {
        if (!user?.id) return;
        try {
            const userResponse = await api.get<UserInfo>(`/user/info/${user.id}`);
            if (userResponse) {
                setUserInfo(userResponse);
                setBalance(userResponse.balance);
                setStats(prev => ({
                    ...prev,
                    followers: userResponse.followers_count || 0,
                    likes: userResponse.likes_count || 0,
                    remixes: userResponse.remix_count || 0
                }));
            }
        } catch (error) {
            console.error('Failed to fetch user info:', error);
        }
    }, [user?.id, setBalance]);

    const fetchGenerations = useCallback(async (isLoadMore = false) => {
        if (!user?.id) return;
        if (isLoadMore && (!hasMore || isLoadingMore)) return;

        try {
            if (isLoadMore) {
                setIsLoadingMore(true);
            } else {
                setLoading(true);
            }

            const currentOffset = isLoadMore ? offset : 0;
            
            // Build params
            let visibilityParam = '';
            if (visibility !== 'all') visibilityParam = `&visibility=${visibility}`;
            const modelParam = selectedModels.length > 0 ? `&model=${selectedModels.join(',')}` : '';

            const endpoint = `/user/generations?user_id=${user.id}&limit=${PAGE_SIZE}&offset=${currentOffset}${visibilityParam}${modelParam}`;
            
            const gensResponse = await api.get<{ items: Generation[], total: number }>(endpoint);

            if (gensResponse && gensResponse.items) {
                let newItems = gensResponse.items;

                // Client-side filtering (Note: this interacts poorly with server-side pagination if many items are filtered out, 
                // ideally move all filtering to backend. keeping simple for now as requested)
                if (showEditedOnly) {
                    // @ts-ignore
                    newItems = newItems.filter(item => item.edit_variants && item.edit_variants.length > 0);
                }
                
                if (mediaTypeFilter !== 'all') {
                    newItems = newItems.filter(item => {
                         const itemMediaType = item.media_type || 'image';
                         return itemMediaType === mediaTypeFilter;
                    });
                }

                if (isLoadMore) {
                    setGenerations(prev => [...prev, ...newItems]);
                } else {
                    setGenerations(newItems);
                }

                if (gensResponse.items.length < PAGE_SIZE) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                    setOffset(currentOffset + PAGE_SIZE);
                }

                // Update total count stats
                setStats(prev => ({ ...prev, generations: gensResponse.total }));
            }
        } catch (error) {
            console.error('Failed to fetch generations:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setIsLoadingMore(false);
        }
    }, [user?.id, offset, hasMore, isLoadingMore, visibility, selectedModels, mediaTypeFilter, showEditedOnly]);

    // Initial load
    useEffect(() => {
        fetchUserInfo();
        fetchGenerations(false);
    }, [user?.id, visibility, selectedModels, mediaTypeFilter, showEditedOnly]); 
    // removed fetchGenerations dependency to avoid loops, explicit dependencies above

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setOffset(0);
        setHasMore(true);
        await Promise.all([fetchUserInfo(), fetchGenerations(false)]);
    }, [fetchUserInfo, fetchGenerations]);

    const loadMore = useCallback(() => {
        fetchGenerations(true);
    }, [fetchGenerations]);

    const displayName = userInfo?.first_name
        ? `${userInfo.first_name} ${userInfo.last_name || ''}`.trim()
        : (user?.username || 'Guest');

    const username = userInfo?.username ? `@${userInfo.username.replace(/^@/, '')}` : '—';
    const avatarUrl = userInfo?.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user?.username || 'guest'}`;
    const coverUrl = userInfo?.cover_url;

    // Stat Item Component
    const StatItem = useCallback(({ label, value }: { label: string, value: number }) => (
        <View style={styles.statItem}>
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    ), []);

    // Helper to render the header
    const renderHeader = useMemo(() => {
        return (
            <View>
                <View style={styles.headerContainer}>
                    {/* Cover Section */}
                    <View style={styles.coverWrapper}>
                        {coverUrl ? (
                            <ImageBackground
                                source={{ uri: coverUrl }}
                                style={styles.coverImage}
                                resizeMode="cover"
                            >
                                <LinearGradient
                                    colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
                                    style={StyleSheet.absoluteFill}
                                />
                            </ImageBackground>
                        ) : (
                            <View style={styles.defaultCover}>
                                {/* Abstract blobs/gradients mimicking the web version */}
                                <View style={[styles.blob, styles.blob1]} />
                                <View style={[styles.blob, styles.blob2]} />
                                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
                            </View>
                        )}

                        {/* Cover Content */}
                        <View style={styles.profileInfoContent}>
                            <TouchableOpacity style={styles.cameraButton}>
                                <Camera size={14} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>

                            {/* Avatar */}
                            <TouchableOpacity style={styles.avatarWrapper}>
                                <LinearGradient
                                    colors={['#8b5cf6', '#d946ef', '#6366f1']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.avatarGradient}
                                >
                                    <View style={styles.avatarInner}>
                                        <Image 
                                            source={avatarUrl} 
                                            style={styles.avatarImage} 
                                            contentFit="cover"
                                            transition={200}
                                        />
                                    </View>
                                </LinearGradient>
                                <View style={styles.proBadge}>
                                    <LinearGradient
                                        colors={['#fcd34d', '#f59e0b']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.proBadgeGradient}
                                    >
                                        <Text style={styles.proBadgeText}>PRO</Text>
                                    </LinearGradient>
                                </View>
                            </TouchableOpacity>

                            {/* Name */}
                            <Text style={styles.displayName}>{displayName}</Text>
                            <Text style={styles.usernameText}>{username}</Text>

                            {/* Stats Grid */}
                            <View style={styles.statsGrid}>
                                <StatItem label="GENERATIONS" value={stats.generations} />
                                <StatItem label="FOLLOWERS" value={stats.followers} />
                                <StatItem label="LIKES" value={stats.likes} />
                                <StatItem label="REMIXES" value={stats.remixes} />
                            </View>

                            {/* Actions */}
                            <View style={styles.actionsRow}>
                                <TouchableOpacity style={[styles.actionButton, styles.walletButton]}>
                                    <LinearGradient
                                        colors={['#7c3aed', '#4f46e5']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                    <Wallet size={16} color="#fff" />
                                    <Text style={styles.walletText}>{userInfo?.balance || 0}</Text>
                                    <Text style={styles.walletSubText}>tokens</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.actionButton, styles.iconButton]}
                                    onPress={async () => {
                                        try {
                                            if (!user?.id) return;
                                            const deepLink = `https://t.me/AiVerseAppBot?startapp=profile-${user.id}`;
                                            await Share.share({
                                                message: `Check out my profile on AiVerse!\n${deepLink}`,
                                                url: deepLink, // iOS
                                                title: 'AiVerse Profile'
                                            });
                                        } catch (error) {
                                            console.error(error);
                                        }
                                    }}
                                >
                                    <Share2 size={20} color="#fff" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionButton, styles.iconButton]}
                                    onPress={() => router.push('/settings')}
                                >
                                    <Settings size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Storage Banner */}
                <View style={styles.storageBanner}>
                    <View style={styles.storageContent}>
                        <Clock size={14} color="#71717a" style={{ marginTop: 2 }} />
                        <Text style={styles.storageText}>
                            Cloud media is stored for <Text style={styles.storageHighlight}>14 days</Text>. Local copies remain in cache. You can enable sending originals to Telegram or save to device.
                        </Text>
                    </View>
                </View>

                {/* Filters Section */}
                <View style={styles.filtersContainer}>
                    {/* Models Filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                        <Filter size={14} color="#71717a" style={{ marginRight: 8 }} />
                        {[
                            { value: '', label: 'All Models' },
                            { value: 'nanobanana', label: 'NanoBanana' },
                            { value: 'nanobanana-pro', label: 'NanoBanana Pro' },
                            { value: 'seedream4', label: 'Seedream 4' },
                            { value: 'seedream4-5', label: 'Seedream 4.5' },
                            { value: 'gptimage1.5', label: 'GPT Image 1.5' },
                        ].map(m => {
                            const isActive = m.value === '' ? selectedModels.length === 0 : selectedModels.includes(m.value);
                            return (
                                <TouchableOpacity
                                    key={m.value}
                                    onPress={() => {
                                        if (m.value === '') {
                                            setSelectedModels([]);
                                        } else {
                                            if (selectedModels.includes(m.value)) {
                                                setSelectedModels(selectedModels.filter(x => x !== m.value));
                                            } else {
                                                setSelectedModels([...selectedModels, m.value]);
                                            }
                                        }
                                    }}
                                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{m.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Visibility Filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                        <Globe size={14} color="#71717a" style={{ marginRight: 8 }} />
                        <View style={styles.pillGroup}>
                            {[
                                { value: 'all', label: 'All' },
                                { value: 'published', label: 'Published' },
                                { value: 'private', label: 'Private' },
                            ].map(v => (
                                <TouchableOpacity
                                    key={v.value}
                                    onPress={() => setVisibility(v.value as any)}
                                    style={[styles.pillButton, visibility === v.value && styles.pillButtonActive]}
                                >
                                    <Text style={[styles.pillText, visibility === v.value && styles.pillTextActive]}>{v.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Media Type Filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                        <View style={styles.pillGroup}>
                             {[
                                { value: 'all', label: 'All', icon: null },
                                { value: 'image', label: 'Photo', icon: ImageIcon },
                                { value: 'video', label: 'Video', icon: Video },
                             ].map(m => (
                                <TouchableOpacity
                                    key={m.value}
                                    onPress={() => setMediaTypeFilter(m.value as any)}
                                    style={[styles.pillButton, mediaTypeFilter === m.value && styles.pillButtonActive]}
                                >
                                    {m.icon && <m.icon size={12} color={mediaTypeFilter === m.value ? '#fff' : '#a1a1aa'} style={{ marginRight: 4 }} />}
                                    <Text style={[styles.pillText, mediaTypeFilter === m.value && styles.pillTextActive]}>{m.label}</Text>
                                </TouchableOpacity>
                             ))}
                        </View>

                        {/* Edited Filter */}
                        <TouchableOpacity
                            onPress={() => setShowEditedOnly(!showEditedOnly)}
                            style={[styles.iconFilterBtn, showEditedOnly && styles.iconFilterBtnActive]}
                        >
                            <Pencil size={14} color={showEditedOnly ? '#fff' : '#a1a1aa'} />
                        </TouchableOpacity>
                    </ScrollView>
                </View>
                {generations.length === 0 && !loading && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🎨</Text>
                        <Text style={styles.emptyText}>No generations yet</Text>
                    </View>
                )}
            </View>
        );
    }, [
        coverUrl, avatarUrl, displayName, username, stats, userInfo, user, selectedModels, visibility, mediaTypeFilter, showEditedOnly, generations.length, loading, router
    ]);

    const renderItem = useCallback(({ item, index }: { item: Generation, index: number }) => (
        <GridItem item={item} index={index} onPress={() => openModal(index)} />
    ), [openModal]);

    return (
        <View style={styles.container}>
            <FlashList
                data={generations}
                renderItem={renderItem}
                // @ts-ignore
                estimatedItemSize={ITEM_SIZE} // Important for performance
                numColumns={GRID_COLUMNS}
                ListHeaderComponent={renderHeader}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() => (
                    isLoadingMore ? (
                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                           {/* Using ActivityIndicator directly via View since we don't have it imported explicitly but React Native exports it. 
                               Actually we only imported standard components. Let's make sure ActivityIndicator is imported or use a simple Text */}
                            <Text style={{ color: '#71717a', fontSize: 12 }}>Loading more...</Text>
                        </View>
                    ) : null
                )}
                contentContainerStyle={{ 
                    paddingTop: insets.top + 60, 
                    paddingBottom: 100, 
                    paddingHorizontal: 16 
                }}
                showsVerticalScrollIndicator={false}
                refreshing={refreshing}
                onRefresh={onRefresh}
                keyExtractor={(item) => item.id.toString()}
            />

            <ResultModal
                visible={isModalVisible}
                items={generations}
                startIndex={startIndex}
                onClose={() => setIsModalVisible(false)}
                onUpdateItem={handleUpdateItem}
                onRemix={(item) => {
                    setIsModalVisible(false);

                    // Parse metadata from prompt (similar to web)
                    let cleanPrompt = item.prompt;
                    let metadata: Record<string, string> = {};

                    const match = item.prompt.match(/\s*\[(.*?)\]\s*$/);
                    if (match) {
                        const metaString = match[1];
                        cleanPrompt = item.prompt.replace(match[0], '').trim();

                        metaString.split(';').forEach((part: string) => {
                            const [key, val] = part.split('=').map((s: string) => s.trim());
                            if (key && val) metadata[key] = val;
                        });
                    }

                    // Map models
                    const modelMap: Record<string, string> = {
                        'nanobanana': 'nanobanana',
                        'nanobanana-pro': 'nanobanana-pro',
                        'seedream4': 'seedream4',
                        'seedream4-5': 'seedream4-5',
                        'seedream4.5': 'seedream4-5',
                        'seedance-1.5-pro': 'seedance-1.5-pro',
                        'gptimage1.5': 'gpt-image-1.5'
                    };

                    let targetModel = item.model;
                    if (targetModel && modelMap[targetModel]) {
                        targetModel = modelMap[targetModel];
                    }

                    // Determine settings
                    const params: any = {
                        prompt: cleanPrompt,
                        model: targetModel,
                        media_type: item.media_type === 'video' ? 'video' : 'image',
                    };

                    // Aspect Ratio from metadata
                    if (metadata.ratio) {
                        params.ratio = metadata.ratio;
                    }

                    // Mode
                    if (metadata.type) {
                        if (metadata.type === 'text_photo') {
                            params.mode = 'image';
                        } else {
                            params.mode = 'text';
                        }
                    } else if (item.input_images && item.input_images.length > 0) {
                        params.mode = 'image';
                        params.input_images = JSON.stringify(item.input_images);
                    }

                    // Force Navigate to Studio Tab with params
                    // @ts-ignore
                    router.push({
                        pathname: '/(tabs)/studio',
                        params: params
                    });
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    headerContainer: {
        marginBottom: 24,
    },
    coverWrapper: {
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(24, 24, 27, 0.9)',
    },
    coverImage: {
        width: '100%',
        minHeight: 380, // Taller to fit all content comfortably
    },
    defaultCover: {
        width: '100%',
        minHeight: 380,
        backgroundColor: '#18181b',
        position: 'relative',
        overflow: 'hidden',
    },
    blob: {
        position: 'absolute',
        width: 250,
        height: 250,
        borderRadius: 125,
        opacity: 0.3,
    },
    blob1: {
        backgroundColor: '#7c3aed',
        top: -50,
        right: -50,
    },
    blob2: {
        backgroundColor: '#4f46e5',
        bottom: -50,
        left: -50,
    },
    profileInfoContent: {
        padding: 20,
        alignItems: 'center',
        width: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
    },
    cameraButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        zIndex: 10,
    },
    avatarWrapper: {
        marginBottom: 12,
        position: 'relative',
    },
    avatarGradient: {
        width: 88,
        height: 88,
        borderRadius: 44,
        padding: 3,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    avatarInner: {
        flex: 1,
        backgroundColor: '#000',
        borderRadius: 44,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    proBadge: {
        position: 'absolute',
        bottom: -6,
        left: '50%',
        transform: [{ translateX: -18 }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 2,
        elevation: 4,
    },
    proBadgeGradient: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 100,
    },
    proBadgeText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    displayName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    usernameText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginBottom: 20,
    },
    statsGrid: {
        flexDirection: 'row',
        width: '100%',
        gap: 8,
        marginBottom: 20,
    },
    statItem: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        height: 60,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
    },
    actionsRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
    },
    actionButton: {
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    walletButton: {
        flex: 1,
        overflow: 'hidden',
        gap: 6,
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    walletText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    walletSubText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
    },
    iconButton: {
        width: 44,
        backgroundColor: '#27272a',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    storageBanner: {
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    storageContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        backgroundColor: 'rgba(24, 24, 27, 0.5)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        gap: 8,
    },
    storageText: {
        flex: 1,
        fontSize: 11,
        color: '#71717a',
        lineHeight: 16,
    },
    storageHighlight: {
        color: '#d4d4d8',
        fontWeight: '500',
    },
    filtersContainer: {
        marginBottom: 16,
        gap: 12,
    },
    filterRow: {
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: '#7c3aed',
        borderColor: '#7c3aed',
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#a1a1aa',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    pillGroup: {
        flexDirection: 'row',
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderRadius: 100,
        padding: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginRight: 8,
    },
    pillButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
    },
    pillButtonActive: {
        backgroundColor: '#27272a',
    },
    pillText: {
        fontSize: 11,
        color: '#a1a1aa',
        fontWeight: '500',
    },
    pillTextActive: {
        color: '#fff',
    },
    iconFilterBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(39, 39, 42, 0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    iconFilterBtnActive: {
        backgroundColor: '#7c3aed',
        borderColor: '#7c3aed',
    },
    gridItem: {
        flex: 1,
        margin: 1,
        aspectRatio: 1,
        position: 'relative',
        backgroundColor: '#18181b',
        maxWidth: ITEM_SIZE,
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    mediaTypeBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 4,
        padding: 2,
    },
    statusBadge: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 4,
        padding: 2,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: 16,
    },
    emptyText: {
        color: '#a1a1aa',
        fontSize: 14,
    },
});
