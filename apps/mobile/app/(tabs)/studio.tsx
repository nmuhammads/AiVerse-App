import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { colors, spacing, borderRadius } from '../../theme';
import * as FileSystem from 'expo-file-system/legacy';
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
    ResultView, // Use the new ResultView
} from '../../components/studio';
// Removed ResultModal import


export default function StudioScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const router = useRouter();

    // Safely get tab bar height
    let tabBarHeight = 0;
    try {
        tabBarHeight = useBottomTabBarHeight();
    } catch (e) {
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
    const [klingVideoMode, setKlingVideoMode] = useState<'t2v' | 'i2v' | 'motion-control'>('t2v');

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
            // Process images: Convert local file URIs to Base64
            let start = Date.now();
            const processedImages = uploadedImages.length > 0 ? await Promise.all(uploadedImages.map(async (uri) => {
                // If it's already a remote URL, return it as is
                if (uri.startsWith('http') || uri.startsWith('https')) {
                    return uri;
                }

                try {
                    // Check file extension for MIME type
                    const ext = uri.split('.').pop()?.toLowerCase();
                    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

                    // Handle content:// URIs on Android by copying to cache if direct read fails
                    let fileUri = uri;
                    if (Platform.OS === 'android' && uri.startsWith('content://')) {
                        try {
                            const fileInfo = await FileSystem.getInfoAsync(uri);
                            if (!fileInfo.exists) {
                                throw new Error('File does not exist');
                            }
                        } catch (e) {
                            // If getInfo fails or file doesn't exist, try copying to cache
                            const cachePath = `${FileSystem.documentDirectory}upload-${Date.now()}.${ext || 'jpg'}`;
                            await FileSystem.copyAsync({ from: uri, to: cachePath });
                            fileUri = cachePath;
                        }
                    }

                    const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
                    return `data:${mimeType};base64,${base64}`;
                } catch (e: any) {
                    console.error('Failed to convert image to base64:', e);
                    Alert.alert('Upload Error', `Failed to process image: ${e.message}`);
                    return null; // Return null on failure
                }
            })) : undefined;
            console.log(`[Studio] Image conversion took ${Date.now() - start}ms`);

            // Check for failed image processings
            if (processedImages && processedImages.includes(null)) {
                setIsGenerating(false);
                return;
            }

            // Filter out nulls to satisfy TypeScript (though we already checked)
            const validImages = processedImages ? processedImages.filter((img): img is string => img !== null) : undefined;

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
                images: validImages,
                video_duration: mediaType === 'video' ? videoDuration : undefined,
                video_resolution: mediaType === 'video' ? videoResolution : undefined,
                fixed_lens: mediaType === 'video' ? fixedLens : undefined,
                generate_audio: mediaType === 'video' ? generateAudio : undefined,
            });

            console.log('[Studio] Generation response:', response);

            const genId = response.generationId || response.generation_id || response.id;
            const hasResult = (response.success && !!genId) || !!response.image || (!!response.images && response.images.length > 0);

            if (hasResult) {
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
            <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'android' ? 60 : 54) }]}>
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
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'android' ? 60 : 54) }]}>
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
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: tabBarHeight + 20 }
                    ]}
                >
                    {/* 1. Model Selection & Generation Mode */}
                    <ModelSelector
                        selectedModel={selectedModel}
                        mediaType={mediaType}
                        generationMode={generationMode}
                        klingVideoMode={klingVideoMode}
                        onSelectModel={setSelectedModel}
                        onSelectMediaType={setMediaType}
                        onSelectGenerationMode={setGenerationMode}
                        onSelectKlingVideoMode={setKlingVideoMode}
                        onOpenMultiGeneration={() => router.push('/multi-generation')}
                    />

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
                        generationMode={generationMode}
                        mediaType={mediaType}
                        selectedModel={selectedModel}
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

                    {/* 5. Generation Actions */}
                    <View style={styles.generationActions}>
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

            <ResultView
                visible={resultModalVisible}
                result={resultImage ? {
                    id: 0, // Mock ID or from response if available
                    image_url: resultImage,
                    prompt: prompt,
                    model: selectedModel,
                    media_type: mediaType,
                } : null}
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
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        gap: spacing.md,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.lg,
    },
    generationActions: {
        gap: spacing.sm,
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
    }
});
