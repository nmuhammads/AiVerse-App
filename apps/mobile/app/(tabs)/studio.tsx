import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
    StudioHeader,
    VideoSettings,
    ActiveGenerationsPanel
} from '../../components/studio';

export default function StudioScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const router = useRouter();

    // Global Studio State
    const [studioMode, setStudioMode] = useState<'studio' | 'chat'>('studio');
    const [balance] = useState(1250); // Mock balance

    // Generation State
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [selectedModel, setSelectedModel] = useState('seedream4');
    const [prompt, setPrompt] = useState((params.prompt as string) || '');
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [imageCount, setImageCount] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);

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
    }, [params]);

    const userId = useUserStore((state) => state.user.id);

    const handleGenerate = async () => {
        if (!prompt.trim() && selectedModel !== 'kling-mc') return;

        setIsGenerating(true);
        try {
            // Call real API
            const response = await api.post<{
                success: boolean;
                generationId?: number;
                error?: string;
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

            if (response.success && response.generationId) {
                Alert.alert(
                    'Generation Started',
                    `Your ${mediaType} is being generated. You'll be notified when it's ready.`,
                    [{ text: 'OK' }]
                );
                // Clear prompt after successful start
                setPrompt('');
            } else {
                Alert.alert('Error', response.error || 'Generation failed');
            }
        } catch (error: any) {
            console.error('Generation error:', error);
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
                    <StudioHeader
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
            {/* Top Telegram Header (Safe Area handled in _layout) */}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <StudioHeader
                    studioMode={studioMode}
                    balance={balance}
                    onSetStudioMode={setStudioMode}
                    onOpenEditor={() => Alert.alert('Editor', 'Open Editor')}
                    onOpenPayment={() => Alert.alert('Payment', 'Open Payment Modal')}
                />

                <ScrollView
                    contentContainerStyle={[
                        styles.content,
                        { paddingBottom: 220 } // Space for footer
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* 1. Model Selection */}
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

                    {/* Generation Mode Selector (Text to Image / Image to Image) */}
                    <View style={styles.genModeSelector}>
                        <TouchableOpacity style={[styles.genModeButton, styles.genModeActive]}>
                            <Ionicons name="text" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.genModeTextActive}>Text to Image</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.genModeButton}>
                            <Ionicons name="image" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                            <Text style={styles.genModeText}>Image to Image</Text>
                        </TouchableOpacity>
                    </View>

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

                    {/* 3. Image Upload (Reference) */}
                    <ImageUploader
                        images={uploadedImages}
                        onAddImage={uri => setUploadedImages(prev => [...prev, uri])}
                        onRemoveImage={index => setUploadedImages(prev => prev.filter((_, i) => i !== index))}
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
                </ScrollView>

                {/* Bottom Action Bar */}
                <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xs }]}>
                    {/* Active Generations Panel */}
                    <ActiveGenerationsPanel onViewResult={handleViewResult} />

                    <GenerateButton
                        onPress={handleGenerate}
                        isDisabled={!prompt.trim() && selectedModel !== 'kling-mc'}
                        isGenerating={isGenerating}
                        cost={imageCount * 1}
                    />
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        gap: spacing.xl,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.lg,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.9)', // More opaque for readability
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
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
    genModeSelector: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        padding: 4,
        borderRadius: borderRadius.xl,
        height: 48,
    },
    genModeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.lg,
    },
    genModeActive: {
        backgroundColor: colors.surfaceLight,
    },
    genModeText: {
        color: colors.textSecondary,
        fontWeight: '600',
        fontSize: 13,
    },
    genModeTextActive: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    },
});
