import { useEffect } from 'react'
import { Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Header() {
  useEffect(() => {}, [])
  return (
    <div className={'sticky top-0 z-50 backdrop-blur-xl bg-black/50 border-b border-white/10 safe-top'}> 
      <div className="mx-auto max-w-3xl px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 animate-spin-slow" />
          <span className="text-white font-semibold">AI Verse</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-8 w-8 rounded-md bg-white/5 hover:bg-white/10 text-white flex items-center justify-center"><Settings size={16} /></button>
          <Link to="/profile" className="h-8 w-8 rounded-full ring-2 ring-violet-600 bg-white/10" />
        </div>
      </div>
    </div>
  )
}
