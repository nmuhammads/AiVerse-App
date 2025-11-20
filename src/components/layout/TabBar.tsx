import { NavLink } from 'react-router-dom'
import { Home, Trophy, Settings2, User } from 'lucide-react'

export function TabBar() {
  return (
    <div className="fixed safe-bottom-fixed left-0 right-0 z-50">
      <div className="mx-auto w-[92%] max-w-[400px]">
        <div className="rounded-full border border-white/10 bg-white/5 backdrop-blur-xl p-1.5 flex justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
          {[
            { to: '/', label: 'Главная', icon: <Home size={20} /> },
            { to: '/top', label: 'Топ', icon: <Trophy size={20} /> },
            { to: '/studio', label: 'Студия', icon: <Settings2 size={20} /> },
            { to: '/profile', label: 'Профиль', icon: <User size={20} /> },
          ].map((tab) => (
            <NavLink key={tab.to} to={tab.to} end className={({ isActive }) => `flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-full transition-all duration-300 ${isActive ? 'bg-white/10 text-white shadow-inner backdrop-blur-md scale-100 border border-white/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
              <div className={`transition-transform`}>{tab.icon}</div>
              <span className="text-[10px] font-bold tracking-wide">{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
