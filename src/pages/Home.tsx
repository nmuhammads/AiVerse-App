import React, { useState } from 'react'

const mockItems = Array.from({ length: 12 }).map((_, i) => ({ id: i+1, author: `Автор ${i+1}`, likes: Math.floor(Math.random()*100), src: `/favicon.svg` }))

export default function Home() {
  const [q, setQ] = useState('')
  const items = mockItems.filter(x => x.author.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="min-h-screen bg-black safe-bottom-padding">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <div className="flex justify-center">
          <div className={`transition-all ${q? 'w-full' : 'w-12'} h-12 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center px-4`}> 
            <span className="text-white">🔍</span>
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск" className={`bg-transparent text-white outline-none ml-2 ${q? 'block' : 'hidden'}`} />
          </div>
        </div>
        <div className="columns-2 gap-4">
          {items.map(item => (
            <div key={item.id} className="break-inside-avoid mb-4 rounded-lg overflow-hidden border border-white/10 bg-white/5">
              <img src={item.src} alt="item" className="w-full h-40 object-cover" />
              <div className="p-3 text-white text-sm flex items-center justify-between">
                <span>{item.author}</span>
                <span>❤️ {item.likes}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
