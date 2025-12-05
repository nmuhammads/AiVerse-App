import { NavLink } from 'react-router-dom'
import { Home, Trophy, Settings2, User, Star } from 'lucide-react'
import WebApp from '@twa-dev/sdk'
import './TabBar.css'

const StarSVG = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
  </svg>
)

export function TabBar() {
  const isAndroid = WebApp.platform === 'android'

  return (
    <div className={`fixed left-0 right-0 z-50 ${isAndroid ? 'safe-bottom-fixed' : 'bottom-2 pb-[env(safe-area-inset-bottom)]'}`}>
      <div className="mx-auto w-[92%] max-w-[400px]">
        <div className="rounded-full border border-white/10 bg-white/5 backdrop-blur-xl p-1.5 flex justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
          {[
            { to: '/', label: 'Главная', icon: <Home size={20} /> },
            { to: '/contests', label: 'Конкурсы', icon: <Trophy size={20} /> },
            { to: '/studio', label: 'Студия', icon: <Settings2 size={20} /> },
            { to: '/top', label: 'Топ', icon: <Star size={20} /> },
            { to: '/profile', label: 'Профиль', icon: <User size={20} /> },
          ].map((tab) => {
            const isStudio = tab.to === '/studio'
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
                      : 'bg-white/10 text-white shadow-inner backdrop-blur-md scale-100 border border-white/5'
                    )
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }
                `}
              >
                {isStudio && (
                  <>
                    <StarSVG className="studio-star star-1" />
                    <StarSVG className="studio-star star-2" />
                    <StarSVG className="studio-star star-3" />
                    <StarSVG className="studio-star star-4" />
                    <StarSVG className="studio-star star-5" />
                    <StarSVG className="studio-star star-6" />
                  </>
                )}
                <div className="transition-transform z-10">{tab.icon}</div>
                <span className="text-[10px] font-bold tracking-wide z-10">{tab.label}</span>
              </NavLink>
            )
          })}
        </div>
      </div>
    </div>
  )
}
