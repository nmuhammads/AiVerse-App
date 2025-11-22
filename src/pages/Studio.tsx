import { useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, CloudRain, Code2, Zap, Image as ImageIcon, Type, X } from 'lucide-react'
import { useGenerationStore, type ModelType, type AspectRatio } from '@/store/generationStore'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'

const MODELS: { id: ModelType; name: string; desc: string; color: string; icon: string }[] = [
  { id: 'nanobanana', name: 'NanoBanana', desc: '3 токена', color: 'from-yellow-400 to-orange-500', icon: '/models/nanobanana.png' },
  { id: 'nanobanana-pro', name: 'NanoBanana Pro', desc: '4 токена', color: 'from-pink-500 to-rose-500', icon: '/models/nanobanana-pro.png' },
  { id: 'seedream4', name: 'Seedream 4', desc: '3 токена', color: 'from-purple-400 to-fuchsia-500', icon: '/models/seedream.png' },
  { id: 'qwen-edit', name: 'Qwen Edit', desc: '3 токена', color: 'from-emerald-400 to-teal-500', icon: '/models/qwen.png' },
]

const MODEL_PRICES: Record<ModelType, number> = {
  nanobanana: 3,
  'nanobanana-pro': 4,
  seedream4: 3,
  'qwen-edit': 3,
}

const SUPPORTED_RATIOS: Record<ModelType, AspectRatio[]> = {
  'nanobanana-pro': ['Auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16', '16:21'],
  seedream4: ['16:9', '4:3', '1:1', '3:4', '9:16'],
  nanobanana: ['Auto', '16:9', '4:3', '1:1', '3:4', '9:16'],
  'qwen-edit': ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
}

const RATIO_EMOJIS: Record<AspectRatio, string> = {
  'Auto': '✨',
  '1:1': '🟧',
  '16:9': '🖥️',
  '9:16': '📱',
  '4:3': '📺',
  '3:4': '📕',
  '21:9': '🎬',
  '16:21': '📜'
}

export default function Studio() {
  const {
    selectedModel,
    prompt,
    negativePrompt,
    uploadedImages,
    aspectRatio,
    generationMode,
    generatedImage,
    isGenerating,
    error,
    currentScreen,
    setSelectedModel,
    setPrompt,
    setNegativePrompt,
    setUploadedImages,
    addUploadedImage,
    removeUploadedImage,
    setAspectRatio,
    setGenerationMode,
    setGeneratedImage,
    setIsGenerating,
    setError,
    setCurrentScreen,
  } = useGenerationStore()

  const { shareImage, saveToGallery, user } = useTelegram()
  const { impact, notify } = useHaptics()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Limit check
    const maxImages = selectedModel === 'qwen-edit' ? 1 : 8
    if (uploadedImages.length + files.length > maxImages) {
      setError(`Максимум ${maxImages} фото для этой модели`)
      notify('error')
      return
    }

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) {
          addUploadedImage(ev.target.result as string)
        }
      }
      reader.readAsDataURL(file)
    })
    impact('light')
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Введите промпт')
      notify('error')
      return
    }
    if (generationMode === 'image' && uploadedImages.length === 0) {
      setError('Загрузите изображение')
      notify('error')
      return
    }
    setIsGenerating(true)
    setError(null)

    impact('heavy')
    try {
      const res = await fetch('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          negative_prompt: selectedModel === 'qwen-edit' ? negativePrompt : undefined,
          model: selectedModel,
          aspect_ratio: aspectRatio,
          images: generationMode === 'image' ? uploadedImages : [],
          user_id: user?.id || null
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации')
      setGeneratedImage(data.image)
      try {
        const item = { id: Date.now(), url: data.image, prompt, model: MODELS.find(m => m.id === selectedModel)?.name, ratio: aspectRatio, date: new Date().toLocaleDateString() }
        const prev = JSON.parse(localStorage.getItem('img_gen_history_v2') || '[]')
        const next = [item, ...prev]
        localStorage.setItem('img_gen_history_v2', JSON.stringify(next))
      } catch { void 0 }
      setCurrentScreen('result')
      notify('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка генерации')
      notify('error')
    } finally {
      setIsGenerating(false)
    }
  }

  if (currentScreen === 'result' && generatedImage) {
    return (
      <div className="min-h-dvh bg-black safe-bottom-tabbar">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Card className="bg-zinc-900/50 border-white/10 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">Результат</CardTitle>
              <CardDescription className="text-white/60">{MODELS.find(m => m.id === selectedModel)?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <img src={generatedImage} alt="result" className="w-full rounded-lg shadow-lg" />
              <div className="flex gap-3">
                <Button onClick={() => { saveToGallery(generatedImage, `ai-${Date.now()}.jpg`) }} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700">Скачать</Button>
                <Button onClick={() => shareImage(generatedImage, prompt)} className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700">Поделиться</Button>
              </div>
              <Button onClick={() => { setCurrentScreen('form'); setGeneratedImage(null); setError(null) }} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">Создать ещё</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const ratios = SUPPORTED_RATIOS[selectedModel]
  const maxImages = selectedModel === 'qwen-edit' ? 1 : 8

  return (
    <div className="min-h-dvh bg-black pb-32 flex flex-col">
      <div className="mx-auto max-w-3xl w-full px-4 py-4 flex-1 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">Studio</h1>
          <div className="px-2 py-1 rounded-full bg-zinc-900 border border-white/10 text-[10px] font-medium text-zinc-400">
            v2.2
          </div>
        </div>

        {/* 1. Compact Model Selector (Grid, no scroll) */}
        <div className="grid grid-cols-4 gap-2">
          {MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => { setSelectedModel(m.id); impact('light') }}
              className={`relative flex flex-col items-center gap-1.5 py-2 rounded-xl border transition-all duration-300 ${selectedModel === m.id ? 'bg-zinc-900 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-zinc-900/30 border-transparent hover:bg-zinc-900/50'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${m.color} shadow-lg transition-transform duration-300 overflow-hidden ${selectedModel === m.id ? 'scale-110' : ''}`}>
                <img src={m.icon} alt={m.name} className="w-full h-full object-cover" />
              </div>
              <span className={`text-[10px] font-semibold text-center leading-tight ${selectedModel === m.id ? 'text-white' : 'text-zinc-500'}`}>{m.name}</span>
              {selectedModel === m.id && <div className="absolute inset-0 rounded-xl ring-1 ring-white/20 pointer-events-none" />}
            </button>
          ))}
        </div>

        {/* 2. Mode Toggle */}
        <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
          <button
            onClick={() => { setGenerationMode('text'); impact('light') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${generationMode === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Type size={14} />
            <span>Text to Image</span>
          </button>
          <button
            onClick={() => { setGenerationMode('image'); impact('light') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${generationMode === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <ImageIcon size={14} />
            <span>Image to Image</span>
          </button>
        </div>

        {/* 3. Prompt Input (New Animation) */}
        <div className="prompt-container group">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Опишите вашу идею..."
            className="prompt-input min-h-[120px] bg-zinc-900/30 backdrop-blur-sm"
          />
          {prompt && (
            <button
              onClick={() => setPrompt('')}
              className="absolute top-3 right-3 p-1.5 bg-zinc-800/50 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors z-10"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 3.1 Negative Prompt (Qwen only) */}
        {selectedModel === 'qwen-edit' && (
          <div className="animate-in fade-in slide-in-from-top-4">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1 mb-1 block">Negative Prompt</label>
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value.slice(0, 500))}
              placeholder="Что исключить (без людей, размыто...)"
              className="w-full bg-zinc-900/30 border border-red-500/50 rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors min-h-[80px] resize-none"
            />
            <div className="text-[10px] text-zinc-600 text-right px-1">{negativePrompt.length}/500</div>
          </div>
        )}

        {/* 4. Reference Image (Multi-Image Support) */}
        {generationMode === 'image' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="border-2 border-dashed border-white/10 rounded-xl p-4 bg-zinc-900/20 relative overflow-hidden">
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

              {uploadedImages.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group">
                      <img src={img} alt={`uploaded-${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeUploadedImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {uploadedImages.length < maxImages && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border border-white/10 flex items-center justify-center text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      <ImageIcon size={20} />
                    </button>
                  )}
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer py-4 text-center hover:bg-zinc-900/40 transition-colors rounded-lg">
                  <div className="w-10 h-10 mx-auto bg-zinc-800 rounded-full flex items-center justify-center mb-2 text-zinc-400">
                    <ImageIcon size={20} />
                  </div>
                  <div className="text-sm font-medium text-zinc-300">Загрузить референс</div>
                  <div className="text-xs text-zinc-500 mt-1">До {maxImages} изображений</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Aspect Ratio Selector (Emojis) */}
        {(selectedModel !== 'qwen-edit' || generationMode === 'text') && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">Соотношение сторон</label>
            <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar -mx-2 px-2">
              {ratios.map(r => (
                <button
                  key={r}
                  onClick={() => { setAspectRatio(r); impact('light') }}
                  className={`flex-shrink-0 w-14 h-14 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all overflow-hidden ${aspectRatio === r ? 'bg-white text-black border-white shadow-lg shadow-white/10 scale-105' : 'bg-zinc-900/50 text-zinc-500 border-white/5 hover:bg-zinc-800'}`}
                >
                  <span className="text-lg leading-none">{RATIO_EMOJIS[r]}</span>
                  <span className={`leading-none ${aspectRatio === r ? 'opacity-100' : 'opacity-60'}`}>{r}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-3 text-rose-400 text-sm animate-in fade-in slide-in-from-bottom-2">
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {error}
          </div>
        )}

        {/* 6. Generate Button (Moved Up) */}
        <div className="">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || (generationMode === 'image' && uploadedImages.length === 0)}
            className={`w-full py-6 rounded-2xl font-bold text-base shadow-lg transition-all active:scale-[0.98] relative overflow-hidden group ${isGenerating ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-zinc-800' : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-violet-500/25 border border-white/10'}`}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <div className="relative flex items-center gap-2">
              {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              <span>{isGenerating ? 'Создание шедевра...' : generationMode === 'image' ? 'Редактировать' : 'Сгенерировать'}</span>
              {!isGenerating && <span className="bg-black/20 px-2 py-0.5 rounded text-xs font-normal ml-1">{MODEL_PRICES[selectedModel]} токена</span>}
            </div>
          </Button>
        </div>

      </div>
    </div>
  )
}
