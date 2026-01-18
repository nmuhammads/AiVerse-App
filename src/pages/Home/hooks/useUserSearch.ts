import { useState, useEffect } from 'react'

export interface UserSearchItem {
    user_id: number
    username?: string
    first_name?: string
    last_name?: string
    avatar_url?: string
}

interface UseUserSearchReturn {
    results: UserSearchItem[]
    isSearching: boolean
}

export function useUserSearch(query: string, enabled: boolean): UseUserSearchReturn {
    const [results, setResults] = useState<UserSearchItem[]>([])
    const [isSearching, setIsSearching] = useState(false)

    useEffect(() => {
        if (!enabled || query.trim().length < 2) {
            setResults([])
            return
        }

        setIsSearching(true)
        const timeoutId = setTimeout(async () => {
            try {
                const res = await fetch(`/api/user/search?q=${encodeURIComponent(query.trim())}`)
                if (res.ok) {
                    const data = await res.json()
                    setResults(data.items || [])
                }
            } catch (e) {
                console.error('[useUserSearch] Search failed', e)
            } finally {
                setIsSearching(false)
            }
        }, 300) // Debounce 300ms

        return () => clearTimeout(timeoutId)
    }, [query, enabled])

    return { results, isSearching }
}
