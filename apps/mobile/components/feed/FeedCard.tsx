import React, { useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Repeat, Heart, Trophy, Video, Pencil } from 'lucide-react-native';

export interface FeedItem {
    id: string;
    image_url: string;
    original_url?: string;
    prompt?: string;
    model?: string;
    likes_count: number;
    remix_count?: number;
    is_liked?: boolean;
    author?: {
        id: number;
        username?: string;
        avatar_url?: string;
    };
    created_at?: string;
    media_type?: 'image' | 'video';
    is_contest_entry?: boolean;
    edit_variants?: string[];
}

interface FeedCardProps {
    item: FeedItem;
    variant?: 'standard' | 'compact';
    onPress: () => void;
    onLike: () => void;
    onRemix?: () => void;
}

function getModelDisplayName(model?: string): string {
    if (!model) return '';
    switch (model) {
        case 'nanobanana': return 'NanoBanana';
        case 'nanobanana-pro': return 'NanoBanana Pro';
        case 'seedream4': return 'SeeDream 4';
        case 'seedream4-5': return 'SeeDream 4.5';
        case 'seedance-1.5-pro': return 'Seedance Pro';
        case 'gptimage1.5': return 'GPT image 1.5';
        default: return model;
    }
}

export const FeedCard = memo(function FeedCard({
    item,
    variant = 'standard',
    onPress,
    onLike,
    onRemix,
}: FeedCardProps) {
    const isCompact = variant === 'compact';
    const [imageError, setImageError] = useState(false);
    const modelName = getModelDisplayName(item.model);

    const handlePress = (action?: () => void) => {
        if (action) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            action();
        }
    };

    return (
        <TouchableOpacity
            style={[styles.container, isCompact && styles.containerCompact]}
            onPress={() => handlePress(onPress)}
            activeOpacity={0.9}
        >
            {/* Image Container */}
            <View style={[styles.imageContainer, isCompact && styles.imageContainerCompact]}>
                {item.image_url && !imageError ? (
                    <Image
                        source={{ uri: item.image_url }}
                        style={styles.image}
                        contentFit="cover"
                        transition={200}
                        onError={() => setImageError(true)}
                        cachePolicy="memory-disk"
                    />
                ) : (
                    <LinearGradient
                        colors={['#27272a', '#3f3f46', '#27272a']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.placeholder}
                    >
                        {imageError && (
                            <Text style={styles.errorText}>Unavailable</Text>
                        )}
                    </LinearGradient>
                )}

                {/* Overlays */}
                {!isCompact && modelName ? (
                    <View style={styles.modelBadge}>
                        <Text style={styles.modelText}>{modelName}</Text>
                    </View>
                ) : null}

                <View style={styles.topRightOverlays}>
                    {item.is_contest_entry && (
                        <View style={styles.iconBadgeWarning}>
                            <Trophy size={12} color="#eab308" />
                        </View>
                    )}
                    {item.edit_variants && item.edit_variants.length > 0 && !item.is_contest_entry && (
                        <View style={styles.iconBadgeViolet}>
                            <Pencil size={12} color="#fff" />
                        </View>
                    )}
                    {item.media_type === 'video' && !item.is_contest_entry && (
                        <View style={styles.iconBadgeViolet}>
                            <Video size={12} color="#fff" />
                        </View>
                    )}
                </View>
            </View>

            {/* Bottom Content */}
            {!isCompact && (
                <View style={styles.content}>
                    <View style={styles.row}>
                        {/* Author */}
                        <View style={styles.authorContainer}>
                            <View style={styles.avatarGradient}>
                                {item.author?.avatar_url ? (
                                    <Image
                                        source={{ uri: item.author.avatar_url }}
                                        style={styles.avatarImage}
                                        contentFit="cover"
                                        transition={200}
                                    />
                                ) : (
                                    <Text style={styles.avatarEmoji}>👤</Text>
                                )}
                            </View>
                        </View>

                        {/* Actions */}
                        <View style={styles.actions}>
                            {onRemix && (
                                <TouchableOpacity
                                    style={styles.actionButton}
                                    onPress={() => handlePress(onRemix)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 5 }}
                                >
                                    <Repeat size={14} color={colors.textSecondary} />
                                    {!!item.remix_count && item.remix_count > 0 && (
                                        <Text style={styles.actionText}>{item.remix_count}</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[
                                    styles.actionButton,
                                    item.is_liked && styles.actionButtonLiked
                                ]}
                                onPress={() => handlePress(onLike)}
                                hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
                            >
                                <Heart
                                    size={14}
                                    color={item.is_liked ? '#ec4899' : colors.textSecondary}
                                    fill={item.is_liked ? '#ec4899' : 'transparent'}
                                />
                                <Text style={[
                                    styles.actionText,
                                    item.is_liked && styles.actionTextLiked
                                ]}>{item.likes_count}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.username} numberOfLines={1}>
                        {item.author?.username || 'Anonymous'}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#18181b', // Zinc-900
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    containerCompact: {
        marginBottom: spacing.xs,
        borderWidth: 0,
    },
    imageContainer: {
        aspectRatio: 1, // Keep it square-ish or use auto-height if implementing masonry effectively
        backgroundColor: '#27272a',
        position: 'relative',
    },
    imageContainerCompact: {
        aspectRatio: 1,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        color: colors.textSecondary,
        fontSize: 10,
    },
    // Overlays
    modelBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)', // Won't work on RN, need View style hack or Expo Blur
    },
    modelText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '500',
    },
    topRightOverlays: {
        position: 'absolute',
        top: 8,
        right: 8,
        gap: 6,
    },
    iconBadgeWarning: {
        backgroundColor: 'rgba(234, 179, 8, 0.2)', // yellow-500/20
        padding: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(234, 179, 8, 0.3)',
    },
    iconBadgeViolet: {
        backgroundColor: 'rgba(139, 92, 246, 0.8)', // violet-500/80
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.3)',
    },
    // Content
    content: {
        padding: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    authorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarGradient: {
        width: 24,
        height: 24,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#8b5cf6', // Fallback
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 24,
        height: 24,
    },
    avatarEmoji: {
        fontSize: 12,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 999,
    },
    actionButtonLiked: {
        backgroundColor: 'rgba(236, 72, 153, 0.2)', // pink-500/20
    },
    actionText: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '500',
    },
    actionTextLiked: {
        color: '#ec4899',
    },
    username: {
        color: '#d4d4d8', // zinc-300
        fontSize: 11,
        fontWeight: '500',
    },
});
