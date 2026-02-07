import { NavLink } from 'react-router-dom'
import { Home, Trophy, Settings2, User, Star, Clock, MessageCircle } from 'lucide-react'
import './TabBar.css'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGenerationStore } from '@/store/generationStore'
import { resolvedPlatform, isInTelegramApp } from '@/utils/platform'

const StarSVG = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
  </svg>
)

export function TabBar() {
  const { t } = useTranslation()
  const isAndroid = resolvedPlatform === 'android'
  const isAndroidWeb = isAndroid && !isInTelegramApp
  const [eventCount, setEventCount] = useState(0)
  const { studioMode } = useGenerationStore()

  // Fetch active events and contests count
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Fetch active events
        const eventsRes = await fetch('/api/events/active')
        const eventsData = await eventsRes.json()
        const activeEventsCount = eventsData.items?.length || 0

        // Fetch active contests
        const contestsRes = await fetch('/api/contests?status=active')
        const contestsData = await contestsRes.json()
        const activeContestsCount = contestsData.items?.length || 0

        setEventCount(activeEventsCount + activeContestsCount)
      } catch (e) {
        console.error('Failed to fetch event counts', e)
      }
    }

    fetchCounts()
    // Refresh every 60 seconds
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`fixed left-0 right-0 z-50 ${isAndroidWeb ? 'safe-bottom-fixed' : 'bottom-2 pb-[env(safe-area-inset-bottom)]'}`}>
      <div className="mx-auto w-[92%] max-w-[400px]">
        <div className="rounded-full border border-white/10 bg-black/60 backdrop-blur-xl p-1.5 flex justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
          {[
            { to: '/home', label: t('nav.home'), icon: <Home size={20} />, badge: 0 },
            { to: '/events', label: t('nav.events'), icon: <Clock size={20} />, badge: eventCount },
            {
              to: '/',
              label: studioMode === 'chat' ? t('nav.chat', 'Chat') : t('nav.studio'),
              icon: studioMode === 'chat' ? <MessageCircle size={20} /> : <Settings2 size={20} />,
              badge: 0
            },
            { to: '/top', label: t('nav.top'), icon: <Star size={20} />, badge: 0 },
            { to: '/profile', label: t('nav.profile'), icon: <User size={20} />, badge: 0 },
          ].map((tab) => {
            const isStudio = tab.to === '/' || tab.to === '/studio'
            const isStudioActive = isStudio && studioMode !== 'chat'

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end
                className={({ isActive }) => `
                  relative flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-full transition-all duration-300
                  ${isActive
                    ? (isStudio
                      ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.4)] border border-white/20 overflow-visible studio-btn-active'
                      : 'bg-white/45 text-white shadow-sm backdrop-blur-md scale-105 border border-white/10'
                    )
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }
                `}
              >
                {isStudioActive && (
                  <>
                    <StarSVG className="studio-star star-1" />
                    <StarSVG className="studio-star star-2" />
                    <StarSVG className="studio-star star-3" />
                    <StarSVG className="studio-star star-4" />
                    <StarSVG className="studio-star star-5" />
                    <StarSVG className="studio-star star-6" />
                  </>
                )}
                <div className="transition-transform z-10 relative">
                  {tab.icon}
                  {tab.badge > 0 && (
                    <div className="absolute -top-2 -right-2.5 bg-red-500 text-white text-[11px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-lg">
                      {tab.badge}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-bold tracking-wide z-10">{tab.label}</span>
              </NavLink>
            )
          })}
        </div>
      </div>
    </div>
  )
}
