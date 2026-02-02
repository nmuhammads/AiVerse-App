import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, FlatList, RefreshControl, Dimensions, ImageBackground, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
    Settings,
    Wallet,
    RefreshCw,
    Camera,
    Edit,
    Grid,
    Lock,
    Globe,
    Play,
    ChevronRight,
    User as UserIcon,
    Video
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { useUserStore } from '../../store/userStore';
import { colors } from '../../theme';
import { ResultModal } from '../../components/ResultModal';

interface Generation {
    id: number;
    image_url: string;
    video_url?: string;
    prompt: string;
    likes_count: number;
    created_at: string;
    media_type: 'image' | 'video';
    is_published: boolean;
    is_prompt_private: boolean;
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
const ITEM_SIZE = Math.floor((SCREEN_WIDTH - 32 - (GRID_GAP * GRID_COLUMNS)) / GRID_COLUMNS); // Safe calculation to prevent wrapping

// Tab constants
const TAB_ALL = 'all';
const TAB_PUBLISHED = 'published';
const TAB_PRIVATE = 'private';

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user, setBalance } = useUserStore();

    // Data State
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState(TAB_ALL);
    const [selectedModels, setSelectedModels] = useState<string[]>([]); // Future support

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

    const openModal = (index: number) => {
        setStartIndex(index);
        setIsModalVisible(true);
    };

    const handleUpdateItem = useCallback((id: number, updates: Partial<Generation>) => {
        setGenerations(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    }, []);

    const fetchUserData = useCallback(async () => {
        if (!user?.id) return;

        try {
            // Fetch detailed user info
            const userResponse = await api.get<UserInfo>(`/user/info/${user.id}`);
            if (userResponse) {
                setUserInfo(userResponse);
                setBalance(userResponse.balance);

                // Update stats
                setStats({
                    generations: 0, // Will update after fetching gens
                    followers: userResponse.followers_count || 0,
                    likes: userResponse.likes_count || 0,
                    remixes: userResponse.remix_count || 0
                });
            }

            // Fetch generations
            // Note: The visibility filter is applied clientside or via query params depending on API design
            // Mimicking the web app's structure:
            let visibilityParam = '';
            if (activeTab === TAB_PUBLISHED) visibilityParam = '&visibility=published';
            if (activeTab === TAB_PRIVATE) visibilityParam = '&visibility=private';

            const gensResponse = await api.get<{ items: Generation[], total: number }>(
                `/user/generations?user_id=${user.id}&limit=50&offset=0${visibilityParam}`
            );

            if (gensResponse && gensResponse.items) {
                setGenerations(gensResponse.items);
                setStats(prev => ({
                    ...prev,
                    generations: gensResponse.total || gensResponse.items.length
                }));
            }
        } catch (error) {
            console.error('Failed to fetch user data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id, activeTab, setBalance]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchUserData();
    }, [fetchUserData]);

    const displayName = userInfo?.first_name
        ? `${userInfo.first_name} ${userInfo.last_name || ''}`.trim()
        : (user?.username || 'Guest');

    const username = userInfo?.username ? `@${userInfo.username.replace(/^@/, '')}` : '—';
    const avatarUrl = userInfo?.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user?.username || 'guest'}`;
    const coverUrl = userInfo?.cover_url;

    const renderHeader = () => (
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
                                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
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

                        <TouchableOpacity style={[styles.actionButton, styles.iconButton]}>
                            <RefreshCw size={20} color="#fff" />
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.actionButton, styles.iconButton]}>
                            <Settings size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );

    const StatItem = ({ label, value }: { label: string, value: number }) => (
        <View style={styles.statItem}>
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: 100 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {renderHeader()}

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TabButton label="All" isActive={activeTab === TAB_ALL} onPress={() => setActiveTab(TAB_ALL)} icon={<Grid size={14} color={activeTab === TAB_ALL ? '#fff' : '#9ca3af'} />} />
                    <TabButton label="Published" isActive={activeTab === TAB_PUBLISHED} onPress={() => setActiveTab(TAB_PUBLISHED)} icon={<Globe size={14} color={activeTab === TAB_PUBLISHED ? '#fff' : '#9ca3af'} />} />
                    <TabButton label="Private" isActive={activeTab === TAB_PRIVATE} onPress={() => setActiveTab(TAB_PRIVATE)} icon={<Lock size={14} color={activeTab === TAB_PRIVATE ? '#fff' : '#9ca3af'} />} />
                </View>

                {/* Grid */}
                <View style={styles.gridContainer}>
                    {generations.map((item, index) => (
                        <TouchableOpacity key={item.id} style={styles.gridItem} onPress={() => openModal(index)}>
                            <Image
                                source={{ uri: item.image_url || item.video_url }}
                                style={styles.gridImage}
                                resizeMode="cover"
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
                    ))}
                </View>

                {generations.length === 0 && !loading && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🎨</Text>
                        <Text style={styles.emptyText}>No generations yet</Text>
                    </View>
                )}

                <Text style={styles.version}>AiVerse Mobile v1.0.0</Text>
            </ScrollView>

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
                    // We need to use router.push to the studio tab
                    // Expo Router Tabs: accessing sibling tab
                    // Usually we can just push the path
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

const TabButton = ({ label, isActive, onPress, icon }: { label: string, isActive: boolean, onPress: () => void, icon?: React.ReactNode }) => (
    <TouchableOpacity
        style={[styles.tabButton, isActive && styles.tabButtonActive]}
        onPress={onPress}
    >
        {icon}
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
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
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#18181b',
        padding: 4,
        borderRadius: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#27272a',
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    tabButtonActive: {
        backgroundColor: '#27272a',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9ca3af',
    },
    tabTextActive: {
        color: '#fff',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -1, // Compensate for gap
    },
    gridItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        marginBottom: 2,
        marginHorizontal: 1,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#27272a',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    mediaTypeBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 3,
    },
    statusBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 4,
        padding: 4,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: 16,
    },
    emptyText: {
        color: '#52525b',
        fontSize: 16,
        fontWeight: '500',
    },
    version: {
        textAlign: 'center',
        color: '#3f3f46',
        fontSize: 12,
        marginTop: 20,
        marginBottom: 20,
    },
});
