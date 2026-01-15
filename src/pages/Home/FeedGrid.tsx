import React from 'react'
import { FeedImage, type FeedItem } from '@/components/FeedImage'
import { useTranslation } from 'react-i18next'

interface FeedGridProps {
    items: FeedItem[]
    viewMode: 'standard' | 'compact'
    onItemClick: (item: FeedItem) => void
    onRemix: (item: FeedItem) => void
}

export const FeedGrid = React.memo(function FeedGrid({
    items,
    viewMode,
    onItemClick,
    onRemix
}: FeedGridProps) {
    const { t } = useTranslation()
    const columns = viewMode === 'standard' ? 2 : 3

    if (items.length === 0) {
        return (
            <div className="text-center text-zinc-500 py-10 w-full">
                {t('home.empty')}
            </div>
        )
    }

    return (
        <div className={`flex items-start ${viewMode === 'standard' ? 'gap-4' : 'gap-2'}`}>
            {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className={`flex-1 min-w-0 ${viewMode === 'standard' ? 'space-y-4' : 'space-y-2'}`}>
                    {items.filter((_, i) => i % columns === colIndex).map(item => (
                        <FeedImage
                            key={item.id}
                            item={item}
                            priority={true}
                            handleRemix={onRemix}
                            onClick={onItemClick}
                            isCompact={viewMode === 'compact'}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
})
