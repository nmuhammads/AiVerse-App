import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTelegram } from '@/hooks/useTelegram'
import { NotificationBell } from '@/components/NotificationBell'

export function Header() {
  const { user, platform } = useTelegram()
  const [avatarSrc, setAvatarSrc] = useState<string>('')
  useEffect(() => { }, [])
  const displayName = user?.first_name || user?.username || 'Гость'
  const avatarSeed = user?.username || String(user?.id || 'guest')
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`
  useEffect(() => {
    const url = user?.id ? `/api/user/avatar/${user.id}` : avatarUrl
    setAvatarSrc(url)
    if (user?.id) {
      fetch(`/api/user/avatar/${user.id}`).then(r => { if (r.ok) setAvatarSrc(`/api/user/avatar/${user.id}`) })
    }
  }, [user?.id])
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY < 10) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY) {
        setIsVisible(false) // Scrolling down
      } else {
        setIsVisible(true) // Scrolling up
      }
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const topOffset = platform === 'ios' ? '2px' : (platform === 'android' ? '32px' : '12px')

  return (
    <div className={`fixed left-0 right-0 z-50 transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-[200%]'}`} style={{ top: `calc(env(safe-area-inset-top) + ${topOffset})` }}>
      <div className="backdrop-blur-xl bg-black/50 border-b border-white/10 rounded-full mx-2">
        <div className="mx-auto max-w-3xl px-4 h-12 flex items-center justify-between relative">
          <div className="w-10" />
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <span className="text-white font-semibold">{displayName}</span>
            <Link to="/profile" className="h-8 w-8 rounded-full overflow-hidden ring-2 ring-violet-600 bg-white/10">
              <img src={avatarSrc || avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            </Link>
            <NotificationBell />
            <Link to="/settings" className="h-8 w-8 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"><Settings size={16} /></Link>
          </div>
          <div className="w-10" />
        </div>
      </div>
    </div>
  )
}
