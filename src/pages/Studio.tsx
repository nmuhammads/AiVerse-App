import { useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useGenerationStore, type ModelType, type AspectRatio } from '@/store/generationStore'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'

const MODELS: { id: ModelType; name: string; desc: string }[] = [
  { id: 'flux', name: 'Flux', desc: 'Default' },
  { id: 'seedream4', name: 'Seedream 4', desc: 'Quality' },
  { id: 'nanobanana', name: 'Nanobanana', desc: 'Fast' },
  { id: 'qwen-edit', name: 'Qwen Edit', desc: 'Edit' },
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-white text-sm">Промпт</span>
                <button onClick={handleEnhance} className="text-white/80 hover:text-white">✨ Magic Enhance</button>
              </div>
              <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder="Опишите изображение" className="w-full h-24 p-3 rounded-lg bg-black/60 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-600" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {MODELS.map(m => (
                <button key={m.id} onClick={()=>{ setSelectedModel(m.id); impact('light') }}
                  className={`rounded-lg p-4 border ${selectedModel===m.id?'border-violet-500 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 shadow-indigo-500/20 shadow-lg':'border-white/10 bg-white/5'} text-left text-white`}
                >
                  <div className="text-sm font-semibold">{m.name}</div>
                  <div className="text-xs text-white/60">{m.desc}</div>
                </button>
              ))}
            </div>

            {selectedModel !== 'qwen-edit' && (
              <div className="space-y-2">
                <span className="text-white text-sm">Формат</span>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {ratios.map(r => (
                    <button key={r} onClick={()=>{ setAspectRatio(r); impact('light') }} className={`px-4 py-2 rounded-full text-sm ${aspectRatio===r?'bg-white text-black':'bg-white/10 text-white hover:bg-white/20'}`}>{r}</button>
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

            <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50">
              {isGenerating ? 'Создание...' : selectedModel==='qwen-edit' ? 'Редактировать' : 'Сгенерировать'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
