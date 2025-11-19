import React, { useState } from 'react'
import { Search, X, Heart, Eye } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'

const mockItems = Array.from({ length: 12 }).map((_, i) => ({ id: i+1, author: `Автор ${i+1}`, likes: Math.floor(Math.random()*100), src: `/favicon.svg` }))

export default function Home() {
  const { impact } = useHaptics()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const items = mockItems.filter(x => x.author.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="min-h-dvh bg-black safe-bottom-padding">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <div className="flex items-center justify-between mb-4 px-1 h-10">
          {!isSearchOpen ? (
            <>
              <h2 className="text-2xl font-bold text-white tracking-tight">Популярное</h2>
              <button onClick={() => { setIsSearchOpen(true); impact('light') }} className="flex items-center justify-center w-10 h-10 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-white/10 transition-all active:scale-95">
                <Search size={18} />
              </button>
            </>
          ) : (
            <div className="flex-1 flex items-center gap-2 w-full">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input autoFocus value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Найти промпт..." className="w-full bg-zinc-900 border border-violet-500/50 rounded-full py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all placeholder:text-zinc-600" />
              </div>
              <button onClick={() => { setIsSearchOpen(false); setQ(''); impact('light') }} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white rounded-full hover:bg-white/5">
                <X size={20} />
              </button>
            </div>
          )}
        </div>
        <div className="columns-2 gap-4">
          {items.map(item => (
            <div key={item.id} className="break-inside-avoid mb-4 rounded-lg overflow-hidden border border-white/10 bg-white/5">
              <img src={item.src} alt="item" className="w-full h-40 object-cover" loading="lazy" />
              <div className="p-3 text-white text-sm flex items-center justify-between">
                <span>{item.author}</span>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span className="flex items-center gap-1"><Heart size={12} className="text-rose-500" />{item.likes}</span>
                  <span className="flex items-center gap-1"><Eye size={12} />{Math.floor(item.likes*3)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
