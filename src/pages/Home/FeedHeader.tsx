import React from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHaptics } from '@/hooks/useHaptics'

interface FeedHeaderProps {
    sort: 'new' | 'popular'
    feedFilter: 'all' | 'following'
    onSortChange: (sort: 'new' | 'popular') => void
    onFeedFilterChange: (filter: 'all' | 'following') => void
    onSearchOpen: () => void
}

export const FeedHeader = React.memo(function FeedHeader({
    sort,
    feedFilter,
    onSortChange,
    onFeedFilterChange,
    onSearchOpen
}: FeedHeaderProps) {
    const { t } = useTranslation()
    const { impact } = useHaptics()

    return (
        <div className="flex items-center justify-between h-10">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => { onSortChange('new'); onFeedFilterChange('all'); impact('light') }}
                    className={`text-[17px] font-semibold transition-colors ${sort === 'new' && feedFilter === 'all' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    {t('home.tabs.new')}
                </button>
                <div className="w-[1px] h-4 bg-zinc-800"></div>
                <button
                    onClick={() => { onSortChange('popular'); onFeedFilterChange('all'); impact('light') }}
                    className={`text-[17px] font-semibold transition-colors ${sort === 'popular' && feedFilter === 'all' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    {t('home.tabs.popular')}
                </button>
                <div className="w-[1px] h-4 bg-zinc-800"></div>
                <button
                    onClick={() => { onFeedFilterChange('following'); impact('light') }}
                    className={`text-[17px] font-semibold transition-colors ${feedFilter === 'following' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    {t('home.tabs.following')}
                </button>
            </div>
            <button
                onClick={() => { onSearchOpen(); impact('light') }}
                className="flex items-center justify-center w-10 h-10 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-white/10 transition-all active:scale-95"
            >
                <Search size={18} />
            </button>
        </div>
    )
})
