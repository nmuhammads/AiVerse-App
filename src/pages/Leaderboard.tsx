import { Crown, Heart, Repeat } from 'lucide-react'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTelegram } from '@/hooks/useTelegram'
import { useHaptics } from '@/hooks/useHaptics'
import { useNavigate } from 'react-router-dom'

interface LeaderboardUser {
  user_id: number
  first_name: string | null
  last_name?: string | null
  username: string | null
  avatar_url: string | null
  like_count?: number
  remix_count?: number
  rank: number
}

type TabType = 'likes' | 'remixes'
type PeriodType = 'month' | 'all_time'

export default function Leaderboard() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>('likes')
  const [period, setPeriod] = useState<PeriodType>('month')
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const observer = useRef<IntersectionObserver | null>(null)



  const monthName = new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date())
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)

  // Reset state when tab or period changes
  useEffect(() => {
    setUsers([])
    setPage(0)
    setHasMore(true)
    fetchUsers(0, activeTab, period)
  }, [activeTab, period])

  const fetchUsers = useCallback(async (pageNum: number, type: TabType, timePeriod: PeriodType) => {
    try {
      setLoading(true)
      const limit = 10
      const offset = pageNum * limit
      const res = await fetch(`/api/user/leaderboard?limit=${limit}&offset=${offset}&type=${type}&period=${timePeriod}`)
      const data = await res.json()

      if (data.items && Array.isArray(data.items)) {
        const newUsers = data.items.map((u: any, i: number) => ({
          ...u,
          rank: offset + i + 1
        }))

        setUsers(prev => {
          if (pageNum === 0) return newUsers
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
    // Initial fetch handled by dependency change
  }, [])

  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return
    if (observer.current) observer.current.disconnect()
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => {
          const nextPage = prev + 1
          fetchUsers(nextPage, activeTab, period)
          return nextPage
        })
      }
    })
    if (node) observer.current.observe(node)
  }, [loading, hasMore, fetchUsers, activeTab, period])

  const getBadge = (rank: number) => {
    if (rank === 1) return t('leaderboard.badges.legend')
    if (rank <= 3) return t('leaderboard.badges.pro')
    return t('leaderboard.badges.expert')
  }

  const getBadgeColor = (badge: string) => {
    if (badge === t('leaderboard.badges.legend')) return 'text-amber-400'
    if (badge === t('leaderboard.badges.pro')) return 'text-emerald-400'
    return 'text-indigo-400'
  }

  const { platform } = useTelegram()
  const { impact } = useHaptics()
  const navigate = useNavigate()
  const paddingTop = platform === 'ios' ? 'calc(env(safe-area-inset-top) + 50px)' : 'calc(env(safe-area-inset-top) + 50px)'

  return (
    <div className="min-h-dvh bg-black safe-bottom-tabbar" style={{ paddingTop }}>
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">
            {period === 'month' ? t('leaderboard.title.month', { month: capitalizedMonth }) : t('leaderboard.title.allTime')}
          </h1>
          <button
            onClick={() => setPeriod(prev => prev === 'month' ? 'all_time' : 'month')}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-white/10 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            {period === 'month' ? t('leaderboard.period.allTime') : t('leaderboard.period.month', { month: monthName })}
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5 mb-6">
          <button
            onClick={() => setActiveTab('likes')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'likes' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Heart size={14} className={activeTab === 'likes' ? 'fill-rose-500 text-rose-500' : ''} />
            <span>{t('leaderboard.tabs.likes')}</span>
          </button>
          <button
            onClick={() => setActiveTab('remixes')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'remixes' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Repeat size={14} className={activeTab === 'remixes' ? 'text-violet-500' : ''} />
            <span>{t('leaderboard.tabs.remixes')}</span>
          </button>
        </div>

        {users.map((user, index) => {
          const badge = getBadge(user.rank)
          const isLast = index === users.length - 1

          return (
            <div
              ref={isLast ? lastElementRef : null}
              key={user.user_id}
              onClick={() => {
                impact('light')
                navigate(`/profile/${user.user_id}`)
              }}
              className="relative bg-zinc-900/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4 backdrop-blur-sm active:scale-[0.98] transition-transform cursor-pointer"
            >
              {/* Rank */}
              <div className="w-8 flex flex-col items-center justify-center">
                {user.rank <= 3 ? (
                  <Crown size={24} className={user.rank === 1 ? 'text-amber-400 fill-amber-400' : user.rank === 2 ? 'text-zinc-300 fill-zinc-300' : 'text-amber-700 fill-amber-700'} />
                ) : (
                  <span className="text-lg font-bold text-zinc-500">#{user.rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div className="relative">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10">
                  <UserAvatar
                    user={{
                      username: user.username || user.first_name || 'User',
                      avatar_url: user.avatar_url
                    }}
                    className="w-full h-full"
                    size={24}
                  />
                </div>
                <div className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-[8px] font-bold uppercase ${getBadgeColor(badge)}`}>
                  {badge}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white truncate">
                  {user.first_name} {user.last_name}
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {user.username ? `@${user.username}` : ''}
                </div>
              </div>

              {/* Score */}
              <div className="flex flex-col items-end">
                <div className={`text-lg font-bold ${activeTab === 'likes' ? 'text-rose-500' : 'text-violet-500'}`}>
                  {activeTab === 'likes' ? (user.like_count || 0) : (user.remix_count || 0)}
                </div>
                <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                  {activeTab === 'likes' ? 'Likes' : 'Remixes'}
                </div>
              </div>
            </div>
          )
        })}

        {loading && (
          <div className="py-4 flex justify-center">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="py-10 text-center text-zinc-500 text-sm">
            {t('leaderboard.empty')}
          </div>
        )}
      </div>
    </div>
  )
}
