import React, { useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGenerationStore, type ModelType, type AspectRatio } from '@/store/generationStore'
import { useTelegram } from '@/hooks/useTelegram'
import { Send, Upload, Download, Share2 } from 'lucide-react'

const MODELS: { id: ModelType; name: string; description: string }[] = [
  { id: 'flux', name: 'Flux', description: 'Default Text-to-Image' },
  { id: 'seedream4', name: 'Seedream 4', description: 'High Quality' },
  { id: 'nanobanana', name: 'Nanobanana', description: 'Fast Generation' },
  { id: 'qwen-edit', name: 'Qwen Edit', description: 'Image Editing' }
]

const ASPECT_RATIOS: { id: AspectRatio; name: string }[] = [
  { id: '1:1', name: 'Square (1:1)' },
  { id: '16:9', name: 'Landscape (16:9)' },
  { id: '9:16', name: 'Portrait (9:16)' }
]

export function GenerationForm() {
  const {
    selectedModel,
    prompt,
    uploadedImage,
    aspectRatio,
    generatedImage,
    isGenerating,
    error,
    currentScreen,
    setSelectedModel,
    setPrompt,
    setUploadedImage,
    setAspectRatio,
    setGeneratedImage,
    setIsGenerating,
    setError,
    setCurrentScreen
  } = useGenerationStore()

  const { showMainButton, hideMainButton, showProgress, hideProgress, shareImage } = useTelegram()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Управление Telegram MainButton
  useEffect(() => {
    if (currentScreen === 'form') {
      const buttonText = selectedModel === 'qwen-edit' ? 'Edit Image' : 'Generate Image'
      showMainButton(buttonText, handleGenerate)
    } else {
      hideMainButton()
    }

    return () => {
      hideMainButton()
    }
  }, [currentScreen, selectedModel, prompt, uploadedImage])

  // Обработка загрузки изображения
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Генерация изображения
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    if (selectedModel === 'qwen-edit' && !uploadedImage) {
      setError('Please upload an image for editing')
      return
    }

    setIsGenerating(true)
    setError(null)
    showProgress(selectedModel === 'qwen-edit' ? 'Editing...' : 'Generating...')

    try {
      const response = await fetch('/api/generation/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          aspect_ratio: aspectRatio,
          image: uploadedImage
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed')
      }

      setGeneratedImage(data.image)
      setCurrentScreen('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
      hideProgress()
    }
  }

  // Скачивание изображения
  const handleDownload = () => {
    if (!generatedImage) return

    const link = document.createElement('a')
    link.href = generatedImage
    link.download = `generated-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Поделиться изображением
  const handleShare = () => {
    if (!generatedImage) return

    // Попробуем использовать Telegram Share
    shareImage(generatedImage, prompt)
  }

  // Возврат к форме
  const handleBack = () => {
    setCurrentScreen('form')
    setGeneratedImage(null)
    setError(null)
  }

  if (currentScreen === 'result' && generatedImage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white/10 backdrop-blur-lg border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-2xl">Generation Result</CardTitle>
              <CardDescription className="text-gray-300">
                Model: {MODELS.find(m => m.id === selectedModel)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="relative">
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="w-full rounded-lg shadow-lg"
                />
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={handleDownload}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  onClick={handleShare}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>

              <Button
                onClick={handleBack}
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Generate Another
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-2xl">AI Image Generator</CardTitle>
            <CardDescription className="text-gray-300">
              Create amazing images with AI
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Выбор модели */}
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Select Model</label>
              <Tabs value={selectedModel} onValueChange={(value) => setSelectedModel(value as ModelType)}>
                <TabsList className="grid grid-cols-2 lg:grid-cols-4">
                  {MODELS.map((model) => (
                    <TabsTrigger key={model.id} value={model.id} className="text-xs">
                      {model.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Загрузка изображения для Qwen Edit */}
            {selectedModel === 'qwen-edit' && (
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">Upload Image to Edit</label>
                <div className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  
                  {uploadedImage ? (
                    <div className="space-y-3">
                      <img
                        src={uploadedImage}
                        alt="Uploaded"
                        className="max-w-full max-h-32 mx-auto rounded-lg"
                      />
                      <Button
                        onClick={() => setUploadedImage(null)}
                        variant="outline"
                        size="sm"
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        Remove Image
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer space-y-2"
                    >
                      <Upload className="w-8 h-8 mx-auto text-white/60" />
                      <p className="text-white/60 text-sm">Click to upload image</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Выбор соотношения сторон (только для text-to-image) */}
            {selectedModel !== 'qwen-edit' && (
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map((ratio) => (
                    <Button
                      key={ratio.id}
                      onClick={() => setAspectRatio(ratio.id)}
                      variant={aspectRatio === ratio.id ? 'default' : 'outline'}
                      className={aspectRatio === ratio.id 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'border-white/20 text-white hover:bg-white/10'
                      }
                    >
                      {ratio.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Поле для промпта */}
            <div className="space-y-2">
              <label className="text-white text-sm font-medium">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={selectedModel === 'qwen-edit' 
                  ? "Describe what you want to change in the image..."
                  : "Describe the image you want to create..."
                }
                className="w-full h-24 p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* Ошибка */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-200 text-sm">
                {error}
              </div>
            )}

            {/* Кнопка генерации */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Generating...
                </div>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {selectedModel === 'qwen-edit' ? 'Edit Image' : 'Generate Image'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
