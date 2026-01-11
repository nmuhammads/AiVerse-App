import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Calendar, Trophy, ChevronRight, ArrowLeft, Clock } from 'lucide-react';
import { useTelegram } from '@/hooks/useTelegram';
import { useHaptics } from '@/hooks/useHaptics';
import { Skeleton } from '@/components/ui/skeleton';

interface Contest {
    id: number;
    title: string;
    description: string;
    image_url: string;
    status: 'active' | 'completed' | 'upcoming';
    end_date: string;
    organizer_name: string;
}

interface EventSetting {
    event_key: string;
    enabled: boolean;
    title: string;
    description: string;
}

type TabType = 'contests' | 'events';
type ContestFilter = 'active' | 'completed' | 'upcoming';

export default function EventsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { impact } = useHaptics();
    const { platform, tg } = useTelegram();

    // Main tab state
    const [activeTab, setActiveTab] = useState<TabType>('contests');

    // Contests state
    const [contests, setContests] = useState<Contest[]>([]);
    const [contestsLoading, setContestsLoading] = useState(true);
    const [contestFilter, setContestFilter] = useState<ContestFilter>('active');

    // Events state
    const [allEvents, setAllEvents] = useState<EventSetting[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    useEffect(() => {
        if (platform === 'ios' || platform === 'android') {
            tg.BackButton.hide();
        }
    }, [platform, tg]);

    // Custom padding for different platforms
    const getPaddingTop = () => {
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 10px)';
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 20px)';
        return '20px';
    };

    // Fetch contests when tab or filter changes
    useEffect(() => {
        if (activeTab === 'contests') {
            fetchContests();
        }
    }, [activeTab, contestFilter]);

    // Fetch all events on mount (for badge display)
    useEffect(() => {
        fetchAllEvents();
    }, []);

    const fetchAllEvents = async () => {
        setEventsLoading(true);
        try {
            const res = await fetch('/api/events/all');
            const data = await res.json();
            if (data.items) {
                setAllEvents(data.items);
            }
        } catch (error) {
            console.error('Failed to fetch events', error);
        } finally {
            setEventsLoading(false);
        }
    };

    const fetchContests = async () => {
        setContestsLoading(true);
        try {
            const res = await fetch(`/api/contests?status=${contestFilter}`);
            const data = await res.json();
            if (data.items) {
                setContests(data.items);
            }
        } catch (error) {
            console.error('Failed to fetch contests', error);
        } finally {
            setContestsLoading(false);
        }
    };

    const handleContestClick = (id: number) => {
        impact('light');
        navigate(`/contests/${id}`);
    };

    const handleTabChange = (tab: TabType) => {
        impact('light');
        setActiveTab(tab);
    };

    // Find spin event and check if it's active
    const spinEvent = allEvents.find(e => e.event_key === 'spin');
    const isSpinActive = spinEvent?.enabled ?? false;

    // Count active events and contests for badges
    const activeEventsCount = allEvents.filter(e => e.enabled).length;
    const activeContestsCount = contests.filter(c => c.status === 'active').length;

    return (
        <div className="min-h-screen bg-black pb-24 px-4" style={{ paddingTop: getPaddingTop() }}>
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6">
                <h1 className="text-2xl font-bold text-white">{t('events.pageTitle')}</h1>

                {/* Main Tab Switcher */}
                <div className="flex p-1 bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-white/10">
                    <button
                        onClick={() => handleTabChange('contests')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 relative ${activeTab === 'contests'
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <Trophy size={16} />
                        {t('events.tabs.contests')}
                        {activeContestsCount > 0 && (
                            <span className="absolute -top-2 right-0 bg-violet-500 text-white text-xs font-bold min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center shadow-lg">
                                {activeContestsCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => handleTabChange('events')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 relative ${activeTab === 'events'
                            ? 'bg-zinc-800 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <Clock size={16} />
                        {t('events.tabs.events')}
                        {activeEventsCount > 0 && (
                            <span className="absolute -top-2 right-0 bg-fuchsia-500 text-white text-xs font-bold min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center shadow-lg">
                                {activeEventsCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Contests Tab Content */}
            {activeTab === 'contests' && (
                <>
                    {/* Propose Contest Button */}
                    <button
                        onClick={() => navigate('/contests/propose')}
                        className="w-full mb-4 py-3 bg-gradient-to-r from-indigo-600/20 to-violet-600/20 hover:from-indigo-600/30 hover:to-violet-600/30 border border-indigo-500/30 rounded-xl text-indigo-300 font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        <Trophy size={16} />
                        {t('events.proposeButton')}
                    </button>

                    {/* Contest Filter */}
                    <div className="flex p-1 bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-white/5 mb-4">
                        {[
                            { id: 'active', label: t('events.filters.active') },
                            { id: 'upcoming', label: t('events.filters.upcoming') },
                            { id: 'completed', label: t('events.filters.completed') }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setContestFilter(tab.id as ContestFilter)}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${contestFilter === tab.id
                                    ? 'bg-zinc-700/80 text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Contests List */}
                    {contestsLoading ? (
                        <div className="space-y-4">
                            {/* Contest Card Skeletons */}
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="relative bg-[#1c1c1e] rounded-2xl overflow-hidden border border-white/5">
                                    {/* Image skeleton */}
                                    <div className="h-40 w-full relative">
                                        <div
                                            className="absolute inset-0 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%]"
                                            style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1e] to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3">
                                            {/* Organizer skeleton */}
                                            <div className="h-3 w-24 bg-zinc-700/50 rounded mb-2" />
                                            {/* Title skeleton */}
                                            <div className="h-5 w-3/4 bg-zinc-700/50 rounded" />
                                        </div>
                                    </div>
                                    {/* Info skeleton */}
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-4 w-4 bg-zinc-700/50 rounded" />
                                            <div className="h-3 w-24 bg-zinc-700/50 rounded" />
                                        </div>
                                        <div className="h-4 w-4 bg-zinc-700/50 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : contests.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            {contestFilter === 'active' ? t('events.empty.active') :
                                contestFilter === 'upcoming' ? t('events.empty.upcoming') :
                                    t('events.empty.completed')}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {contests.map((contest) => (
                                <div
                                    key={contest.id}
                                    onClick={() => handleContestClick(contest.id)}
                                    className="group relative bg-[#1c1c1e] rounded-2xl overflow-hidden border border-white/5 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                    {/* Image */}
                                    <div className="h-40 w-full relative">
                                        <img
                                            src={contest.image_url || '/placeholder-contest.jpg'}
                                            alt={contest.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1e] to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                                            <div>
                                                <div className="text-xs text-indigo-400 font-medium mb-1 flex items-center gap-1">
                                                    <Trophy size={12} />
                                                    {contest.organizer_name}
                                                </div>
                                                <h3 className="text-lg font-bold text-white leading-tight">{contest.title}</h3>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4 text-xs text-zinc-400">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={14} />
                                                <span>
                                                    {contestFilter === 'active' ? t('events.contestStatus.until') :
                                                        contestFilter === 'upcoming' ? t('events.contestStatus.starts') :
                                                            t('events.contestStatus.ended')}
                                                    {new Date(contest.end_date).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Events Tab Content */}
            {activeTab === 'events' && (
                <div className="space-y-4">
                    {eventsLoading ? (
                        /* Loading skeleton */
                        <div className="relative overflow-hidden rounded-[2rem] bg-zinc-900 border border-white/5 p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-zinc-800 animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse" />
                                    <div className="h-3 w-56 bg-zinc-800 rounded animate-pulse" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Wheel of Fortune Card - always show, but disabled state if not active */}
                            {spinEvent && (
                                <div
                                    onClick={() => {
                                        if (isSpinActive) {
                                            impact('medium');
                                            navigate('/spin');
                                        }
                                    }}
                                    className={`relative group overflow-hidden rounded-[2rem] bg-zinc-900 border border-white/5 shadow-2xl transition-all ${isSpinActive
                                        ? 'cursor-pointer active:scale-[0.98]'
                                        : 'cursor-not-allowed opacity-50'
                                        }`}
                                >
                                    {/* Background Glow - only show when active */}
                                    {isSpinActive && (
                                        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-indigo-600/20 opacity-50 group-hover:opacity-100 transition-opacity" />
                                    )}

                                    <div className="relative p-6 flex items-center justify-between z-10">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${isSpinActive
                                                ? 'bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 shadow-purple-500/40'
                                                : 'bg-zinc-800'
                                                }`}>
                                                <div className="relative w-10 h-10" style={isSpinActive ? { animation: 'spin 6s linear infinite' } : {}}>
                                                    <svg viewBox="0 0 100 100" className="w-full h-full">
                                                        {/* Outer ring */}
                                                        <circle cx="50" cy="50" r="46" fill="none" stroke={isSpinActive ? "#fbbf24" : "#52525b"} strokeWidth="4" />

                                                        {/* Wheel segments - 6 colorful sections */}
                                                        <path d="M50 50 L50 6 A44 44 0 0 1 88 28 Z" fill={isSpinActive ? "#ec4899" : "#52525b"} />
                                                        <path d="M50 50 L88 28 A44 44 0 0 1 88 72 Z" fill={isSpinActive ? "#8b5cf6" : "#3f3f46"} />
                                                        <path d="M50 50 L88 72 A44 44 0 0 1 50 94 Z" fill={isSpinActive ? "#06b6d4" : "#52525b"} />
                                                        <path d="M50 50 L50 94 A44 44 0 0 1 12 72 Z" fill={isSpinActive ? "#f59e0b" : "#3f3f46"} />
                                                        <path d="M50 50 L12 72 A44 44 0 0 1 12 28 Z" fill={isSpinActive ? "#10b981" : "#52525b"} />
                                                        <path d="M50 50 L12 28 A44 44 0 0 1 50 6 Z" fill={isSpinActive ? "#6366f1" : "#3f3f46"} />

                                                        {/* Center circle with gradient */}
                                                        <circle cx="50" cy="50" r="16" fill={isSpinActive ? "#18181b" : "#27272a"} />
                                                        <circle cx="50" cy="50" r="12" fill={isSpinActive ? "#fbbf24" : "#52525b"} />
                                                        <circle cx="50" cy="50" r="6" fill={isSpinActive ? "#f59e0b" : "#3f3f46"} />

                                                        {/* Shine effect */}
                                                        {isSpinActive && (
                                                            <circle cx="44" cy="44" r="3" fill="white" opacity="0.6" />
                                                        )}
                                                    </svg>
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className={`text-lg font-bold mb-1 ${isSpinActive ? 'text-white' : 'text-zinc-400'}`}>
                                                    {t('events.spin.title')}
                                                </h3>
                                                <p className={`text-xs font-medium ${isSpinActive ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                                    {isSpinActive ? t('events.spin.description') : t('events.spin.unavailable')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSpinActive
                                            ? 'bg-white/5 text-zinc-400 group-hover:bg-white/10 group-hover:text-white'
                                            : 'bg-zinc-800 text-zinc-500'
                                            }`}>
                                            <ChevronRight size={20} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* No events at all */}
                            {allEvents.length === 0 && (
                                <div className="text-center py-12 text-zinc-500">
                                    {t('events.empty.events')}
                                </div>
                            )}

                            {/* Placeholder for more events */}
                            {allEvents.length > 0 && (
                                <div className="text-center py-8 text-zinc-500 text-sm">
                                    {t('events.comingSoon')}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

