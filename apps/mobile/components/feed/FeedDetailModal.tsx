import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    Dimensions,
    Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { FeedItem } from './FeedCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FeedDetailModalProps {
    item: FeedItem | null;
    visible: boolean;
    onClose: () => void;
    onLike: (item: FeedItem) => void;
    onRemix?: (item: FeedItem) => void;
}

function getModelDisplayName(model: string | null | undefined): string {
    if (!model) return '';
    switch (model) {
        case 'nanobanana': return 'NanoBanana';
        case 'nanobanana-pro': return 'NanoBanana Pro';
        case 'seedream4': return 'Seedream 4';
        case 'seedream4-5': return 'Seedream 4.5';
        case 'qwen-edit': return 'Qwen Edit';
        case 'flux': return 'Flux';
        case 'gptimage1.5': return 'GPT Image 1.5';
        default: return model;
    }
}

export function FeedDetailModal({
    item,
    visible,
    onClose,
    onLike,
    onRemix,
}: FeedDetailModalProps) {
    const insets = useSafeAreaInsets();
    const [isLikeAnimating, setIsLikeAnimating] = useState(false);

    if (!item) return null;

    const handleLike = () => {
        setIsLikeAnimating(true);
        onLike(item);
        setTimeout(() => setIsLikeAnimating(false), 300);
    };

    const modelName = getModelDisplayName(item.model);
    const date = item.created_at
        ? new Date(item.created_at).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })
        : '';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <View
                    style={[
                        styles.container,
                        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
                    ]}
                >
                    <Pressable onPress={() => { }} style={styles.content}>
                        {/* Header */}
                        <View style={styles.header}>
                            {modelName ? (
                                <View style={styles.modelBadge}>
                                    <Ionicons name="sparkles" size={12} color={colors.primary} />
                                    <Text style={styles.modelText}>{modelName}</Text>
                                </View>
                            ) : (
                                <View />
                            )}
                            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                <Ionicons name="close" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Image */}
                        <View style={styles.imageContainer}>
                            {item.image_url ? (
                                <Image
                                    source={{ uri: item.original_url || item.image_url }}
                                    style={styles.image}
                                    contentFit="contain"
                                    transition={200}
                                />
                            ) : (
                                <View style={styles.placeholder}>
                                    <Text style={styles.placeholderEmoji}>🖼️</Text>
                                </View>
                            )}
                        </View>

                        {/* Footer */}
                        <View style={styles.footer}>
                            {/* Author & Date */}
                            <View style={styles.authorRow}>
                                <View style={styles.authorInfo}>
                                    <View style={styles.avatar}>
                                        {item.author?.avatar_url ? (
                                            <Image
                                                source={{ uri: item.author.avatar_url }}
                                                style={styles.avatarImage}
                                            />
                                        ) : (
                                            <Text style={styles.avatarEmoji}>👤</Text>
                                        )}
                                    </View>
                                    <View>
                                        <Text style={styles.authorName}>
                                            {item.author?.username || 'Anonymous'}
                                        </Text>
                                        {date && <Text style={styles.date}>{date}</Text>}
                                    </View>
                                </View>
                            </View>

                            {/* Prompt */}
                            {item.prompt && (
                                <ScrollView style={styles.promptContainer} showsVerticalScrollIndicator={false}>
                                    <Text style={styles.prompt}>{item.prompt}</Text>
                                </ScrollView>
                            )}

                            {/* Actions */}
                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={[
                                        styles.actionButton,
                                        item.is_liked && styles.likeButtonActive,
                                    ]}
                                    onPress={handleLike}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={item.is_liked ? 'heart' : 'heart-outline'}
                                        size={20}
                                        color={item.is_liked ? '#ef4444' : colors.text}
                                        style={isLikeAnimating && styles.likeAnimating}
                                    />
                                    <Text
                                        style={[
                                            styles.actionText,
                                            item.is_liked && styles.likeTextActive,
                                        ]}
                                    >
                                        {item.likes_count}
                                    </Text>
                                </TouchableOpacity>

                                {onRemix && (
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.remixButton]}
                                        onPress={() => onRemix(item)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="repeat" size={20} color={colors.text} />
                                        <Text style={styles.actionText}>Remix</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </Pressable>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    content: {
        gap: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.surface,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modelText: {
        color: colors.textSecondary,
        fontSize: typography.label.fontSize,
        fontWeight: '600',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 1,
        maxHeight: SCREEN_HEIGHT * 0.5,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        backgroundColor: colors.surface,
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
    placeholderEmoji: {
        fontSize: 64,
    },
    footer: {
        gap: spacing.lg,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    authorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    avatarImage: {
        width: 40,
        height: 40,
    },
    avatarEmoji: {
        fontSize: 20,
    },
    authorName: {
        color: colors.text,
        fontSize: typography.bodySmall.fontSize,
        fontWeight: '600',
    },
    date: {
        color: colors.textMuted,
        fontSize: typography.label.fontSize,
    },
    promptContainer: {
        maxHeight: 80,
    },
    prompt: {
        color: colors.textSecondary,
        fontSize: typography.bodySmall.fontSize,
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        height: 48,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    likeButtonActive: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    remixButton: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    actionText: {
        color: colors.text,
        fontSize: typography.body.fontSize,
        fontWeight: '700',
    },
    likeTextActive: {
        color: '#ef4444',
    },
    likeAnimating: {
        transform: [{ scale: 1.3 }],
    },
});
