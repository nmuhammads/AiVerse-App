import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Trophy, Calendar, Info, Grid, Medal, Loader2, Clock } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { useTelegram } from '@/hooks/useTelegram';
import { FeedImage, FeedItem } from '@/components/FeedImage';
import { FeedDetailModal } from '@/components/FeedDetailModal';
import { GenerationSelector } from '@/components/GenerationSelector';
import { toast } from 'sonner';

interface ContestDetail {
    id: number;
    title: string;
    description: string;
    rules: string;
    prizes: any;
    image_url: string;
    status: 'active' | 'completed' | 'upcoming';
    end_date: string;
    organizer_name: string;
    organizer_link: string;
}

interface ContestEntry {
    id: number;
    generation: {
        id: number;
        image_url: string;
        likes_count: number;
        remix_count: number;
        prompt: string;
        model: string;
        is_liked: boolean;
    };
    author: {
        username: string;
        avatar_url: string;
        first_name: string;
    };
    final_rank?: number;
    prize_awarded?: string;
    created_at: string;
}

export default function ContestDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { impact } = useHaptics();
    const { user, platform, tg, checkHomeScreenStatus, addToHomeScreen } = useTelegram();

    const [contest, setContest] = useState<ContestDetail | null>(null);
    const [entries, setEntries] = useState<ContestEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'info' | 'gallery' | 'leaderboard'>('info');
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [joining, setJoining] = useState(false);
    const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);

    const isMobile = platform === 'ios' || platform === 'android';

    const location = useLocation();

    useEffect(() => {
        if (isMobile) {
            tg.BackButton.show();
            const handleBack = () => {
                impact('light');
                if (location.state?.fromDeepLink) {
                    navigate('/', { replace: true });
                } else {
                    navigate(-1);
                }
            };
            tg.BackButton.onClick(handleBack);
            return () => {
                tg.BackButton.hide();
                tg.BackButton.offClick(handleBack);
            };
        }
    }, [isMobile, navigate, tg, location]);

    // Custom padding for different platforms (consistent with Settings.tsx)
    const getPaddingTop = () => {
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 10px)';
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 50px)';
        return '50px'; // Desktop/Web
    };

    useEffect(() => {
        if (id) {
            fetchContestDetails();
            fetchEntries();
        }
    }, [id, user?.id]);

    const fetchContestDetails = async () => {
        try {
            const res = await fetch(`/api/contests/${id}`);
            const data = await res.json();
            if (!data.error) {
                setContest(data);
            }
        } catch (error) {
            console.error('Failed to fetch contest details', error);
        }
    };

    const fetchEntries = async () => {
        try {
            let url = `/api/contests/${id}/entries?limit=100`;
            if (user?.id) {
                url += `&user_id=${user.id}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            if (data.items) {
                setEntries(data.items);
            }
        } catch (error) {
            console.error('Failed to fetch entries', error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (generationId: number) => {
        if (!user?.id || !id) return;
        setJoining(true);
        try {
            const res = await fetch(`/api/contests/${id}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, generationId })
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Работа добавлена в конкурс!');
                impact('medium');
                fetchEntries(); // Refresh entries
                setActiveTab('gallery');
            } else {
                toast.error(data.error || 'Ошибка при добавлении');
                impact('medium');
            }
        } catch (error) {
            toast.error('Ошибка сети');
        } finally {
            setJoining(false);
        }
    };

    const handleRemix = (item: FeedItem, contestEntryId?: number) => {
        impact('light');
        let url = `/studio?remix=${item.id}`;
        if (contestEntryId) {
            url += `&contest_entry=${contestEntryId}`;
        }
        navigate(url);
    };

    const handleImageClick = (item: FeedItem) => {
        setSelectedEntryId(item.id);
    };

    const handleLike = async (id: number, isLiked: boolean) => {
        if (!user?.id) return;
        // Optimistic update
        setEntries(prev => prev.map(e => {
            if (e.generation.id === id) {
                return {
                    ...e,
                    generation: {
                        ...e.generation,
                        is_liked: !isLiked,
                        likes_count: isLiked ? e.generation.likes_count - 1 : e.generation.likes_count + 1
                    }
                };
            }
            return e;
        }));

        try {
            const res = await fetch('/api/contests/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entryId: entries.find(e => e.generation.id === id)?.id, userId: user.id })
            });
            const data = await res.json();
            if (!data.success) {
                // Revert if failed
                setEntries(prev => prev.map(e => {
                    if (e.generation.id === id) {
                        return {
                            ...e,
                            generation: {
                                ...e.generation,
                                is_liked: isLiked,
                                likes_count: isLiked ? e.generation.likes_count + 1 : e.generation.likes_count - 1
                            }
                        };
                    }
                    return e;
                }));
                toast.error('Ошибка при лайке');
            }
        } catch (e) {
            // Revert
            setEntries(prev => prev.map(e => {
                if (e.generation.id === id) {
                    return {
                        ...e,
                        generation: {
                            ...e.generation,
                            is_liked: isLiked,
                            likes_count: isLiked ? e.generation.likes_count + 1 : e.generation.likes_count - 1
                        }
                    };
                }
                return e;
            }));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-white" />
            </div>
        );
    }

    const getButtonBottom = () => {
        if (platform === 'ios') return 'calc(6rem + env(safe-area-inset-bottom) + 10px)';
        if (platform === 'android') return 'calc(7rem + env(safe-area-inset-bottom) + 20px)';
        return '6rem';
    };

    if (!contest) return <div className="text-white text-center pt-20">Конкурс не найден</div>;

    return (
        <div className="min-h-dvh bg-black pb-24">
            {/* Header Image */}
            <div className="relative h-80 w-full">
                <img src={contest.image_url} alt={contest.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                {!isMobile && (
                    <button
                        onClick={() => navigate(-1)}
                        className="absolute top-4 left-4 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors z-10"
                        style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}

                <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${contest.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            contest.status === 'completed' ? 'bg-zinc-500/20 text-zinc-400' : 'bg-blue-500/20 text-blue-400'
                            }`}>
                            {contest.status === 'active' ? 'Активен' : contest.status === 'completed' ? 'Завершен' : 'Скоро'}
                        </span>
                        {contest.status === 'active' && (
                            <div className="flex items-center gap-1 text-xs text-zinc-300 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded">
                                <Clock size={12} />
                                <span>До {new Date(contest.end_date).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1">{contest.title}</h1>
                    <div className="text-sm text-zinc-300 flex items-center gap-1">
                        <Trophy size={14} className="text-yellow-500" />
                        <span>Организатор: {contest.organizer_name}</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 pt-[env(safe-area-inset-top)]">
                <div className="flex">
                    {[
                        { id: 'info', label: 'Инфо', icon: Info },
                        { id: 'gallery', label: 'Галерея', icon: Grid },
                        { id: 'leaderboard', label: 'Рейтинг', icon: Medal },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative ${activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {activeTab === 'info' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-[#1c1c1e] rounded-xl p-4 border border-white/5">
                            <h3 className="text-lg font-bold text-white mb-2">Описание</h3>
                            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{contest.description.replace(/\\n/g, '\n')}</p>
                        </div>

                        <div className="bg-[#1c1c1e] rounded-xl p-4 border border-white/5">
                            <h3 className="text-lg font-bold text-white mb-2">Правила</h3>
                            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{contest.rules.replace(/\\n/g, '\n')}</p>
                        </div>

                        <div className="bg-[#1c1c1e] rounded-xl p-4 border border-white/5">
                            <h3 className="text-lg font-bold text-white mb-2">Призы</h3>
                            <div className="space-y-2">
                                {contest.prizes && typeof contest.prizes === 'object' && Object.entries(contest.prizes).map(([place, prize]: [string, any]) => (
                                    <div key={place} className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                                        <span className="font-bold text-yellow-500">#{place} Место</span>
                                        <span className="text-white font-medium">{String(prize)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'gallery' && (
                    entries.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            Пока нет работ. Будьте первым!
                        </div>
                    ) : (
                        <div className="columns-2 gap-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {entries.map((entry) => (
                                <FeedImage
                                    key={entry.id}
                                    item={{
                                        id: entry.generation.id,
                                        image_url: entry.generation.image_url,
                                        prompt: entry.generation.prompt,
                                        created_at: entry.created_at,
                                        author: {
                                            id: 0, // Not needed for display mostly
                                            username: entry.author.username,
                                            avatar_url: entry.author.avatar_url,
                                            first_name: entry.author.first_name
                                        },
                                        likes_count: entry.generation.likes_count,
                                        remix_count: entry.generation.remix_count,
                                        is_liked: entry.generation.is_liked,
                                        model: entry.generation.model
                                    }}
                                    handleRemix={(item) => handleRemix(item, entry.id)}
                                    onClick={handleImageClick}
                                    onLike={handleLike}
                                />
                            ))}
                        </div>
                    )
                )}

                {activeTab === 'leaderboard' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {entries
                            .sort((a, b) => (b.generation.likes_count || 0) - (a.generation.likes_count || 0))
                            .map((entry, index) => (
                                <div
                                    key={entry.id}
                                    onClick={() => handleImageClick({
                                        id: entry.generation.id,
                                        image_url: entry.generation.image_url,
                                        prompt: entry.generation.prompt,
                                        created_at: entry.created_at,
                                        author: {
                                            id: 0,
                                            username: entry.author.username,
                                            avatar_url: entry.author.avatar_url,
                                            first_name: entry.author.first_name
                                        },
                                        likes_count: entry.generation.likes_count,
                                        remix_count: entry.generation.remix_count,
                                        is_liked: entry.generation.is_liked,
                                        model: entry.generation.model
                                    })}
                                    className="flex items-center gap-3 bg-[#1c1c1e] p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors active:scale-[0.98]"
                                >
                                    <div className={`w-8 h-8 flex items-center justify-center font-bold rounded-full ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                        index === 1 ? 'bg-zinc-400/20 text-zinc-400' :
                                            index === 2 ? 'bg-amber-700/20 text-amber-700' :
                                                'bg-white/5 text-zinc-500'
                                        }`}>
                                        {index + 1}
                                    </div>

                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                                        <img src={entry.generation.image_url} className="w-full h-full object-cover" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-medium truncate">{entry.author.username}</div>
                                        <div className="text-xs text-zinc-500 flex items-center gap-2">
                                            <span className="flex items-center gap-1"><Trophy size={10} /> {entry.generation.likes_count} лайков</span>
                                        </div>
                                    </div>

                                    {contest.status === 'completed' && entry.prize_awarded && (
                                        <div className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded">
                                            {entry.prize_awarded}
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {/* Join Button */}
            {contest.status === 'active' && (
                <div
                    className="fixed left-0 right-0 px-4 flex justify-center z-30 pointer-events-none"
                    style={{ bottom: getButtonBottom() }}
                >
                    <button
                        onClick={() => setIsSelectorOpen(true)}
                        className="pointer-events-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-transform active:scale-95"
                    >
                        <Trophy size={18} />
                        Участвовать
                    </button>
                </div>
            )}

            <GenerationSelector
                isOpen={isSelectorOpen}
                onClose={() => setIsSelectorOpen(false)}
                onSelect={handleJoin}
            />

            {selectedEntryId && (() => {
                const entry = entries.find(e => e.generation.id === selectedEntryId);
                if (!entry) return null;

                const item: FeedItem = {
                    id: entry.generation.id,
                    image_url: entry.generation.image_url,
                    prompt: entry.generation.prompt,
                    created_at: entry.created_at,
                    author: {
                        id: 0,
                        username: entry.author.username,
                        avatar_url: entry.author.avatar_url,
                        first_name: entry.author.first_name
                    },
                    likes_count: entry.generation.likes_count,
                    remix_count: entry.generation.remix_count,
                    is_liked: entry.generation.is_liked,
                    model: entry.generation.model
                };

                return (
                    <FeedDetailModal
                        item={item}
                        onClose={() => setSelectedEntryId(null)}
                        onRemix={(item) => handleRemix(item, selectedEntryId)}
                        onLike={(item) => handleLike(item.id, item.is_liked)}
                    />
                );
            })()}
        </div>
    );
}
