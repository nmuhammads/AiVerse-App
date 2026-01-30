import React from 'react';
import {
    View,
    StyleSheet,
    Image,
    TouchableOpacity,
    Text,
    Dimensions,
    Share,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { colors, spacing, borderRadius } from '../../theme';

interface GenerationResult {
    id: number;
    image_url: string;
    video_url?: string;
    prompt: string;
    model: string;
    media_type: 'image' | 'video';
}

interface ResultViewProps {
    result: GenerationResult;
    onClose: () => void;
    onRemix?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ResultView({ result, onClose, onRemix }: ResultViewProps) {
    const [saving, setSaving] = React.useState(false);
    const mediaUrl = result.video_url || result.image_url;

    const handleSave = async () => {
        try {
            setSaving(true);

            // Request permissions
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission required', 'Please allow access to save images');
                return;
            }

            // Download file
            const filename = `aiverse_${result.id}_${Date.now()}.${result.media_type === 'video' ? 'mp4' : 'jpg'}`;
            const fileUri = FileSystem.documentDirectory + filename;

            const downloadResult = await FileSystem.downloadAsync(mediaUrl, fileUri);

            // Save to gallery
            await MediaLibrary.saveToLibraryAsync(downloadResult.uri);

            Alert.alert('Saved!', 'Image saved to gallery');
        } catch (error) {
            console.error('Save error:', error);
            Alert.alert('Error', 'Failed to save image');
        } finally {
            setSaving(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Created with AiVerse: ${result.prompt}`,
                url: mediaUrl,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={28} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.title}>Result</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Image */}
            <View style={styles.imageContainer}>
                <Image
                    source={{ uri: mediaUrl }}
                    style={styles.image}
                    resizeMode="contain"
                />
            </View>

            {/* Prompt */}
            <View style={styles.promptContainer}>
                <Text style={styles.promptLabel}>Prompt</Text>
                <Text style={styles.promptText} numberOfLines={3}>
                    {result.prompt}
                </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color={colors.text.primary} />
                    ) : (
                        <Ionicons name="download-outline" size={24} color={colors.text.primary} />
                    )}
                    <Text style={styles.actionText}>Save</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                    <Ionicons name="share-outline" size={24} color={colors.text.primary} />
                    <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>

                {onRemix && (
                    <TouchableOpacity style={styles.actionButton} onPress={onRemix}>
                        <Ionicons name="refresh-outline" size={24} color={colors.text.primary} />
                        <Text style={styles.actionText}>Remix</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    closeButton: {
        padding: spacing.xs,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
    },
    placeholder: {
        width: 44,
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    image: {
        width: SCREEN_WIDTH - spacing.md * 2,
        height: SCREEN_WIDTH - spacing.md * 2,
        borderRadius: borderRadius.lg,
    },
    promptContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    promptLabel: {
        fontSize: 12,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    promptText: {
        fontSize: 14,
        color: colors.text.primary,
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.xl,
        paddingVertical: spacing.lg,
        paddingBottom: spacing.xl,
    },
    actionButton: {
        alignItems: 'center',
        gap: spacing.xs,
    },
    actionText: {
        fontSize: 12,
        color: colors.text.secondary,
    },
});
