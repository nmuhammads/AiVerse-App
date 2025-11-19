import { Sparkles, Share2, Edit, History as HistoryIcon, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useHaptics } from '@/hooks/useHaptics'

export default function Profile() {
  const { impact } = useHaptics()
  const [history, setHistory] = useState<{ id:number; url:string; prompt:string; model:string; ratio:string; date:string }[]>([])
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('img_gen_history_v2') || '[]')
      setHistory(saved)
    } catch { /* noop */ }
  }, [])
  const stats = [
    { label: 'Генерации', value: history.length },
    { label: 'Подписчики', value: 842 },
    { label: 'Лайки', value: 1200 },
  ]
  return (
    <div className="min-h-screen bg-black safe-bottom-padding">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-6">
        <div className="bg-gradient-to-b from-zinc-900 to-black p-5 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-violet-500"><Sparkles size={140} /></div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 p-0.5 flex-shrink-0 shadow-lg">
              <div className="w-full h-full bg-black rounded-full overflow-hidden">
                <img src="https://api.dicebear.com/9.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-2xl font-bold text-white">Felix AI</div>
                  <div className="text-xs text-zinc-400 mt-1 font-medium">@felix_creator • <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 font-bold">PRO</span></div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="flex-1 bg-white text-black hover:bg-zinc-200 text-[10px] font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5"><Edit size={12} /> Редактировать</button>
                <button className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-white/5"><Share2 size={12} /> Поделиться</button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-8 border-t border-white/5 pt-5 relative z-10">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-lg font-bold text-white">{s.value}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex justify-between items-end mb-4 px-1">
            <div className="text-lg font-bold text-white">Мои генерации</div>
            {history.length>0 && (
              <button onClick={() => { if (confirm('Очистить историю?')) { localStorage.removeItem('img_gen_history_v2'); setHistory([]); impact('medium') } }} className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg">Очистить</button>
            )}
          </div>
          {history.length===0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800"><HistoryIcon size={32} className="mb-3 opacity-20" /><p className="text-sm font-medium">История пуста</p></div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {history.map((h) => (
                <div key={h.id} className="group relative rounded-2xl overflow-hidden border border-white/5 bg-zinc-900">
                  <img src={h.url} alt="History" className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-[10px] text-zinc-300 truncate font-medium">{h.prompt}</p>
                  </div>
                  <button className="absolute top-2 right-2 w-7 h-7 bg-black/40 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100" onClick={() => { const a=document.createElement('a'); a.href=h.url; a.download=`ai-${Date.now()}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a) }}><Download size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
