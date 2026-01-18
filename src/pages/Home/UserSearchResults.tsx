import React from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHaptics } from '@/hooks/useHaptics'
import type { UserSearchItem } from './hooks/useUserSearch'

interface UserSearchResultsProps {
    results: UserSearchItem[]
    isSearching: boolean
    query: string
    onUserClick: (userId: number) => void
}

export const UserSearchResults = React.memo(function UserSearchResults({
    results,
    isSearching,
    query,
    onUserClick
}: UserSearchResultsProps) {
    const { t } = useTranslation()
    const { impact } = useHaptics()

    if (isSearching) {
        return (
            <div className="text-center text-zinc-500 py-10">
                {t('home.search.searching', { defaultValue: 'Поиск...' })}
            </div>
        )
    }

    if (query.trim().length < 2) {
        return (
            <div className="text-center text-zinc-500 py-10 text-sm">
                Введите минимум 2 символа
            </div>
        )
    }

    if (results.length === 0) {
        return (
            <div className="text-center text-zinc-500 py-10">
                {t('home.search.noUsersFound', { defaultValue: 'Пользователи не найдены' })}
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {results.map((user) => (
                <button
                    key={user.user_id}
                    onClick={() => {
                        impact('medium')
                        onUserClick(user.user_id)
                    }}
                    className="w-full bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex items-center gap-4 transition-all active:scale-98"
                >
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-zinc-800 shrink-0">
                        <img
                            src={user.avatar_url}
                            alt={user.username || user.first_name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/9.x/avataaars/svg?seed=${user.user_id}` }}
                        />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="text-white font-semibold text-sm">
                            {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : (user.first_name || user.username || 'User')}
                        </div>
                        {user.username && (
                            <div className="text-zinc-500 text-xs mt-0.5">{user.username}</div>
                        )}
                    </div>
                    <div className="text-zinc-600">
                        <ChevronDown size={18} className="rotate-[-90deg]" />
                    </div>
                </button>
            ))}
        </div>
    )
})
