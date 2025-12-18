import React from 'react'

interface SkeletonProps {
    className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
    return (
        <div
            className={`animate-pulse bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] ${className}`}
            style={{
                animation: 'shimmer 1.5s ease-in-out infinite'
            }}
        />
    )
}

// Skeleton for feed image cards
export const FeedImageSkeleton: React.FC<{ isCompact?: boolean }> = ({ isCompact = false }) => {
    // Simulate different aspect ratios for visual variety
    const aspectRatios = ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-square', 'aspect-[4/3]']
    const randomAspect = aspectRatios[Math.floor(Math.random() * aspectRatios.length)]

    return (
        <div className="mb-4 break-inside-avoid">
            <div className="relative rounded-xl overflow-hidden bg-zinc-900 shadow-sm border border-white/5">
                {/* Image skeleton with shimmer effect */}
                <div className={`w-full relative ${isCompact ? 'aspect-square' : randomAspect}`}>
                    <div
                        className="absolute inset-0 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%]"
                        style={{
                            animation: 'shimmer 1.5s ease-in-out infinite'
                        }}
                    />
                    {/* Model badge skeleton */}
                    <div className="absolute top-2 left-2 w-16 h-5 rounded-md bg-zinc-700/50" />
                </div>

                {/* Footer skeleton */}
                <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                        {/* Avatar skeleton */}
                        <div className="w-6 h-6 rounded-full bg-zinc-700" />

                        {/* Action buttons skeleton */}
                        <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2'}`}>
                            <div className={`${isCompact ? 'w-10 h-5' : 'w-12 h-6'} rounded-full bg-zinc-800`} />
                            <div className={`${isCompact ? 'w-10 h-5' : 'w-12 h-6'} rounded-full bg-zinc-800`} />
                        </div>
                    </div>

                    {/* Username skeleton */}
                    <div className="h-3 w-20 bg-zinc-700 rounded" />
                </div>
            </div>
        </div>
    )
}

// Grid of skeleton items for loading state
export const FeedSkeletonGrid: React.FC<{ viewMode: 'standard' | 'compact' }> = ({ viewMode }) => {
    const columns = viewMode === 'standard' ? 2 : 3
    const itemsPerColumn = viewMode === 'standard' ? 3 : 3

    return (
        <div className={`flex items-start ${viewMode === 'standard' ? 'gap-4' : 'gap-2'}`}>
            {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className={`flex-1 min-w-0 ${viewMode === 'standard' ? 'space-y-4' : 'space-y-2'}`}>
                    {Array.from({ length: itemsPerColumn }).map((_, itemIndex) => (
                        <FeedImageSkeleton key={itemIndex} isCompact={viewMode === 'compact'} />
                    ))}
                </div>
            ))}
        </div>
    )
}

// Skeleton for profile grid (always 1:1 aspect ratio)
export const ProfileImageSkeleton: React.FC = () => {
    return (
        <div className="group relative rounded-2xl overflow-hidden border border-white/5 bg-zinc-900">
            <div className="w-full aspect-square relative">
                <div
                    className="absolute inset-0 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%]"
                    style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
                />
                {/* Model badge skeleton */}
                <div className="absolute top-2 left-2 w-16 h-5 rounded-md bg-zinc-700/50" />
            </div>
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 pointer-events-none" />
            {/* Prompt skeleton */}
            <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="h-3 w-3/4 bg-zinc-700/50 rounded" />
            </div>
        </div>
    )
}

// Grid of skeleton items for profile page (2 columns, 1:1 ratio)
export const ProfileSkeletonGrid: React.FC<{ count?: number }> = ({ count = 6 }) => {
    return (
        <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: count }).map((_, index) => (
                <ProfileImageSkeleton key={index} />
            ))}
        </div>
    )
}
