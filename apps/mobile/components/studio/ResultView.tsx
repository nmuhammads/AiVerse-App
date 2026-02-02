import React, { useState } from 'react';
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
    Modal,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import { colors, spacing, borderRadius, glass, typography } from '../../theme';
import { X, Download, Share2, Repeat, Check, AlertCircle } from 'lucide-react-native';

interface GenerationResult {
    id: number;
    image_url: string;
    video_url?: string;
    prompt: string;
    model: string;
    media_type: 'image' | 'video';
}

interface ResultViewProps {
    visible: boolean;
    result: GenerationResult | null;
    onClose: () => void;
    onRemix?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ResultView({ visible, result, onClose, onRemix }: ResultViewProps) {
    const [saving, setSaving] = useState(false);

    if (!result) return null;

    const mediaUrl = result.video_url || result.image_url;

    const handleSave = async () => {
        try {
            setSaving(true);

            // Request permissions (writeOnly = true to avoid unnecessary permission errors)
            const { status } = await MediaLibrary.requestPermissionsAsync(true);
            if (status !== 'granted') {
                Alert.alert('Permission required', 'Please allow access to save images');
                return;
            }

            // Determine file extension/name
            const ext = result.media_type === 'video' ? 'mp4' : 'jpg';
            const filename = `aiverse_${result.id}_${Date.now()}.${ext}`;
            
            // Handle directory based on OS and availability (matching ResultModal logic)
            let fileDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
            if (!fileDirectory) {
                if (Platform.OS === 'android') {
                    // Fallback hardcoded path for some Android environments
                    fileDirectory = 'file:///data/user/0/com.aiverse.app/cache/';
                } else {
                    fileDirectory = FileSystem.documentDirectory;
                }
            }
            if (fileDirectory && !fileDirectory.endsWith('/')) fileDirectory += '/';
             
            const fileUri = fileDirectory + filename;

            const downloadResult = await FileSystem.downloadAsync(mediaUrl, fileUri);
            if (downloadResult.status !== 200) {
                 throw new Error('Download failed');
            }

            // Save to gallery
            const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
            await MediaLibrary.createAlbumAsync('AiVerse', asset, false);

            Alert.alert('Saved!', `Your ${result.media_type} has been saved to gallery.`);
        } catch (error: any) {
            console.error('Save error:', error);
            Alert.alert('Error', 'Failed to save media: ' + (error.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out this AI generation!\nPrompt: ${result.prompt}`,
                url: mediaUrl,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.container}>
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
                
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Generation Complete</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Main Content Area */}
                <View style={styles.content}>
                    
                    {/* Media Container */}
                    <View style={styles.mediaContainer}>
                         <View style={styles.mediaWrapper}>
                            {result.media_type === 'video' ? (
                                <Video
                                    source={{ uri: mediaUrl }}
                                    style={styles.media}
                                    resizeMode={ResizeMode.CONTAIN}
                                    isLooping
                                    shouldPlay={visible}
                                    useNativeControls
                                />
                            ) : (
                                <Image
                                    source={{ uri: mediaUrl }}
                                    style={styles.media}
                                    resizeMode="contain"
                                />
                            )}
                         </View>
                         {/* Shine/Glow Effect behind */}
                         <LinearGradient
                            colors={[colors.primary, colors.primaryDark, 'transparent']}
                            style={styles.glow}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                         />
                    </View>

                    {/* Prompt Card */}
                    <View style={styles.promptCard}>
                        <Text style={styles.label}>PROMPT</Text>
                        <Text style={styles.promptText} numberOfLines={3}>
                            {result.prompt}
                        </Text>
                        <View style={styles.modelTag}>
                            <Text style={styles.modelText}>{result.model.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                {/* Actions Footer */}
                <View style={styles.footer}>
                     <View style={styles.actionRow}>
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.saveButton]} 
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#000" size="small" />
                            ) : (
                                <Download size={20} color="#000" />
                            )}
                            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
                            <Share2 size={24} color={colors.text} />
                        </TouchableOpacity>

                        {onRemix && (
                             <TouchableOpacity style={styles.iconButton} onPress={onRemix}>
                                <Repeat size={24} color={colors.text} />
                            </TouchableOpacity>
                        )}
                     </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        zIndex: 10,
    },
    headerTitle: {
        ...typography.h3,
        color: colors.text,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowRadius: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xl,
    },
    mediaContainer: {
        width: SCREEN_WIDTH - spacing.xl * 2,
        aspectRatio: 1, // Start with square, usually nice
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaWrapper: {
        width: '100%',
        height: '100%',
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        zIndex: 2,
        backgroundColor: colors.surfaceElevated,
    },
    media: {
        width: '100%',
        height: '100%',
    },
    glow: {
        position: 'absolute',
        width: '110%',
        height: '110%',
        borderRadius: 100, // Circular-ish glow
        opacity: 0.3,
        zIndex: 1,
        transform: [{ translateY: 10 }],
        filter: 'blur(20px)', // Web only, but doesn't hurt native much
    },
    promptCard: {
        width: SCREEN_WIDTH - spacing.xl * 2,
        padding: spacing.lg,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        gap: spacing.sm,
    },
    label: {
        ...typography.labelSmall,
        color: colors.textSecondary,
        letterSpacing: 1,
    },
    promptText: {
        ...typography.bodySmall,
        color: colors.text,
    },
    modelTag: {
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: borderRadius.sm,
        marginTop: spacing.xs,
    },
    modelText: {
        fontSize: 10,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    footer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 60 : 40,
        width: '100%',
        paddingHorizontal: spacing.xl,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: borderRadius.full,
        gap: spacing.sm,
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#fff',
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    saveButtonText: {
        ...typography.button,
        color: '#000',
    },
    iconButton: {
        width: 56,
        height: 56,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
});
