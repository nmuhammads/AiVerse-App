import { Crown } from 'lucide-react'
import { useEffect, useState, useRef, useCallback } from 'react'

interface LeaderboardUser {
  user_id: number
  first_name: string | null
  username: string | null
  avatar_url: string | null
  like_count: number
  rank: number
}

export default function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const observer = useRef<IntersectionObserver | null>(null)

  const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(new Date())
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)

  const fetchUsers = useCallback(async (pageNum: number) => {
    try {
      setLoading(true)
      const limit = 10
      const offset = pageNum * limit
      const res = await fetch(`/api/user/leaderboard?limit=${limit}&offset=${offset}`)
      const data = await res.json()

      if (data.items && Array.isArray(data.items)) {
        const newUsers = data.items.map((u: any, i: number) => ({
          ...u,
          rank: offset + i + 1
        }))

        setUsers(prev => {
          // Avoid duplicates if strict mode or race conditions
          const existingIds = new Set(prev.map(p => p.user_id))
          const filtered = newUsers.filter((u: LeaderboardUser) => !existingIds.has(u.user_id))
          return [...prev, ...filtered]
        })

        if (newUsers.length < limit || (offset + newUsers.length) >= 50) {
          setHasMore(false)
        }
      } else {
        setHasMore(false)
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers(0)
  }, [fetchUsers])

  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return
    if (observer.current) observer.current.disconnect()
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => {
          const nextPage = prev + 1
          fetchUsers(nextPage)
          return nextPage
        })
      }
    })
    if (node) observer.current.observe(node)
  }, [loading, hasMore, fetchUsers])

  const getBadge = (rank: number) => {
    if (rank === 1) return 'Legend'
    if (rank <= 3) return 'Pro'
    return 'Expert'
  }

  const getBadgeColor = (badge: string) => {
    if (badge === 'Legend') return 'text-amber-400'
    if (badge === 'Pro') return 'text-emerald-400'
    return 'text-indigo-400'
  }

  return (
    <div className="min-h-dvh bg-black safe-bottom-tabbar">
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-3">
        <h1 className="text-2xl font-bold text-white mb-6">Топ за {capitalizedMonth}</h1>

        {users.map((user, index) => {
          const badge = getBadge(user.rank)
          const isLast = index === users.length - 1

          return (
            <div
              key={user.user_id}
              ref={isLast ? lastElementRef : undefined}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 text-white"
            >
              <div className="flex items-center gap-3">
                <div className="text-xl font-bold w-8">{user.rank}</div>
                <div className="relative">
                  <img
                    src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.user_id}`}
                    alt={user.first_name || user.username || 'User'}
                    className="w-10 h-10 rounded-full border-2 border-zinc-800 object-cover"
                  />
                  {user.rank === 1 && <Crown size={16} className="absolute -top-2 -right-1 text-yellow-400" />}
                </div>
                <div>
                  <div className="font-semibold">{user.first_name || user.username || `User ${user.user_id}`}</div>
                  <div className={`text-xs ${getBadgeColor(badge)}`}>{badge}</div>
                </div>
              </div>
              <div className="text-sm">{user.like_count} лайков</div>
            </div>
          )
        })}

        {loading && (
          <div className="text-center text-white/50 py-4">Загрузка...</div>
        )}

        {!loading && users.length === 0 && (
          <div className="text-center text-white/50 py-4">Пока нет данных</div>
        )}
      </div>
    </div>
  )
}
