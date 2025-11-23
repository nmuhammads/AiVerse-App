import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTelegram } from '@/hooks/useTelegram'

export function Header() {
  const { user } = useTelegram()
  const [avatarSrc, setAvatarSrc] = useState<string>('')
  useEffect(() => { }, [])
  const displayName = (user?.first_name && user?.last_name)
    ? `${user.first_name} ${user.last_name}`
    : (user?.first_name || user?.username || 'Гость')
  const avatarSeed = user?.username || String(user?.id || 'guest')
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`
  useEffect(() => {
    const url = user?.id ? `/api/user/avatar/${user.id}` : avatarUrl
    setAvatarSrc(url)
    if (user?.id) {
      fetch(`/api/user/avatar/${user.id}`).then(r => { if (r.ok) setAvatarSrc(`/api/user/avatar/${user.id}`) })
    }
  }, [user?.id])
  return (
    <div className={'sticky top-0 z-50 backdrop-blur-xl bg-black/50 border-b border-white/10 safe-top'}>
      <div className="mx-auto max-w-3xl px-4 h-12 flex items-center justify-between relative">
        <div className="w-10" />
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <span className="text-white font-semibold">{displayName}</span>
          <Link to="/profile" className="h-8 w-8 rounded-full overflow-hidden ring-2 ring-violet-600 bg-white/10">
            <img src={avatarSrc || avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          </Link>
          <Link to="/settings" className="h-8 w-8 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"><Settings size={16} /></Link>
        </div>
        <div className="w-10" />
      </div>
    </div>
  )
}
