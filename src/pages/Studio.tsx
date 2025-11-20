import { useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, CloudRain, Code2, Aperture } from 'lucide-react'
import { useGenerationStore, type ModelType, type AspectRatio } from '@/store/generationStore'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'

const MODELS: { id: ModelType; name: string; desc: string; color: string; icon: JSX.Element }[] = [
  { id: 'nanobanana', name: 'NanoBanana', desc: '3 токена', color: 'from-yellow-400 to-orange-500', icon: <Sparkles size={16} /> },
  { id: 'seedream4', name: 'Seedream 4', desc: '3 токена', color: 'from-purple-400 to-fuchsia-500', icon: <CloudRain size={16} /> },
  { id: 'qwen-edit', name: 'Qwen Edit', desc: '3 токена', color: 'from-emerald-400 to-teal-500', icon: <Code2 size={16} /> },
  { id: 'flux', name: 'Flux 1.1', desc: '4 токена', color: 'from-blue-400 to-indigo-500', icon: <Aperture size={16} /> },
]

const MODEL_PRICES: Record<ModelType, number> = {
  nanobanana: 3,
  seedream4: 3,
  'qwen-edit': 3,
  flux: 4,
}

const SUPPORTED_RATIOS: Record<ModelType, AspectRatio[]> = {
  flux: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', '16:21'],
  seedream4: ['16:9', '4:3', '1:1', '3:4', '9:16'],
  nanobanana: ['16:9', '4:3', '1:1', '3:4', '9:16'],
  'qwen-edit': ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
}

export default function Studio() {
  const {
    selectedModel,
    prompt,
    uploadedImage,
    aspectRatio,
    generationMode,
    generatedImage,
    isGenerating,
    error,
    currentScreen,
    setSelectedModel,
    setPrompt,
    setUploadedImage,
    setAspectRatio,
    setGenerationMode,
    setGeneratedImage,
    setIsGenerating,
    setError,
    setCurrentScreen,
  } = useGenerationStore()

  const { shareImage, user } = useTelegram()
  const { impact, notify } = useHaptics()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setUploadedImage(ev.target?.result as string)
    reader.readAsDataURL(file)
    impact('light')
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Введите промпт')
      notify('error')
      return
    }
    if (generationMode === 'image' && !uploadedImage) {
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
        body: JSON.stringify({ prompt, model: selectedModel, aspect_ratio: aspectRatio, image: generationMode==='image' ? uploadedImage : null, user_id: user?.id || null })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка генерации')
      setGeneratedImage(data.image)
      try {
        const item = { id: Date.now(), url: data.image, prompt, model: MODELS.find(m=>m.id===selectedModel)?.name, ratio: aspectRatio, date: new Date().toLocaleDateString() }
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
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Результат</CardTitle>
              <CardDescription className="text-white/60">{MODELS.find(m=>m.id===selectedModel)?.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <img src={generatedImage} alt="result" className="w-full rounded-lg shadow-lg" />
              <div className="flex gap-3">
                <Button onClick={() => {
                  const a=document.createElement('a'); a.href=generatedImage; a.download=`ai-${Date.now()}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a)
                }} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700">Скачать</Button>
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

  return (
    <div className="min-h-dvh bg-black safe-bottom-tabbar">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Студия</CardTitle>
            <CardDescription className="text-white/60">Создавайте изображения с ИИ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="px-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Промпт</label>
              </div>
              <div className="prompt-container">
                <div className="input-wrapper">
                  <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder="Опишите вашу идею..." className="prompt-input" />
                  {prompt && <button onClick={() => setPrompt('')} className="absolute top-3 right-3 p-1.5 bg-zinc-800/50 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">Очистить</button>}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">Тип генерации</label>
              <div className="flex gap-2">
                <button onClick={()=>{ setGenerationMode('text'); impact('light') }} className={`${generationMode==='text' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'} px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10`}>Текст → Изображение</button>
                <button onClick={()=>{ setGenerationMode('image'); impact('light') }} className={`${generationMode==='image' ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'} px-3 py-1.5 rounded-lg text-xs font-bold border border-white/10`}>Изображение → Изображение</button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">Модель</label>
              <div className="grid grid-cols-4 gap-1.5">
                {MODELS.map(m => (
                  <button key={m.id} onClick={()=>{ setSelectedModel(m.id); impact('light') }} className={`group relative p-2 rounded-lg border transition-all duration-300 flex flex-col items-center text-center gap-1 overflow-hidden ${selectedModel===m.id ? 'bg-zinc-900 border-transparent ring-1 ring-white/20 shadow-xl' : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60 hover:border-white/10'}`}>
                  {selectedModel===m.id && <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${m.color}`}></div>}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${selectedModel===m.id ? `bg-gradient-to-br ${m.color} text-white scale-105 shadow-lg` : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300'}`}>{m.icon}</div>
                    <div className="relative z-10">
                      <span className={`block font-semibold text-[10px] leading-tight ${selectedModel===m.id ? 'text-white' : 'text-zinc-400'}`}>{m.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {(selectedModel !== 'qwen-edit' || generationMode === 'text') && (
              <div className="space-y-2">
                <span className="text-white text-sm">Формат</span>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {ratios.map(r => (
                    <button key={r} onClick={()=>{ setAspectRatio(r); impact('light') }} className={`flex-shrink-0 w-16 h-12 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all ${aspectRatio===r ? 'bg-white text-black border-white shadow-lg shadow-white/10 scale-105' : 'bg-zinc-900 text-zinc-500 border-white/5 hover:bg-zinc-800 hover:border-white/10'}`}>
                      <span className={aspectRatio===r ? 'opacity-100' : 'opacity-60'}>{r}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedModel === 'qwen-edit' && generationMode === 'image' && (
              <div className="space-y-2">
                <span className="text-white text-sm">Изображение</span>
                <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  {uploadedImage ? (
                    <div className="space-y-3">
                      <img src={uploadedImage} alt="uploaded" className="max-w-full max-h-40 mx-auto rounded-lg" />
                      <Button onClick={()=> setUploadedImage(null)} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">Удалить</Button>
                    </div>
                  ) : (
                    <div onClick={()=> fileInputRef.current?.click()} className="cursor-pointer text-white/70">Нажмите чтобы загрузить</div>
                  )}
                </div>
              </div>
            )}

            {selectedModel !== 'qwen-edit' && generationMode === 'image' && (
              <div className="space-y-2">
                <span className="text-white text-sm">Изображение</span>
                <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  {uploadedImage ? (
                    <div className="space-y-3">
                      <img src={uploadedImage} alt="uploaded" className="max-w-full max-h-40 mx-auto rounded-lg" />
                      <Button onClick={()=> setUploadedImage(null)} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">Удалить</Button>
                    </div>
                  ) : (
                    <div onClick={()=> fileInputRef.current?.click()} className="cursor-pointer text-white/70">Нажмите чтобы загрузить</div>
                  )}
                </div>
              </div>
            )}

            {error && <div className="bg-rose-500/20 border border-rose-500/30 rounded-lg p-3 text-rose-200 text-sm">{error}</div>}

            <div className="relative z-10">
              <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim() || (generationMode==='image' && !uploadedImage)} className={`mt-2 w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 shadow-lg transition-all active:scale-[0.98] ${isGenerating ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-zinc-800' : 'bg-white text-black hover:bg-zinc-100'}`}>
                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="text-violet-600" />}
                <span>{isGenerating ? 'Создание...' : generationMode==='image' ? 'Редактировать' : 'Сгенерировать'}</span>
                {!isGenerating && <span className="text-zinc-500">• {MODEL_PRICES[selectedModel]} токена</span>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
