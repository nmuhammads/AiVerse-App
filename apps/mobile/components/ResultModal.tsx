import React, { useState, useEffect } from 'react';
import { Modal, View, Image, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator, Alert, ScrollView, Platform, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    X,
    Share2,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Download,
    Repeat,
    Globe,
    EyeOff,
    Lock,
    Unlock,
    Copy,
    Check,
    Send,
    MessageSquare,
    Droplets
} from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
// Use legacy import as suggested by logs for SDK 52+
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { useUserStore } from '../store/userStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Config for layout
const MEDIA_HEIGHT_PERCENT = 0.55;
const MEDIA_HEIGHT = SCREEN_HEIGHT * MEDIA_HEIGHT_PERCENT;

interface Generation {
    id: number;
    image_url: string;
    video_url?: string;
    prompt: string;
    likes_count: number;
    created_at: string;
    media_type: 'image' | 'video';
    author?: {
        username: string;
        avatar_url?: string;
    };
    is_liked?: boolean;
    is_published?: boolean;
    is_prompt_private?: boolean;
    model?: string;
    edit_variants?: string[];
    input_images?: string[];
}

interface ResultModalProps {
    visible: boolean;
    startIndex: number;
    items: Generation[];
    onClose: () => void;
    onUpdateItem?: (id: number, updates: Partial<Generation>) => void;
    onRemix?: (item: Generation) => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({ visible, startIndex, items, onClose, onUpdateItem, onRemix }) => {
    const insets = useSafeAreaInsets();
    const user = useUserStore(state => state.user);
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const [imageIndex, setImageIndex] = useState(0); // For variants
    const [isSaving, setIsSaving] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Actions loading state
    const [publishingId, setPublishingId] = useState<number | null>(null);
    const [togglingPrivacyId, setTogglingPrivacyId] = useState<number | null>(null);
    const [sendingToChat, setSendingToChat] = useState(false);
    const [sendingWithPrompt, setSendingWithPrompt] = useState(false);
    const [sendingWithWatermark, setSendingWithWatermark] = useState(false);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(startIndex);
            setImageIndex(0);
        }
    }, [startIndex, visible]);

    const currentItem = items[currentIndex];

    if (!currentItem) return null;

    // Determine current media to show (original or variant)
    const allImages = currentItem.edit_variants && currentItem.edit_variants.length > 0
        ? [currentItem.image_url, ...currentItem.edit_variants]
        : [currentItem.image_url];

    const currentMediaUrl = currentItem.media_type === 'video' && currentItem.video_url
        ? currentItem.video_url
        : allImages[imageIndex];

    const showVariants = allImages.length > 1;

    const handleNext = () => {
        if (currentIndex < items.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setImageIndex(0);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setImageIndex(0);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out this generation from AiVerse!\nPrompt: ${currentItem.prompt}\n${currentMediaUrl}`
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const handleSave = async () => {
        if (!currentMediaUrl) return;

        try {
            setIsSaving(true);
            const { status } = await MediaLibrary.requestPermissionsAsync(true);

            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant permission to save to your gallery');
                return;
            }

            const fileExtension = currentMediaUrl.split('.').pop()?.split('?')[0] || (currentItem.media_type === 'video' ? 'mp4' : 'jpg');
            const fileName = `gen_${Date.now()}.${fileExtension}`;

            // Handle directory based on OS and availability (matching ResultView logic)
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

            const fileUri = fileDirectory + fileName;

            const downloadRes = await FileSystem.downloadAsync(currentMediaUrl, fileUri);
            if (downloadRes.status !== 200) throw new Error('Failed to download');

            const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
            await MediaLibrary.createAlbumAsync('AiVerse', asset, false);

            Alert.alert('Saved', 'Saved to gallery successfully!');
        } catch (error: any) {
            console.log(error);
            Alert.alert('Error', 'Failed to save media');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async (isPrivate = false) => {
        if (publishingId) return;
        setPublishingId(currentItem.id);
        const newStatus = !currentItem.is_published;

        // Optimistic
        onUpdateItem?.(currentItem.id, {
            is_published: newStatus,
            is_prompt_private: isPrivate
        });

        try {
            await api.post('/user/publish', {
                generationId: currentItem.id,
                isPublished: newStatus,
                isPrivate: isPrivate
            });
        } catch (e) {
            console.error(e);
            // Revert
            onUpdateItem?.(currentItem.id, {
                is_published: !newStatus,
                is_prompt_private: !isPrivate
            });
            Alert.alert('Error', 'Failed to update status');
        } finally {
            setPublishingId(null);
        }
    };

    const handlePrivacy = async () => {
        if (togglingPrivacyId) return;
        setTogglingPrivacyId(currentItem.id);
        const newPrivacy = !currentItem.is_prompt_private;

        // Optimistic
        onUpdateItem?.(currentItem.id, { is_prompt_private: newPrivacy });

        try {
            await api.patch(`/generation/${currentItem.id}/privacy`, {
                is_prompt_private: newPrivacy
            });
        } catch (e) {
            // Revert
            onUpdateItem?.(currentItem.id, { is_prompt_private: !newPrivacy });
        } finally {
            setTogglingPrivacyId(null);
        }
    };

    // Telegram specific actions
    const sendToChat = async () => {
        if (!user?.id) return;
        setSendingToChat(true);
        try {
            await api.post('/telegram/sendDocument', {
                chat_id: user.id,
                file_url: currentMediaUrl,
                caption: currentItem.prompt
            });
            Alert.alert('Success', 'Sent to chat!');
        } catch (e) {
            Alert.alert('Error', 'Failed to send to chat');
        } finally {
            setSendingToChat(false);
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.container}>
                {/* 1. Fixed Background Layer: Media & Controls */}
                <View style={styles.fixedLayer}>
                    {/* Media */}
                    <View style={styles.mediaContainer}>
                        {currentItem.media_type === 'video' ? (
                            <Video
                                source={{ uri: currentMediaUrl }}
                                style={styles.media}
                                resizeMode={ResizeMode.CONTAIN}
                                isLooping
                                isMuted={isVideoMuted}
                                shouldPlay={visible}
                                useNativeControls
                            />
                        ) : (
                            <Image
                                source={{ uri: currentMediaUrl }}
                                style={styles.media}
                                resizeMode="contain"
                            />
                        )}
                    </View>
                </View>


                {/* 2. Floating Header (Close/Share) - Always on top */}
                <View style={[styles.floatingHeader, { top: insets.top + 10 }]}>
                    <TouchableOpacity
                        onPress={handleShare}
                        style={styles.iconButton}
                    >
                        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                        <Share2 size={20} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.iconButton}
                    >
                        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                        <X size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Transparent Spacer to show media behind */}
                    <View style={{ height: MEDIA_HEIGHT }}>
                        {/* Navigation Arrows (Inside Spacer -> Scrollable) */}
                        {currentIndex > 0 && (
                            <TouchableOpacity style={[styles.navButton, styles.navLeft]} onPress={handlePrev}>
                                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                                <ChevronLeft size={24} color="#FFF" />
                            </TouchableOpacity>
                        )}
                        {currentIndex < items.length - 1 && (
                            <TouchableOpacity style={[styles.navButton, styles.navRight]} onPress={handleNext}>
                                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                                <ChevronRight size={24} color="#FFF" />
                            </TouchableOpacity>
                        )}

                        {/* Variant Switcher (Inside Spacer -> Scrollable) */}
                        {showVariants && (
                            <View style={styles.variantSwitcher}>
                                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                                <TouchableOpacity onPress={() => setImageIndex(prev => prev === 0 ? allImages.length - 1 : prev - 1)}>
                                    <ChevronLeft size={16} color="#FFF" />
                                </TouchableOpacity>
                                <Text style={styles.variantText}>{imageIndex + 1}/{allImages.length}</Text>
                                <TouchableOpacity onPress={() => setImageIndex(prev => prev === allImages.length - 1 ? 0 : prev + 1)}>
                                    <ChevronRight size={16} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* The Content Sheet */}
                    <View style={styles.sheetContainer} pointerEvents="auto">
                        {/* Drag Handle Indicator */}
                        <View style={styles.dragHandleContainer}>
                            <View style={styles.dragHandle} />
                        </View>

                        {/* Send to Chat Grid */}
                        <View style={styles.sectionBox}>
                            <Text style={styles.sectionTitle}>SEND TO</Text>
                            <View style={styles.actionGrid}>
                                <TouchableOpacity style={styles.gridActionBtn} onPress={sendToChat} disabled={sendingToChat}>
                                    <View style={[styles.gridIconBox, { backgroundColor: '#7c3aed' }]}>
                                        {sendingToChat ? <ActivityIndicator color="#fff" size="small" /> : <Send size={20} color="#fff" />}
                                    </View>
                                    <Text style={styles.gridLabel}>Chat</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.gridActionBtn} disabled={sendingWithPrompt}>
                                    <LinearGradient colors={['#f59e0b', '#ea580c']} style={styles.gridIconBox}>
                                        <MessageSquare size={20} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.gridLabel}>+ Prompt</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.gridActionBtn} disabled={sendingWithWatermark}>
                                    <LinearGradient colors={['#06b6d4', '#2563eb']} style={styles.gridIconBox}>
                                        <Droplets size={20} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.gridLabel}>Watermark</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Secondary Actions */}
                        <View style={styles.rowActions}>
                            <TouchableOpacity style={styles.pillButton} onPress={handleSave} disabled={isSaving}>
                                <Download size={16} color="#000" />
                                <Text style={styles.pillButtonTextBlack}>{isSaving ? 'Saving...' : 'Save'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.gradientPillButton} onPress={() => onRemix?.(currentItem)}>
                                <LinearGradient colors={['#c026d3', '#7c3aed']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                                <Repeat size={16} color="#fff" />
                                <Text style={styles.pillButtonTextWhite}>Remix</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Publish / Privacy Row */}
                        <View style={styles.rowActions}>
                            <TouchableOpacity
                                style={[styles.outlineButton, currentItem.is_published ? { backgroundColor: '#27272a', borderWidth: 0 } : { backgroundColor: '#059669', borderWidth: 0 }]}
                                onPress={() => handlePublish(currentItem.is_prompt_private)}
                            >
                                {currentItem.is_published ? <EyeOff size={16} color="#9ca3af" /> : <Globe size={16} color="#fff" />}
                                <Text style={currentItem.is_published ? styles.outlineTextGray : styles.outlineTextWhite}>
                                    {currentItem.is_published ? 'Unpublish' : 'Publish'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.outlineButton, currentItem.is_prompt_private && { borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}
                                onPress={handlePrivacy}
                            >
                                {currentItem.is_prompt_private ? <Lock size={16} color="#f59e0b" /> : <Unlock size={16} color="#9ca3af" />}
                                <Text style={currentItem.is_prompt_private ? { color: '#f59e0b', fontWeight: '600' } : styles.outlineTextGray}>
                                    {currentItem.is_prompt_private ? 'Private' : 'Public'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Prompt Box */}
                        <View style={styles.promptBox}>
                            <View style={styles.promptHeader}>
                                <Text style={styles.sectionTitle}>PROMPT</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsCopied(true);
                                        setTimeout(() => setIsCopied(false), 2000);
                                    }}
                                    style={styles.copyBtn}
                                >
                                    {isCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} color="#71717a" />}
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.promptText}>{currentItem.prompt}</Text>
                        </View>

                        {/* Smaller Padding for delete button accessibility */}
                        <View style={{ height: 24 }} />

                        <TouchableOpacity style={styles.deleteButton}>
                            <Trash2 size={20} color="#ef4444" />
                        </TouchableOpacity>
                        <View style={{ height: insets.bottom + 60 }} />

                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    fixedLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: MEDIA_HEIGHT, // Occupies top part
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaContainer: {
        width: '100%',
        height: '100%',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    floatingHeader: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        zIndex: 50,
        pointerEvents: 'box-none', // Let touches pass through the row itself if needed? No, buttons catch them.
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    navButton: {
        position: 'absolute',
        top: '50%',
        marginTop: -20,
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 10,
    },
    navLeft: { left: 10 },
    navRight: { right: 10 },
    variantSwitcher: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        overflow: 'hidden',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 16,
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 10,
    },
    variantText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    sheetContainer: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        backgroundColor: '#18181b',
        paddingHorizontal: 20,
        minHeight: SCREEN_HEIGHT * 0.5, // Ensure it fills some space
        paddingTop: 10,
    },
    dragHandleContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 10,
        marginBottom: 10,
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#3f3f46',
    },
    sectionBox: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 11,
        color: '#71717a',
        fontWeight: 'bold',
        marginBottom: 12,
    },
    actionGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    gridActionBtn: {
        alignItems: 'center',
        gap: 8,
    },
    gridIconBox: {
        width: 56,
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    gridLabel: {
        color: '#d4d4d8',
        fontSize: 12,
        fontWeight: '500',
    },
    rowActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    pillButton: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    pillButtonTextBlack: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 14,
    },
    gradientPillButton: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    pillButtonTextWhite: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    outlineButton: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#3f3f46',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    outlineTextGray: {
        color: '#9ca3af',
        fontWeight: '600',
        fontSize: 14,
    },
    outlineTextWhite: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    promptBox: {
        backgroundColor: '#09090b',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#27272a',
    },
    promptHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    copyBtn: {
        padding: 4,
    },
    promptText: {
        color: '#e4e4e7',
        fontSize: 14,
        lineHeight: 22,
    },
    deleteButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 20,
    }
});
