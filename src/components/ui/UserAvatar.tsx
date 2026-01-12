import { useState, useEffect } from 'react'


interface UserAvatarProps {
    user: {
        username: string
        avatar_url?: string | null
    }
    className?: string
    size?: number
}

export function UserAvatar({ user, className = "", size }: UserAvatarProps) {
    const [hasError, setHasError] = useState(false)
    const [imgSrc, setImgSrc] = useState<string | null>(null)

    useEffect(() => {
        setHasError(false)
        setImgSrc(user.avatar_url || null)
    }, [user.avatar_url])

    const handleError = () => {
        setHasError(true)
    }

    if (imgSrc && !hasError) {
        return (
            <img
                src={imgSrc}
                alt={user.username}
                className={`object-cover w-full h-full ${className}`}
                onError={handleError}
            />
        )
    }

    // Fallback: Initials with gradient background
    // Using a consistent gradient styling matching the app's aesthetic
    return (
        <div
            className={`flex items-center justify-center w-full h-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-bold select-none ${className}`}
            style={size ? { fontSize: `${size * 0.4}px` } : undefined}
        >
            {user.username ? (user.username[0] || '?').toUpperCase() : '?'}
        </div>
    )
}
