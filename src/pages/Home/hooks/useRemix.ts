import { useNavigate } from 'react-router-dom'
import { useHaptics } from '@/hooks/useHaptics'
import { useGenerationStore, type ModelType } from '@/store/generationStore'
import type { FeedItem } from '@/components/FeedImage'

export function useRemix() {
    const { impact } = useHaptics()
    const navigate = useNavigate()

    const {
        setPrompt,
        setSelectedModel,
        setParentGeneration,
        setCurrentScreen,
        setAspectRatio,
        setGenerationMode,
        setUploadedImages,
        setMediaType
    } = useGenerationStore()

    const handleRemix = (item: FeedItem) => {
        impact('medium')

        // Check if prompt is private - pass flag to store for UI hiding
        const isPrivate = item.is_prompt_private === true

        // Parse metadata from prompt - always process prompt for generation to work
        // Format: ... real prompt ... [type=text_photo; ratio=3:4; photos=1]
        let cleanPrompt = item.prompt || ''
        let metadata: Record<string, string> = {}

        // Always parse metadata if prompt exists
        if (item.prompt) {
            // Match [ ... ] at the end of the string, allowing for whitespace
            const match = item.prompt.match(/\s*\[(.*?)\]\s*$/)
            if (match) {
                const metaString = match[1]
                cleanPrompt = item.prompt.replace(match[0], '').trim()

                metaString.split(';').forEach(part => {
                    const [key, val] = part.split('=').map(s => s.trim())
                    if (key && val) metadata[key] = val
                })
            }
        }

        setPrompt(cleanPrompt)

        if (item.model) {
            // Map model string to ModelType if possible, otherwise default
            const modelMap: Record<string, ModelType> = {
                'nanobanana': 'nanobanana',
                'nanobanana-pro': 'nanobanana-pro',
                'seedream4': 'seedream4',
                'seedream4-5': 'seedream4-5',
                'seedream4.5': 'seedream4-5', // Fallback for potential legacy/dot notation
                'qwen-edit': 'seedream4-5', // Legacy handling (just in case)
                'seedance-1.5-pro': 'seedance-1.5-pro',
                'gptimage1.5': 'gpt-image-1.5'
            }
            if (modelMap[item.model]) {
                setSelectedModel(modelMap[item.model])
            }
        }

        // Apply metadata settings
        if (metadata.ratio) {
            // Validate ratio before setting
            const validRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '16:21', 'Auto', 'square_hd', 'portrait_4_3', 'portrait_16_9', 'landscape_4_3', 'landscape_16_9']
            if (validRatios.includes(metadata.ratio)) {
                setAspectRatio(metadata.ratio as any)
            }
        }

        if (metadata.type) {
            if (metadata.type === 'text_photo') {
                setGenerationMode('image')
            } else {
                setGenerationMode('text')
            }
        }

        // Load input images if present
        if (item.input_images && item.input_images.length > 0) {
            setUploadedImages(item.input_images)
            setGenerationMode('image') // Ensure we are in image mode
        } else {
            setUploadedImages([])
        }

        // Set media type based on item
        if (item.media_type === 'video') {
            setMediaType('video')
            // Ensure we use the video model
            if (!item.model || item.model === 'seedance-1.5-pro') {
                setSelectedModel('seedance-1.5-pro')
            }
        } else {
            setMediaType('image')
        }

        setParentGeneration(item.id, item.author.username, isPrivate)
        setCurrentScreen('form')
        navigate('/studio')
    }

    return { handleRemix }
}
