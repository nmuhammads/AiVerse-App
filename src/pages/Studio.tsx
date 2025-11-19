import { useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, Wand2, CloudRain, Code2, Aperture } from 'lucide-react'
import { useGenerationStore, type ModelType, type AspectRatio } from '@/store/generationStore'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'

const MODELS: { id: ModelType; name: string; desc: string; color: string; icon: JSX.Element }[] = [
  { id: 'nanobanana', name: 'NanoBanana', desc: 'Топ 2025', color: 'from-yellow-400 to-orange-500', icon: <Sparkles size={20} /> },
  { id: 'seedream4', name: 'Seedream 4', desc: 'Сюрреализм', color: 'from-purple-400 to-fuchsia-500', icon: <CloudRain size={20} /> },
  { id: 'qwen-edit', name: 'Qwen Edit', desc: 'Точность', color: 'from-emerald-400 to-teal-500', icon: <Code2 size={20} /> },
  { id: 'flux', name: 'Flux 1.1', desc: 'Фотореализм', color: 'from-blue-400 to-indigo-500', icon: <Aperture size={20} /> },
]

const SUPPORTED_RATIOS: Record<ModelType, AspectRatio[]> = {
  flux: ['1:1', '16:9', '9:16'],
  seedream4: ['1:1', '16:9', '9:16'],
  nanobanana: ['1:1', '16:9', '9:16'],
  'qwen-edit': ['1:1'],
}

export default function Studio() {
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
    setCurrentScreen,
  } = useGenerationStore()

  const { showMainButton, hideMainButton, showProgress, hideProgress, shareImage } = useTelegram()
  const { impact, notify } = useHaptics()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentScreen === 'form') {
      const t = selectedModel === 'qwen-edit' ? 'Редактировать' : 'Сгенерировать'
      showMainButton(t, handleGenerate)
    } else {
      hideMainButton()
    }
    return () => hideMainButton()
  }, [currentScreen, selectedModel, prompt, uploadedImage])

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
    if (selectedModel === 'qwen-edit' && !uploadedImage) {
      setError('Загрузите изображение')
      notify('error')
      return
    }
    setIsGenerating(true)
    setError(null)
    showProgress(selectedModel === 'qwen-edit' ? 'Редактирование...' : 'Создание...')
    impact('heavy')
    try {
      const res = await fetch('/api/generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: selectedModel, aspect_ratio: aspectRatio, image: uploadedImage })
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
      hideProgress()
    }
  }

  const handleEnhance = async () => {
    if (!prompt.trim()) return
    impact('medium')
    try {
      const res = await fetch('/api/enhance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const data = await res.json()
      if (data.prompt) setPrompt(data.prompt)
    } catch { void 0 }
  }

  if (currentScreen === 'result' && generatedImage) {
    return (
      <div className="min-h-screen bg-black safe-bottom-padding">
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
    <div className="min-h-screen bg-black safe-bottom-padding">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Студия</CardTitle>
            <CardDescription className="text-white/60">Создавайте изображения с ИИ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-end px-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Промпт</label>
                <button onClick={handleEnhance} disabled={isGenerating} className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 hover:border-violet-500/40 transition-all">
                  {isGenerating ? <Loader2 size={12} className="animate-spin text-violet-400" /> : <Wand2 size={12} className="text-violet-400 group-hover:rotate-12 transition-transform" />}
                  <span className="text-[11px] font-bold text-violet-300 group-hover:text-violet-200">{prompt ? 'AI Улучшение' : 'Мне повезёт'}</span>
                </button>
              </div>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl opacity-20 blur"></div>
                <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder="Опишите вашу идею..." className="relative w-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:bg-zinc-900 transition-all min-h-[120px] resize-none shadow-inner" />
                {prompt && <button onClick={() => setPrompt('')} className="absolute top-3 right-3 p-1.5 bg-zinc-800/50 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors">Очистить</button>}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">Модель</label>
              <div className="grid grid-cols-2 gap-3">
                {MODELS.map(m => (
                  <button key={m.id} onClick={()=>{ setSelectedModel(m.id); impact('light') }} className={`group relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center gap-3 overflow-hidden ${selectedModel===m.id ? 'bg-zinc-900 border-transparent ring-1 ring-white/20 shadow-2xl' : 'bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60 hover:border-white/10'}`}>
                    {selectedModel===m.id && <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${m.color}`}></div>}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${selectedModel===m.id ? `bg-gradient-to-br ${m.color} text-white scale-110 shadow-lg` : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300'}`}>{m.icon}</div>
                    <div className="relative z-10">
                      <span className={`block font-bold text-sm ${selectedModel===m.id ? 'text-white' : 'text-zinc-400'}`}>{m.name}</span>
                      <span className="text-[10px] text-zinc-600">{m.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedModel !== 'qwen-edit' && (
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

            {selectedModel === 'qwen-edit' && (
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

            <div className="sticky bottom-28 pt-2 z-30">
              <div className={`absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl opacity-30 blur-md transition-opacity duration-500 ${isGenerating ? 'opacity-10' : 'opacity-40'}`}></div>
              <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className={`relative w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-3 shadow-lg transition-all active:scale-[0.98] ${isGenerating ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-zinc-800' : 'bg-white text-black hover:bg-zinc-100'}`}>
                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className="text-violet-600" />}
                <span>{isGenerating ? 'Создание...' : selectedModel==='qwen-edit' ? 'Редактировать' : 'Сгенерировать'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
