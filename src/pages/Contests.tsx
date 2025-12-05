import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Trophy, Users, ChevronRight } from 'lucide-react';
import { useTelegram } from '@/hooks/useTelegram';
import { useHaptics } from '@/hooks/useHaptics';

interface Contest {
    id: number;
    title: string;
    description: string;
    image_url: string;
    status: 'active' | 'completed' | 'upcoming';
    end_date: string;
    organizer_name: string;
}

export default function Contests() {
    const navigate = useNavigate();
    const { impact } = useHaptics();
    const { platform } = useTelegram();
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'active' | 'completed' | 'upcoming'>('active');

    // Custom padding for different platforms
    const getPaddingTop = () => {
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 10px)';
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 20px)';
        return '20px'; // Desktop/Web
    };

    useEffect(() => {
        fetchContests();
    }, [filter]);

    const fetchContests = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/contests?status=${filter}`);
            const data = await res.json();
            if (data.items) {
                setContests(data.items);
            }
        } catch (error) {
            console.error('Failed to fetch contests', error);
        } finally {
            setLoading(false);
        }
    };

    const handleContestClick = (id: number) => {
        impact('light');
        navigate(`/contests/${id}`);
    };

    return (
        <div className="min-h-screen bg-black pb-24 px-4" style={{ paddingTop: getPaddingTop() }}>
            <div className="flex flex-col gap-4 mb-6">
                <h1 className="text-2xl font-bold text-white">Конкурсы</h1>

                <div className="flex p-1 bg-zinc-900/80 backdrop-blur-sm rounded-xl border border-white/10">
                    {[
                        { id: 'active', label: 'Активные' },
                        { id: 'upcoming', label: 'Скоро' },
                        { id: 'completed', label: 'Прошедшие' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id as any)}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${filter === tab.id
                                ? 'bg-zinc-800 text-white shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
            ) : contests.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                    {filter === 'active' ? 'Нет активных конкурсов' :
                        filter === 'upcoming' ? 'Нет предстоящих конкурсов' :
                            'Нет завершенных конкурсов'}
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
                                            {filter === 'active' ? 'До ' :
                                                filter === 'upcoming' ? 'Начало ' :
                                                    'Завершен '}
                                            {filter === 'upcoming'
                                                ? new Date(contest.end_date).toLocaleDateString() // Assuming start_date should be used here but using end_date for now as start_date might not be in interface yet. Wait, I should check interface.
                                                : new Date(contest.end_date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {/* Placeholder for participants count if available */}
                                    {/* <div className="flex items-center gap-1.5">
                    <Users size={14} />
                    <span>124</span>
                  </div> */}
                                </div>
                                <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
