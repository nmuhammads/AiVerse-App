import { NavLink } from 'react-router-dom'

export function TabBar() {
  return (
    <div className="fixed safe-bottom-fixed left-0 right-0 z-50">
      <div className="mx-auto max-w-3xl">
        <div className="mx-4 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl p-2 shadow-lg">
          <div className="grid grid-cols-4 gap-2">
            <NavLink to="/" end className={({ isActive }) => `flex items-center justify-center h-10 rounded-full ${isActive ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}>🏠</NavLink>
            <NavLink to="/top" className={({ isActive }) => `flex items-center justify-center h-10 rounded-full ${isActive ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}>⭐</NavLink>
            <NavLink to="/studio" className={({ isActive }) => `flex items-center justify-center h-10 rounded-full ${isActive ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}>🎛️</NavLink>
            <NavLink to="/profile" className={({ isActive }) => `flex items-center justify-center h-10 rounded-full ${isActive ? 'bg-white text-black' : 'text-white hover:bg-white/10'}`}>👤</NavLink>
          </div>
        </div>
      </div>
    </div>
  )
}
