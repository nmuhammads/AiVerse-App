import { Sparkles, Share2, Edit, History as HistoryIcon, X, Download as DownloadIcon, Send, Wallet, Settings as SettingsIcon, Globe, EyeOff, Maximize2 } from 'lucide-react'
import { PaymentModal } from '@/components/PaymentModal'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHaptics } from '@/hooks/useHaptics'
import { useTelegram } from '@/hooks/useTelegram'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'

function getModelDisplayName(model: string | null): string {
  if (!model) return ''
  switch (model) {
    case 'nanobanana': return 'NanoBanana'
    case 'nanobanana-pro': return 'NanoBanana Pro'
    case 'seedream4': return 'Seedream 4'
    case 'qwen-edit': return 'Qwen Edit'
    case 'flux': return 'Flux'
    default: return model
  }
}

export default function Profile() {
  const navigate = useNavigate()
  const { impact, notify } = useHaptics()
  const { user, platform, saveToGallery, shareImage } = useTelegram()
  const [avatarSrc, setAvatarSrc] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [likes, setLikes] = useState<number>(0)
  const [items, setItems] = useState<{ id: number; image_url: string | null; prompt: string; created_at: string | null; is_published: boolean; model?: string | null }[]>([])
  const [preview, setPreview] = useState<{ id: number; image_url: string; prompt: string; is_published: boolean; model?: string | null } | null>(null)
  const [total, setTotal] = useState<number | undefined>(undefined)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const displayName = (user?.first_name && user?.last_name)
    ? `${user.first_name} ${user.last_name}`
    : (user?.first_name || user?.username || 'Гость')
  const username = user?.username ? `@${user.username}` : '—'
  const avatarSeed = user?.username || String(user?.id || 'guest')
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`

  const prevBalanceRef = useRef<number | null>(null)

  const fetchBalance = () => {
    if (user?.id) {
      fetch(`/api/user/info/${user.id}`).then(async r => {
        const j = await r.json().catch(() => null);
        if (r.ok && j && typeof j.balance === 'number') {
          const newBalance = j.balance
          const prevBalance = prevBalanceRef.current

          if (prevBalance !== null && newBalance > prevBalance) {
            impact('heavy')
            notify('success')
            // Use Telegram's showAlert if available for native feel, fallback to alert
            const wa = (window as any).Telegram?.WebApp
            if (wa && wa.showAlert) {
              wa.showAlert('Успешное пополнение баланса. Спасибо за покупку!')
            } else {
              alert('Успешное пополнение баланса. Спасибо за покупку!')
            }
          }

          setBalance(newBalance)
          prevBalanceRef.current = newBalance
        }
        if (r.ok && j && typeof j.likes_count === 'number') {
          setLikes(j.likes_count)
        }
      })
    }
  }

  useEffect(() => {
    const url = user?.id ? `/api/user/avatar/${user.id}` : avatarUrl
    setAvatarSrc(url)
    if (user?.id) {
      fetch(`/api/user/avatar/${user.id}`).then(r => { if (r.ok) setAvatarSrc(`/api/user/avatar/${user.id}`) })
      fetchBalance()
        ; (async () => {
          setLoading(true)
          try {
            const r = await fetch(`/api/user/generations?user_id=${user.id}&limit=6&offset=0`)
            const j = await r.json().catch(() => null)
            if (r.ok && j) { setItems(j.items || []); setTotal(j.total) }
          } finally { setLoading(false) }
        })()
    }
  }, [user?.id])

  // Refresh balance when modal closes or window gains focus (user returns from payment)
  useEffect(() => {
    if (!isPaymentModalOpen) {
      fetchBalance()
    }
  }, [isPaymentModalOpen])

  useEffect(() => {
    const onFocus = () => fetchBalance()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') fetchBalance()
    })
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [user?.id])

  const [isFullScreen, setIsFullScreen] = useState(false)
  const [scale, setScale] = useState(1)

  // Reset scale when closing fullscreen
  useEffect(() => {
    if (!isFullScreen) setScale(1)
  }, [isFullScreen])

  const stats = [
    { label: 'Генерации', value: typeof total === 'number' ? total : items.length },
    { label: 'Баланс', value: balance ?? '—' },
    { label: 'Лайки', value: likes },
  ]
  return (
    <div className="min-h-dvh bg-black safe-bottom-tabbar">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-6">
        <div className="bg-gradient-to-b from-zinc-900 to-black p-5 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-violet-500"><Sparkles size={140} /></div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 p-0.5 flex-shrink-0 shadow-lg">
                <div className="w-full h-full bg-black rounded-full overflow-hidden">
                  <img src={avatarSrc || avatarUrl} alt={displayName} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = avatarUrl }} />
                </div>
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-white text-black rounded-full flex items-center justify-center shadow-lg hover:bg-zinc-200 transition-colors"
              >
                <Edit size={14} />
              </button>
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

                  // Optimistic update
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    const base64 = String(ev.target?.result || '')
                    setAvatarSrc(base64) // Show immediately

                    // Upload
                    fetch('/api/user/avatar/upload', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: user.id, imageBase64: base64 })
                    }).then(async (r) => {
                      if (r.ok) {
                        impact('medium')
                        notify('success')
                      } else {
                        notify('error')
                        // Revert if failed (optional, but good UX)
                      }
                    })
                  }
                  reader.readAsDataURL(f)
                }} />
                <button onClick={() => { impact('light'); setIsPaymentModalOpen(true) }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/20"><Wallet size={12} /> Пополнить баланс</button>
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
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800"><HistoryIcon size={32} className="mb-3 opacity-20" /><p className="text-sm font-medium">История пуста</p></div>
          ) : (
            <>
              <div>
                <div className="grid grid-cols-2 gap-3">
                  {items.filter(h => !!h.image_url).map((h) => (
                    <div key={h.id} className="group relative rounded-2xl overflow-hidden border border-white/5 bg-zinc-900">
                      <button onClick={() => setPreview({ id: h.id, image_url: h.image_url || '', prompt: h.prompt, is_published: h.is_published, model: h.model })} className="block w-full">
                        <img src={h.image_url || ''} alt="History" className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105" />
                      </button>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none"></div>
                      {h.model && (
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md border border-white/10 font-medium z-10 pointer-events-none">
                          {getModelDisplayName(h.model)}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-[10px] text-zinc-300 truncate font-medium">{h.prompt}</p>
                        {h.is_published && <div className="absolute top-2 right-2 bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-md backdrop-blur-sm border border-emerald-500/20">Public</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {items.length > 0 && (
                  <div className="mt-4 flex justify-center">
                    <button onClick={async () => { if (loading || !user?.id) return; setLoading(true); try { const r = await fetch(`/api/user/generations?user_id=${user.id}&limit=6&offset=${offset + 6}`); const j = await r.json().catch(() => null); if (r.ok && j) { setItems([...items, ...j.items]); setOffset(offset + 6); setTotal(j.total) } } finally { setLoading(false); impact('light') } }} className="text-xs text-violet-400 bg-violet-500/5 border border-violet-500/10 hover:bg-violet-500/10 px-4 py-2 rounded-lg">Загрузить ещё</button>
                  </div>
                )}
              </div>
              {preview && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) setPreview(null) }}>
                  <div className="relative w-full max-w-3xl bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden">
                    <div className="relative w-full aspect-square bg-black">
                      <div className={`absolute top-0 left-0 right-0 px-2 flex justify-between items-start z-20 pointer-events-none ${platform === 'android' ? 'pt-[calc(3.5rem+env(safe-area-inset-top))]' : 'pt-[calc(0.5rem+env(safe-area-inset-top))]'}`}>
                        <button
                          onClick={() => {
                            impact('light')
                            if (navigator.share) {
                              navigator.share({ title: 'AiVerse', text: preview.prompt, url: preview.image_url }).catch(() => { })
                            } else {
                              shareImage(preview.image_url, preview.prompt)
                            }
                          }}
                          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-md pointer-events-auto"
                        >
                          <Share2 size={20} />
                        </button>
                        <button
                          onClick={() => {
                            impact('light')
                            setIsFullScreen(true)
                          }}
                          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-md pointer-events-auto"
                        >
                          <Maximize2 size={20} />
                        </button>
                        <button
                          onClick={() => setPreview(null)}
                          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-md pointer-events-auto"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <img src={preview.image_url} alt="Preview" className="w-full h-full object-contain" />
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => { impact('light'); saveToGallery(preview.image_url, `ai-${Date.now()}.jpg`) }}
                          className="flex-1 min-h-[48px] h-auto py-3 rounded-xl bg-white text-black hover:bg-zinc-100 font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                        >
                          <DownloadIcon size={16} />
                          Сохранить в галерею
                        </button>
                        <button
                          onClick={async () => {
                            if (!user?.id) return
                            impact('light')
                            try {
                              const r = await fetch('/api/telegram/sendDocument', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: user.id, file_url: preview.image_url, caption: preview.prompt }) })
                              const j = await r.json().catch(() => null)
                              if (r.ok && j?.ok) { notify('success') }
                              else {
                                notify('error')
                                shareImage(preview.image_url, preview.prompt)
                              }
                            } catch {
                              notify('error')
                            }
                          }}
                          className="flex-1 min-h-[48px] h-auto py-3 rounded-xl bg-violet-600 text-white hover:bg-violet-700 font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                        >
                          <Send size={16} />
                          Отправить в чат с промптом
                        </button>
                      </div>

                      <button
                        onClick={async () => {
                          impact('medium')
                          const newStatus = !preview.is_published

                          // Optimistic update
                          setPreview(prev => prev ? { ...prev, is_published: newStatus } : null)
                          setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_published: newStatus } : i))

                          try {
                            const r = await fetch('/api/user/publish', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ generationId: preview.id, isPublished: newStatus })
                            })
                            if (r.ok) {
                              notify('success')
                            } else {
                              notify('error')
                              // Revert
                              setPreview(prev => prev ? { ...prev, is_published: !newStatus } : null)
                              setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_published: !newStatus } : i))
                            }
                          } catch {
                            notify('error')
                            // Revert
                            setPreview(prev => prev ? { ...prev, is_published: !newStatus } : null)
                            setItems(prev => prev.map(i => i.id === preview.id ? { ...i, is_published: !newStatus } : i))
                          }
                        }}
                        className={`w-full min-h-[48px] h-auto py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-colors ${preview.is_published ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                      >
                        {preview.is_published ? <EyeOff size={16} /> : <Globe size={16} />}
                        {preview.is_published ? 'Убрать из ленты' : 'Опубликовать в ленту'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {isFullScreen && preview && (
                <div className="fixed inset-0 z-[200] bg-black flex flex-col">
                  <div className={`absolute top-0 right-0 z-50 p-4 ${platform === 'android' ? 'pt-[calc(5rem+env(safe-area-inset-top))]' : 'pt-[calc(3rem+env(safe-area-inset-top))]'}`}>
                    <button
                      onClick={() => setIsFullScreen(false)}
                      className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    <TransformWrapper
                      initialScale={1}
                      minScale={1}
                      maxScale={4}
                      centerOnInit
                      alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
                    >
                      <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                          src={preview.image_url}
                          alt="Fullscreen"
                          className="max-w-full max-h-full object-contain"
                        />
                      </TransformComponent>
                    </TransformWrapper>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} />
    </div>
  )
}
