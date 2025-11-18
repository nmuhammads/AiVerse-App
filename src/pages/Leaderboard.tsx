export default function Leaderboard() {
  const items = Array.from({ length: 12 }).map((_, i) => ({ rank: i+1, name: `Создатель ${i+1}`, badge: i===0?'Legend': i<3?'Pro':'Expert', uses: Math.floor(Math.random()*1000) }))
  return (
    <div className="min-h-screen bg-black safe-bottom-padding">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-3">
        {items.map(x => (
          <div key={x.rank} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 text-white">
            <div className="flex items-center gap-3">
              <div className="text-xl font-bold w-8">{x.rank}</div>
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">{x.rank===1?'👑':'🧑'}</div>
              <div>
                <div className="font-semibold">{x.name}</div>
                <div className={`text-xs ${x.badge==='Legend'? 'text-amber-400' : x.badge==='Pro' ? 'text-emerald-400' : 'text-indigo-400'}`}>{x.badge}</div>
              </div>
            </div>
            <div className="text-sm">{x.uses} промптов</div>
            <button className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20">Копировать</button>
          </div>
        ))}
      </div>
    </div>
  )
}
