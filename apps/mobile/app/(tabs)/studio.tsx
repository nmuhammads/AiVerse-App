import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { colors, spacing, borderRadius } from '../../theme';
import { api } from '../../lib/api';
import { useUserStore } from '../../store/userStore';

// Components
import {
    ModelSelector,
    PromptInput,
    ImageUploader,
    SettingsPanel,
    GenerateButton,
    StudioSubHeader,
    VideoSettings,
    ActiveGenerationsPanel,
} from '../../components/studio';
import { ResultModal } from '../../components/ResultModal';

export default function StudioScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const router = useRouter();

    // Safely get tab bar height (might be 0 or undefined in some contexts, provide fallback)
    let tabBarHeight = 0;
    try {
        tabBarHeight = useBottomTabBarHeight();
    } catch (e) {
        // Fallback if hook fails (e.g. not inside tab navigator context properly or mock)
        tabBarHeight = 60;
    }

    // Global Studio State
    const [studioMode, setStudioMode] = useState<'studio' | 'chat'>('studio');
    const [balance] = useState(1250); // Mock balance

    // Generation State
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [generationMode, setGenerationMode] = useState<'text' | 'image'>('text');
    const [selectedModel, setSelectedModel] = useState('seedream4');
    const [prompt, setPrompt] = useState((params.prompt as string) || '');
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [imageCount, setImageCount] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);

    // Result Modal State
    const [resultModalVisible, setResultModalVisible] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);

    // Video State
    const [videoDuration, setVideoDuration] = useState<'4' | '8' | '12'>('4');
    const [videoResolution, setVideoResolution] = useState('480p');
    const [fixedLens, setFixedLens] = useState(true);
    const [generateAudio, setGenerateAudio] = useState(false);

    // Kling State
    const [klingDuration, setKlingDuration] = useState<'5' | '10'>('5');
    const [klingSound, setKlingSound] = useState(false);
    const [klingMCQuality, setKlingMCQuality] = useState<'720p' | '1080p'>('720p');
    const [characterOrientation, setCharacterOrientation] = useState<'image' | 'video'>('video');
    const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
    const [videoDurationSeconds, setVideoDurationSeconds] = useState(0);
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);

    // Initial setup from params
    React.useEffect(() => {
        if (params.prompt) {
            setPrompt(params.prompt as string);
        }
        if (params.model) {
            setSelectedModel(params.model as string);
        }
        if (params.ratio) {
            setAspectRatio(params.ratio as string);
        }
        if (params.mode) {
            setGenerationMode(params.mode as 'text' | 'image');
        }
        if (params.media_type) {
            setMediaType(params.media_type as 'image' | 'video');
        }
        // Handle input images if passed as JSON string or array
        if (params.input_images) {
            try {
                const images = typeof params.input_images === 'string'
                    ? JSON.parse(params.input_images)
                    : params.input_images;
                if (Array.isArray(images)) {
                    setUploadedImages(images);
                    setGenerationMode('image');
                }
            } catch (e) {
                console.error('Failed to parse input parameters', e);
            }
        }
    }, [params]);

    const userId = useUserStore((state) => state.user.id);

    const handleGenerate = async () => {
        if (!prompt.trim() && selectedModel !== 'kling-mc') return;

        setIsGenerating(true);
        try {
            // Call real API
            // Call real API
            const response = await api.post<{
                success: boolean;
                generationId?: number;
                generation_id?: number;
                id?: number;

                error?: string;
                image?: string;
                images?: string[];
            }>('/generation/generate', {
                prompt: prompt.trim(),
                model: selectedModel,
                aspect_ratio: aspectRatio,
                user_id: userId,
                media_type: mediaType,
                images: uploadedImages.length > 0 ? uploadedImages : undefined,
                // Video params
                video_duration: mediaType === 'video' ? videoDuration : undefined,
                video_resolution: mediaType === 'video' ? videoResolution : undefined,
                fixed_lens: mediaType === 'video' ? fixedLens : undefined,
                generate_audio: mediaType === 'video' ? generateAudio : undefined,
            });

            console.log('[Studio] Generation response:', response);

            const genId = response.generationId || response.generation_id || response.id;

            const hasResult = (response.success && !!genId) || !!response.image || (!!response.images && response.images.length > 0);

            if (hasResult) {
                // Show Result Modal
                const imageUrl = response.image || (response.images && response.images[0]);
                if (imageUrl) {
                    setResultImage(imageUrl);
                    setResultModalVisible(true);
                } else {
                    Alert.alert(
                        'Generation Started',
                        `Your ${mediaType} is being generated. You'll be notified when it's ready.`,
                        [{ text: 'OK' }]
                    );
                }

                // Clear prompt after successful start
                setPrompt('');
            } else {
                console.warn('[Studio] Generation failed response:', response);
                Alert.alert('Error', response.error || 'Generation failed (Unknown response)');
            }
        } catch (error: any) {
            console.error('[Studio] Generation error:', error);
            Alert.alert('Error', error.message || 'Failed to start generation');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleOptimize = async () => {
        if (!prompt.trim()) return;
        setIsOptimizing(true);
        setTimeout(() => {
            setPrompt(prev => prev + ' highly detailed, 8k resolution, cinematic lighting');
            setIsOptimizing(false);
        }, 1500);
    };

    const handleViewResult = (gen: any) => {
        Alert.alert('View Result', `Viewing generation ${gen.id}`);
    };

    if (studioMode === 'chat') {
        return (
            <View style={styles.container}>
                <View style={{ flex: 1 }}>
                    <StudioSubHeader
                        studioMode={studioMode}
                        balance={balance}
                        onSetStudioMode={setStudioMode}
                        onOpenEditor={() => Alert.alert('Editor', 'Image Editor coming soon')}
                        onOpenPayment={() => Alert.alert('Payment', 'Open Payment Modal')}
                    />
                    <View style={styles.centerContent}>
                        <PromptInput
                            value="Chat mode coming soon..."
                            onChangeText={() => { }}
                            isOptimizing={false}
                            onOptimize={() => { }}
                            onDescribe={() => { }}
                            onClear={() => setStudioMode('studio')}
                        />
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Keyboard Avoiding to manage soft input */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            >
                <StudioSubHeader
                    studioMode={studioMode}
                    balance={balance}
                    onSetStudioMode={setStudioMode}
                    onOpenEditor={() => Alert.alert('Editor', 'Open Editor')}
                    onOpenPayment={() => Alert.alert('Payment', 'Open Payment Modal')}
                />

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 100 }]}
                >
                    {/* 1. Model Selection & Generation Mode */}
                    <ModelSelector
                        selectedModel={selectedModel}
                        mediaType={mediaType}
                        onSelectModel={setSelectedModel}
                        onSelectMediaType={setMediaType}
                    />

                    {/* Multi-Generation Banner */}
                    <TouchableOpacity style={styles.multiGenBanner}>
                        <View style={styles.multiGenIcon}>
                            <Ionicons name="layers" size={20} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.multiGenTitle}>Multi-Generation</Text>
                            <Text style={styles.multiGenSubtitle}>Create up to 3 variants in different AI models</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>

                    {/* Generation Mode Selector (Text/Image to ...) - RESTORED HERE */}
                    {selectedModel !== 'kling-mc' && selectedModel !== 'kling-t2v' && selectedModel !== 'kling-i2v' && (
                        <View style={styles.genModeSelector}>
                            <TouchableOpacity
                                style={[styles.genModeButton, generationMode === 'text' && styles.genModeActive]}
                                onPress={() => setGenerationMode('text')}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="text"
                                    size={16}
                                    color={generationMode === 'text' ? '#fff' : colors.textSecondary}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={[styles.genModeText, generationMode === 'text' && styles.genModeTextActive]}>
                                    {mediaType === 'image' ? 'Text to Image' : 'Text to Video'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.genModeButton, generationMode === 'image' && styles.genModeActive]}
                                onPress={() => setGenerationMode('image')}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name="images"
                                    size={16}
                                    color={generationMode === 'image' ? '#fff' : colors.textSecondary}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={[styles.genModeText, generationMode === 'image' && styles.genModeTextActive]}>
                                    {mediaType === 'image' ? 'Image to Image' : 'Image to Video'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* 2. Prompt Input (Hidden for Kling MC) */}
                    {selectedModel !== 'kling-mc' && (
                        <PromptInput
                            value={prompt}
                            onChangeText={setPrompt}
                            isOptimizing={isOptimizing}
                            onOptimize={handleOptimize}
                            onDescribe={() => Alert.alert('Coming Soon', 'Image to Text feature coming soon!')}
                            onClear={() => setPrompt('')}
                        />
                    )}

                    {/* ... (rest of scroll component) ... */}
                    {/* 3. Image Upload (Reference) */}
                    <ImageUploader
                        images={uploadedImages}
                        onAddImage={uri => setUploadedImages(prev => [...prev, uri])}
                        onRemoveImage={index => setUploadedImages(prev => prev.filter((_, i) => i !== index))}
                        generationMode={generationMode}
                        mediaType={mediaType}
                    />

                    {/* 4. Settings Panel */}
                    {mediaType === 'image' ? (
                        <SettingsPanel
                            aspectRatio={aspectRatio}
                            onSelectAspectRatio={setAspectRatio}
                            imageCount={imageCount}
                            onSelectImageCount={setImageCount}
                        />
                    ) : (
                        <VideoSettings
                            mediaType={mediaType}
                            selectedModel={selectedModel}
                            videoDuration={videoDuration}
                            videoResolution={videoResolution}
                            fixedLens={fixedLens}
                            generateAudio={generateAudio}
                            klingDuration={klingDuration}
                            klingSound={klingSound}
                            klingMCQuality={klingMCQuality}
                            characterOrientation={characterOrientation}
                            uploadedImages={uploadedImages}
                            uploadedVideoUrl={uploadedVideoUrl}
                            videoDurationSeconds={videoDurationSeconds}
                            isUploadingVideo={isUploadingVideo}
                            prompt={prompt}
                            onSetVideoDuration={setVideoDuration}
                            onSetVideoResolution={setVideoResolution}
                            onSetFixedLens={setFixedLens}
                            onSetGenerateAudio={setGenerateAudio}
                            onSetKlingDuration={setKlingDuration}
                            onSetKlingSound={setKlingSound}
                            onSetKlingMCQuality={setKlingMCQuality}
                            onSetCharacterOrientation={setCharacterOrientation}
                            onSetUploadedImages={setUploadedImages}
                            onSetUploadedVideoUrl={setUploadedVideoUrl}
                            onSetIsUploadingVideo={setIsUploadingVideo}
                            onSetPrompt={setPrompt}
                        />
                    )}

                    {/* Bottom Action Bar containing Generate Button */}
                    {/* Moved INSIDE ScrollView to scroll with content */}
                    <View style={styles.footer}>
                        {/* Active Generations Panel */}
                        <ActiveGenerationsPanel onViewResult={handleViewResult} />

                        <GenerateButton
                            onPress={handleGenerate}
                            isDisabled={!prompt.trim() && selectedModel !== 'kling-mc'}
                            isGenerating={isGenerating}
                            cost={imageCount * 1}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <ResultModal
                visible={resultModalVisible}
                startIndex={0}
                items={[{
                    id: 0, // Mock ID for preview
                    image_url: resultImage || '',
                    prompt: prompt,
                    likes_count: 0,
                    created_at: new Date().toISOString(),
                    media_type: mediaType
                }]}
                onClose={() => setResultModalVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    // Updated Content styles
    scrollContent: {
        paddingHorizontal: spacing.md, // 16px lateral padding
        paddingTop: spacing.xs,
        // Ensure enough bottom padding so the footer can be scrolled ABOVE the floating tab bar.
        // TabBar is ~80px + Insets. 
        paddingBottom: 120,
        gap: spacing.md,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.lg,
    },
    footer: {
        // Now relative inside ScrollView
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        // Removed absolute positioning props
    },
    multiGenBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3b0764', // Dark purple background
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(236, 72, 153, 0.3)', // Pinkish border
        overflow: 'hidden',
    },
    multiGenIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#db2777', // Pink icon bg
        alignItems: 'center',
        justifyContent: 'center',
    },
    multiGenTitle: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    multiGenSubtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
    },
    // Styles for GenModeSelector
    genModeSelector: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 4,
        borderRadius: borderRadius.lg,
        height: 44,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    genModeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.md,
    },
    genModeActive: {
        backgroundColor: '#27272a', // zinc-800
    },
    genModeText: {
        color: colors.textSecondary,
        fontWeight: '600',
        fontSize: 13,
    },
    genModeTextActive: {
        color: '#fff',
    },
});
