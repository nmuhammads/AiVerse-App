import React from 'react'
import { ChevronDown, LayoutGrid, Grid3x3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useHaptics } from '@/hooks/useHaptics'

interface FeedFiltersProps {
    viewMode: 'standard' | 'compact'
    modelFilter: string
    onViewModeChange: (mode: 'standard' | 'compact') => void
    onModelFilterChange: (model: string) => void
}

export const FeedFilters = React.memo(function FeedFilters({
    viewMode,
    modelFilter,
    onViewModeChange,
    onModelFilterChange
}: FeedFiltersProps) {
    const { t, i18n } = useTranslation()
    const { impact } = useHaptics()

    return (
        <div className="px-1 mb-2 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider truncate">
                    {t('home.feedTitle', { date: new Date().toLocaleString(i18n.language, { month: 'long' }) })}
                </h2>
            </div>

            <div className="flex items-center gap-3 shrink-0">
                {/* View Toggle */}
                <div className="bg-[#1c1c1e] p-0.5 rounded-lg flex gap-0.5 border border-white/5">
                    <button
                        onClick={() => { onViewModeChange('standard'); impact('light') }}
                        className={`p-1 rounded-md transition-all ${viewMode === 'standard' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <LayoutGrid size={14} />
                    </button>
                    <button
                        onClick={() => { onViewModeChange('compact'); impact('light') }}
                        className={`p-1 rounded-md transition-all ${viewMode === 'compact' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Grid3x3 size={14} />
                    </button>
                </div>

                <div className="relative">
                    <select
                        value={modelFilter}
                        onChange={(e) => { onModelFilterChange(e.target.value); impact('light') }}
                        className="appearance-none bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 rounded-lg py-1.5 pl-3 pr-8 focus:outline-none focus:border-violet-500/50 transition-colors"
                    >
                        <option value="all">{t('home.models.all')}</option>
                        <option value="nanobanana">NanoBanana</option>
                        <option value="nanobanana-pro">NanoBanana Pro</option>
                        <option value="seedream4">SeeDream 4</option>
                        <option value="seedream4-5">SeeDream 4.5</option>
                        <option value="seedance-1.5-pro">Seedance Pro</option>
                        <option value="gptimage1.5">GPT image 1.5</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                </div>
            </div>
        </div>
    )
})
