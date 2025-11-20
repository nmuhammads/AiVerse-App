import { Sparkles, Share2, Edit, History as HistoryIcon, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'

export default function Profile() {
  const { impact } = useHaptics()
  const { user } = useTelegram()
  const [avatarSrc, setAvatarSrc] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [items, setItems] = useState<{ id:number; image_url:string | null; prompt:string; created_at:string | null }[]>([])
  const [preview, setPreview] = useState<{ image_url: string; prompt: string } | null>(null)
  const [total, setTotal] = useState<number | undefined>(undefined)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const displayName = (user?.first_name && user?.last_name)
    ? `${user.first_name} ${user.last_name}`
    : (user?.first_name || user?.username || 'Гость')
  const username = user?.username ? `@${user.username}` : '—'
  const avatarSeed = user?.username || String(user?.id || 'guest')
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`

  useEffect(() => {
    const url = user?.id ? `/api/user/avatar/${user.id}` : avatarUrl
    setAvatarSrc(url)
    if (user?.id) {
      fetch(`/api/user/avatar/${user.id}`).then(r => { if (r.ok) setAvatarSrc(`/api/user/avatar/${user.id}`) })
      fetch(`/api/user/info/${user.id}`).then(async r => { const j = await r.json().catch(()=>null); if (r.ok && j && typeof j.balance==='number') setBalance(j.balance) })
      ;(async () => {
        setLoading(true)
        try {
          const r = await fetch(`/api/user/generations?user_id=${user.id}&limit=6&offset=0`)
          const j = await r.json().catch(()=>null)
          if (r.ok && j) { setItems(j.items || []); setTotal(j.total) }
        } finally { setLoading(false) }
      })()
    }
  }, [user?.id])

  const stats = [
    { label: 'Генерации', value: typeof total==='number' ? total : items.length },
    { label: 'Баланс', value: balance ?? '—' },
    { label: 'Лайки', value: 1200 },
  ]
  return (
    <div className="min-h-dvh bg-black safe-bottom-tabbar">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-6">
        <div className="bg-gradient-to-b from-zinc-900 to-black p-5 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-violet-500"><Sparkles size={140} /></div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 p-0.5 flex-shrink-0 shadow-lg">
              <div className="w-full h-full bg-black rounded-full overflow-hidden">
                <img src={avatarSrc || avatarUrl} alt={displayName} className="w-full h-full object-cover" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src = avatarUrl }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-2xl font-bold text-white">{displayName}</div>
                  <div className="text-xs text-zinc-400 mt-1 font-medium">{username} • <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 font-bold">PRO</span></div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f || !user?.id) return
                  const reader = new FileReader()
                  reader.onload = async (ev) => {
                    const base64 = String(ev.target?.result || '')
                    await fetch('/api/user/avatar/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, imageBase64: base64 }) })
                    setAvatarSrc(`/api/user/avatar/${user.id}?t=${Date.now()}`)
                    impact('medium')
                  }
                  reader.readAsDataURL(f)
                }} />
                <button onClick={() => fileRef.current?.click()} className="flex-1 bg-white text-black hover:bg-zinc-200 text-[10px] font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5"><Edit size={12} /> Сменить фото</button>
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
          </div>
          {items.length===0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800"><HistoryIcon size={32} className="mb-3 opacity-20" /><p className="text-sm font-medium">История пуста</p></div>
          ) : (
            <>
            <div>
              <div className="grid grid-cols-2 gap-3">
                {items.filter(h => !!h.image_url).map((h) => (
                  <div key={h.id} className="group relative rounded-2xl overflow-hidden border border-white/5 bg-zinc-900">
                  <button onClick={() => setPreview({ image_url: h.image_url || '', prompt: h.prompt })} className="block w-full">
                      <img src={h.image_url || ''} alt="History" className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105" />
                  </button>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-[10px] text-zinc-300 truncate font-medium">{h.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
              {items.length>0 && (
                <div className="mt-4 flex justify-center">
                  <button onClick={async () => { if (loading || !user?.id) return; setLoading(true); try { const r = await fetch(`/api/user/generations?user_id=${user.id}&limit=6&offset=${offset+6}`); const j = await r.json().catch(()=>null); if (r.ok && j) { setItems([...items, ...j.items]); setOffset(offset+6); setTotal(j.total) } } finally { setLoading(false); impact('light') } }} className="text-xs text-violet-400 bg-violet-500/5 border border-violet-500/10 hover:bg-violet-500/10 px-4 py-2 rounded-lg">Загрузить ещё</button>
                </div>
              )}
            </div>
            {preview && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={(e)=>{ if (e.target===e.currentTarget) setPreview(null) }}>
                <div className="relative w-full max-w-3xl bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden">
                  <button onClick={()=>setPreview(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"><X size={16} /></button>
                  <img src={preview.image_url} alt="Preview" className="w-full max-h-[70vh] object-contain bg-black" />
                  <div className="p-4 flex gap-3">
                    <button onClick={() => { const a=document.createElement('a'); a.href=preview.image_url; a.download=`ai-${Date.now()}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a) }} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 py-2 rounded-lg font-bold">Скачать</button>
                    <button onClick={async () => { if (!user?.id) return; await fetch('/api/telegram/sendPhoto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: user.id, photo_url: preview.image_url, caption: preview.prompt }) }) }} className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 py-2 rounded-lg font-bold">Отправить в чат</button>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
