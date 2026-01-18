import React from 'react'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHaptics } from '@/hooks/useHaptics'

interface SearchBarProps {
    query: string
    searchMode: 'posts' | 'users'
    onQueryChange: (q: string) => void
    onModeChange: (mode: 'posts' | 'users') => void
    onClose: () => void
}

export const SearchBar = React.memo(function SearchBar({
    query,
    searchMode,
    onQueryChange,
    onModeChange,
    onClose
}: SearchBarProps) {
    const { t } = useTranslation()
    const { impact } = useHaptics()

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 w-full">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        placeholder={searchMode === 'users' ? t('home.search.usersPlaceholder', { defaultValue: 'Поиск пользователей...' }) : t('home.searchPlaceholder')}
                        className="w-full bg-zinc-900 border border-violet-500/50 rounded-full py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all placeholder:text-zinc-600"
                    />
                </div>
                <button
                    onClick={() => { onClose(); impact('light') }}
                    className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white rounded-full hover:bg-white/5"
                >
                    <X size={20} />
                </button>
            </div>
            {/* Search mode switcher */}
            <div className="flex gap-2 px-1">
                <button
                    onClick={() => { onModeChange('posts'); impact('light') }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${searchMode === 'posts' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
                >
                    {t('home.search.posts', { defaultValue: 'Посты' })}
                </button>
                <button
                    onClick={() => { onModeChange('users'); impact('light') }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${searchMode === 'users' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
                >
                    {t('home.search.users', { defaultValue: 'Пользователи' })}
                </button>
            </div>
        </div>
    )
})
