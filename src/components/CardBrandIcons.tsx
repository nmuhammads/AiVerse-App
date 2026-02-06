interface IconProps {
    size?: number
    className?: string
}

export function VisaIcon({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size * 0.6} viewBox="0 0 48 30" className={className} fill="none">
            <path d="M19.5 20.5h-3.3l2.1-12.8h3.3l-2.1 12.8zM15.1 7.7l-3.2 8.8-.4-1.8-.5-1.4s0 0 0 0l-1.2-5.7c-.2-.8-.8-1-1.6-1H4.1l-.1.3c1.2.3 2.5.8 3.3 1.3l2.8 10.9h3.4l5.2-12.8h-3.6v.4zM42.9 20.5h3l-2.6-12.8h-2.7c-.7 0-1.3.4-1.5 1l-4.9 11.8h3.4l.7-1.9h4.2l.4 1.9zm-3.6-4.5l1.7-4.8 1 4.8h-2.7zM33.8 10.4l.5-2.7c-.8-.3-2-.6-3.2-.6-3.1 0-5.3 1.6-5.3 4 0 1.7 1.6 2.7 2.8 3.3 1.2.6 1.6 1 1.6 1.5 0 .8-1 1.2-1.9 1.2-1.3 0-1.9-.2-2.9-.6l-.4-.2-.4 2.7c.7.3 2.1.6 3.5.6 3.3 0 5.4-1.6 5.5-4.1 0-1.4-.8-2.4-2.6-3.3-1.1-.6-1.8-.9-1.8-1.5 0-.5.6-1 1.8-1 1 0 1.8.2 2.4.5l.3.1.1.1z" fill="currentColor" />
        </svg>
    )
}

export function MastercardIcon({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size * 0.75} viewBox="0 0 32 24" className={className} fill="none">
            <circle cx="12" cy="12" r="8" fill="#EB001B" opacity="0.8" />
            <circle cx="20" cy="12" r="8" fill="#F79E1B" opacity="0.8" />
            <path d="M16 5.6a8 8 0 0 1 0 12.8 8 8 0 0 1 0-12.8z" fill="#FF5F00" opacity="0.9" />
        </svg>
    )
}

export function AmexIcon({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size * 0.75} viewBox="0 0 32 24" className={className} fill="none">
            <rect x="1" y="1" width="30" height="22" rx="3" fill="#2E77BC" opacity="0.8" />
            <text x="16" y="14" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white" fontFamily="sans-serif">AMEX</text>
        </svg>
    )
}

export function UnionPayIcon({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size * 0.75} viewBox="0 0 32 24" className={className} fill="none">
            <rect x="1" y="1" width="10" height="22" rx="2" fill="#E21836" opacity="0.8" />
            <rect x="11" y="1" width="10" height="22" rx="0" fill="#00447C" opacity="0.8" />
            <rect x="21" y="1" width="10" height="22" rx="2" fill="#007B84" opacity="0.8" />
            <text x="16" y="14" textAnchor="middle" fontSize="5" fontWeight="bold" fill="white" fontFamily="sans-serif">UP</text>
        </svg>
    )
}

export function MirIcon({ size = 24, className }: IconProps) {
    return (
        <svg width={size} height={size * 0.75} viewBox="0 0 32 24" className={className} fill="none">
            <rect x="1" y="1" width="30" height="22" rx="3" fill="#4DB45E" opacity="0.15" />
            <path d="M4 15V9h2l1.5 3.5L9 9h2v6h-1.5v-3.8L8 15H7l-1.5-3.8V15H4z" fill="#4DB45E" />
            <path d="M13 15V9h1.5v2.3h2.2V9H18v6h-1.5v-2.3h-2.2V15H13z" fill="#4DB45E" />
            <path d="M20 15V9h3c1.4 0 2.2.8 2.2 2s-.8 2-2.2 2h-1.5V15H20zm1.5-3.5h1.2c.5 0 .8-.3.8-.7s-.3-.7-.8-.7h-1.2v1.4z" fill="#4DB45E" />
            <path d="M4 7h6.5c.3 0 .5.2.6.5L12 10l.9-2.5c.1-.3.3-.5.6-.5H20" stroke="#4DB45E" strokeWidth="1.5" fill="none" opacity="0.5" />
        </svg>
    )
}
