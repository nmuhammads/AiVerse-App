export default function Profile() {
  const stats = [
    { label: 'Генерации', value: 128 },
    { label: 'Подписчики', value: 42 },
    { label: 'Лайки', value: 932 },
  ]
  const history = Array.from({ length: 6 }).map((_, i) => ({ id: i+1, src: '/favicon.svg' }))
  return (
    <div className="min-h-screen bg-black safe-bottom-padding">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-6">
        <div className="rounded-lg p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-white/20" />
            <div>
              <div className="text-lg font-semibold">AI Verse User</div>
              <div className="text-sm">ID: 123456 • PRO</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-white/20">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs opacity-80">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {history.length===0 ? (
            <div className="col-span-2 rounded-lg border border-white/10 bg-white/5 p-6 text-center text-white">Пусто</div>
          ) : history.map(h => (
            <div key={h.id} className="rounded-lg overflow-hidden border border-white/10 bg-white/5">
              <img src={h.src} alt="history" className="w-full h-32 object-cover" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
