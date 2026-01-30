import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, FlatList, RefreshControl, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useUserStore } from '../../store/userStore';
import { colors, spacing, borderRadius } from '../../theme';

interface Generation {
    id: number;
    image_url: string;
    video_url?: string;
    prompt: string;
    likes_count: number;
    created_at: string;
    media_type: 'image' | 'video';
}

interface UserInfo {
    user_id: number;
    username: string;
    first_name: string;
    last_name?: string;
    avatar_url?: string;
    balance: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS + 1)) / GRID_COLUMNS;

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const userId = useUserStore((state) => state.user.id);
    const setBalance = useUserStore((state) => state.setBalance);

    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchUserData = useCallback(async () => {
        try {
            // Fetch user info
            const userResponse = await api.get<{ user: UserInfo }>(`/user/info/${userId}`);
            if (userResponse.user) {
                setUserInfo(userResponse.user);
                setBalance(userResponse.user.balance);
            }

            // Fetch user generations
            const gensResponse = await api.get<{ items: Generation[] }>(
                `/feed?user_id=${userId}&include_unpublished=true&limit=50`
            );
            if (gensResponse.items) {
                setGenerations(gensResponse.items);
            }
        } catch (error) {
            console.error('Failed to fetch user data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId, setBalance]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchUserData();
    }, [fetchUserData]);

    const displayName = userInfo?.first_name || 'User';
    const username = userInfo?.username ? `@${userInfo.username.replace(/^@/, '')}` : `@user_${userId}`;
    const avatarUrl = userInfo?.avatar_url || `https://api.dicebear.com/9.x/avataaars/svg?seed=${userId}`;

    const renderGeneration = ({ item }: { item: Generation }) => (
        <TouchableOpacity style={styles.gridItem}>
            <Image
                source={{ uri: item.image_url || item.video_url }}
                style={styles.gridImage}
                resizeMode="cover"
            />
            {item.media_type === 'video' && (
                <View style={styles.videoBadge}>
                    <Text style={styles.videoBadgeText}>▶</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.container, styles.loadingContainer]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
        >
            <View style={styles.header}>
                <View style={styles.avatarContainer}>
                    <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                </View>
                <Text style={styles.name}>{displayName}</Text>
                <Text style={styles.username}>{username}</Text>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{generations.length}</Text>
                    <Text style={styles.statLabel}>Generations</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                        {generations.reduce((sum, g) => sum + (g.likes_count || 0), 0)}
                    </Text>
                    <Text style={styles.statLabel}>Likes</Text>
                </View>
            </View>

            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Token Balance</Text>
                <View style={styles.balanceRow}>
                    <Text style={styles.balanceValue}>{userInfo?.balance ?? 0}</Text>
                    <Text style={styles.balanceUnit}>tokens</Text>
                </View>
                <TouchableOpacity style={styles.topUpButton}>
                    <Text style={styles.topUpButtonText}>+ Top Up</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>My Generations</Text>
                {generations.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🎨</Text>
                        <Text style={styles.emptyText}>No generations yet</Text>
                        <Text style={styles.emptyHint}>Create your first masterpiece in Studio!</Text>
                    </View>
                ) : (
                    <View style={styles.gridContainer}>
                        {generations.map((item) => (
                            <TouchableOpacity key={item.id} style={styles.gridItem}>
                                <Image
                                    source={{ uri: item.image_url || item.video_url }}
                                    style={styles.gridImage}
                                    resizeMode="cover"
                                />
                                {item.media_type === 'video' && (
                                    <View style={styles.videoBadge}>
                                        <Text style={styles.videoBadgeText}>▶</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Settings</Text>
                {['Language', 'Notifications', 'About', 'Support'].map((item) => (
                    <TouchableOpacity key={item} style={styles.settingItem}>
                        <Text style={styles.settingText}>{item}</Text>
                        <Text style={styles.settingArrow}>›</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.version}>AiVerse v1.0.0</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
        paddingTop: 16,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#2a2a2a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 36,
    },
    proBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: '#a855f7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    proBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    username: {
        fontSize: 14,
        color: '#888',
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#888',
    },
    balanceCard: {
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.3)',
    },
    balanceLabel: {
        fontSize: 14,
        color: '#a855f7',
        marginBottom: 8,
    },
    balanceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    balanceValue: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fff',
        marginRight: 8,
    },
    balanceUnit: {
        fontSize: 16,
        color: '#888',
    },
    topUpButton: {
        backgroundColor: '#a855f7',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    topUpButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    emptyState: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 32,
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 4,
    },
    emptyHint: {
        fontSize: 13,
        color: '#666',
        textAlign: 'center',
    },
    settingItem: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    settingText: {
        color: '#fff',
        fontSize: 16,
    },
    settingArrow: {
        color: '#666',
        fontSize: 20,
    },
    version: {
        textAlign: 'center',
        color: '#444',
        fontSize: 12,
        marginTop: 20,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 2,
    },
    gridItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        position: 'relative',
    },
    gridImage: {
        width: '100%',
        height: '100%',
        borderRadius: 4,
    },
    videoBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    videoBadgeText: {
        color: '#fff',
        fontSize: 10,
    },
});
