import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, Loader2 } from 'lucide-react';
import { useTelegram } from '@/hooks/useTelegram';

interface Generation {
    id: number;
    image_url: string;
    compressed_url?: string | null;
    prompt: string;
    created_at: string;
    model: string;
    media_type?: 'image' | 'video';
}

interface GenerationSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (generationId: number) => void;
    allowedContentType?: 'image' | 'video' | 'both';
}

export function GenerationSelector({ isOpen, onClose, onSelect, allowedContentType = 'both' }: GenerationSelectorProps) {
    const { t } = useTranslation();
    const { user } = useTelegram();
    const [generations, setGenerations] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (isOpen && user?.id) {
            fetchGenerations();
        }
    }, [isOpen, user?.id]);

    const fetchGenerations = async () => {
        setLoading(true);
        try {
            // Fetch user's generations. Using the feed endpoint with user_id filter.
            // Assuming the feed endpoint supports user_id filtering as seen in feedController.ts
            const res = await fetch(`/api/feed?user_id=${user?.id}&limit=50&include_unpublished=true`);
            const data = await res.json();
            if (data.items) {
                setGenerations(data.items);
            }
        } catch (error) {
            console.error('Failed to fetch generations', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (selectedId) {
            onSelect(selectedId);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:p-0">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-[#1c1c1e] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-10 fade-in duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">{t('generationSelector.title')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-full py-12">
                            <Loader2 className="animate-spin text-indigo-500" size={32} />
                        </div>
                    ) : generations.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            {t('generationSelector.empty')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            {generations
                                .filter(gen => !failedImages.has(gen.id))
                                .filter(gen => {
                                    if (allowedContentType === 'both') return true;
                                    const genType = gen.media_type || 'image';
                                    return genType === allowedContentType;
                                })
                                .map((gen) => (
                                    <div
                                        key={gen.id}
                                        onClick={() => setSelectedId(gen.id)}
                                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedId === gen.id ? 'border-indigo-500 ring-2 ring-indigo-500/50' : 'border-transparent hover:border-white/20'}`}
                                    >
                                        <img
                                            src={gen.compressed_url || gen.image_url}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                // Try fallback to original
                                                if (target.src !== gen.image_url) {
                                                    target.src = gen.image_url;
                                                } else {
                                                    // Both failed, hide this generation
                                                    setFailedImages(prev => new Set([...prev, gen.id]));
                                                }
                                            }}
                                        />
                                        {selectedId === gen.id && (
                                            <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                                                <div className="bg-indigo-500 rounded-full p-1">
                                                    <Check size={16} className="text-white" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-[#1c1c1e]">
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedId}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all active:scale-[0.98]"
                    >
                        {t('generationSelector.select')}
                    </button>
                </div>
            </div>
        </div>
    );
}
