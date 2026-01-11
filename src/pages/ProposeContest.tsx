import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Check, Loader2, Calendar, PartyPopper } from 'lucide-react';
import { useTelegram } from '@/hooks/useTelegram';
import { useHaptics } from '@/hooks/useHaptics';

export default function ProposeContest() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, platform, tg } = useTelegram();
    const { impact, notify } = useHaptics();

    const isMobile = platform === 'ios' || platform === 'android';

    useEffect(() => {
        if (isMobile) {
            tg.BackButton.show();
            const handleBack = () => {
                impact('light');
                navigate(-1);
            };
            tg.BackButton.onClick(handleBack);
            return () => {
                tg.BackButton.hide();
                tg.BackButton.offClick(handleBack);
            };
        }
    }, [isMobile, navigate, tg]);

    const getPaddingTop = () => {
        if (platform === 'ios') return 'calc(env(safe-area-inset-top) + 20px)';
        if (platform === 'android') return 'calc(env(safe-area-inset-top) + 20px)';
        return '20px';
    };

    const headerStyle = {
        paddingTop: platform === 'ios' ? 'calc(env(safe-area-inset-top) + 24px)' : platform === 'android' ? '40px' : '10px'
    };

    const [form, setForm] = useState({
        title: '',
        description: '',
        rules: '',
        prize1: '',
        prize2: '',
        prize3: '',
        organizer_name: user?.username ? `@${user.username}` : '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        allowed_content_types: 'both' as 'image' | 'video' | 'both',
        banner_image: '' // base64
    });

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('File is too large (max 5MB)');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setForm(prev => ({ ...prev, banner_image: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const prizesData = {
            "1": form.prize1,
            "2": form.prize2,
            "3": form.prize3
        };

        try {
            const res = await fetch('/api/contests/propose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    prizes: prizesData,
                    user_id: user?.id
                })
            });

            const data = await res.json();

            if (data.success) {
                setSuccess(true);
                notify('success');
            } else {
                alert(t('events.proposeContest.error') + ': ' + (data.error || 'Unknown error'));
                notify('error');
            }
        } catch (error) {
            console.error('Propose error', error);
            alert(t('events.proposeContest.error'));
        } finally {
            setLoading(false);
        }
    };

    // ... inside render ...

    <div>
        <label className="text-xs uppercase text-zinc-500 font-bold tracking-wider mb-1 block">{t('events.proposeContest.form.prizes')}</label>
        <div className="grid grid-cols-3 gap-2">
            <div className="relative">
                <span className="absolute left-3 top-3.5 text-yellow-500 font-bold text-xs">1</span>
                <input
                    type="text"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-2 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                    value={form.prize1}
                    onChange={e => setForm({ ...form, prize1: e.target.value })}
                    placeholder={t('events.proposeContest.prize1')}
                />
            </div>
            <div className="relative">
                <span className="absolute left-3 top-3.5 text-zinc-400 font-bold text-xs">2</span>
                <input
                    type="text"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-2 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                    value={form.prize2}
                    onChange={e => setForm({ ...form, prize2: e.target.value })}
                    placeholder={t('events.proposeContest.prize2')}
                />
            </div>
            <div className="relative">
                <span className="absolute left-3 top-3.5 text-amber-700 font-bold text-xs">3</span>
                <input
                    type="text"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-2 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                    value={form.prize3}
                    onChange={e => setForm({ ...form, prize3: e.target.value })}
                    placeholder={t('events.proposeContest.prize3')}
                />
            </div>
        </div>
    </div>

    if (success) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                    <Check className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{t('events.proposeContest.success.title')}</h2>
                <p className="text-zinc-400 mb-8">{t('events.proposeContest.success.message')}</p>
                <button
                    onClick={() => navigate('/events')}
                    className="w-full py-4 bg-zinc-800 rounded-xl text-white font-medium hover:bg-zinc-700 transition"
                >
                    OK
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black pb-32 px-4" style={{ paddingTop: getPaddingTop() }}>
            <header
                className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md z-50 px-4 border-b border-white/5 flex items-center gap-3"
                style={headerStyle}
            >
                <div className="w-full flex items-center gap-3 py-3">
                    {!isMobile && (
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white">
                            <ArrowLeft size={24} />
                        </button>
                    )}
                    <h1 className={`text-lg font-bold text-white ${isMobile ? 'ml-1' : ''}`}>{t('events.proposeContest.title')}</h1>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto pt-14">
                {/* Banner Upload */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">{t('events.proposeContest.form.banner')}</label>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="relative aspect-video rounded-xl border-2 border-dashed border-zinc-700 hover:border-zinc-500 transition cursor-pointer overflow-hidden flex flex-col items-center justify-center bg-zinc-900"
                    >
                        {form.banner_image ? (
                            <img src={form.banner_image} className="w-full h-full object-cover" alt="Banner preview" />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-zinc-500">
                                <Upload size={32} />
                                <span className="text-xs">{t('events.proposeContest.form.bannerHint')}</span>
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImageUpload}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs uppercase text-zinc-500 font-bold tracking-wider mb-1 block">{t('events.proposeContest.form.title')}</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="text-xs uppercase text-zinc-500 font-bold tracking-wider mb-1 block">{t('events.proposeContest.form.description')}</label>
                        <textarea
                            required
                            rows={4}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition resize-none"
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="text-xs uppercase text-zinc-500 font-bold tracking-wider mb-1 block">{t('events.proposeContest.form.startDate')}</label>
                            <input
                                type="date"
                                required
                                className="w-full max-w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                                value={form.start_date}
                                onChange={e => setForm({ ...form, start_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs uppercase text-zinc-500 font-bold tracking-wider mb-1 block">{t('events.proposeContest.form.endDate')}</label>
                            <input
                                type="date"
                                required
                                className="w-full max-w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                                value={form.end_date}
                                onChange={e => setForm({ ...form, end_date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs uppercase text-zinc-500 font-bold tracking-wider mb-1 block">{t('events.proposeContest.form.contentType')}</label>
                        <div className="flex bg-zinc-900 p-1 rounded-xl border border-white/10">
                            {(['image', 'video', 'both'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setForm({ ...form, allowed_content_types: type })}
                                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${form.allowed_content_types === type ? 'bg-indigo-600 text-white shadow' : 'text-zinc-500'}`}
                                >
                                    {t(`contestDetail.allowedContent.${type}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs uppercase text-zinc-500 font-bold tracking-wider mb-1 block">{t('events.proposeContest.form.prizes')}</label>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-yellow-500 font-bold text-xs">1</span>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-2 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                                    value={form.prize1}
                                    onChange={e => setForm({ ...form, prize1: e.target.value })}
                                    placeholder={t('events.proposeContest.form.prize1')}
                                />
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-zinc-400 font-bold text-xs">2</span>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-2 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                                    value={form.prize2}
                                    onChange={e => setForm({ ...form, prize2: e.target.value })}
                                    placeholder={t('events.proposeContest.form.prize2')}
                                />
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-amber-700 font-bold text-xs">3</span>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-8 pr-2 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
                                    value={form.prize3}
                                    onChange={e => setForm({ ...form, prize3: e.target.value })}
                                    placeholder={t('events.proposeContest.form.prize3')}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs uppercase text-zinc-500 font-bold tracking-wider mb-1 block">{t('events.proposeContest.form.rules')}</label>
                        <textarea
                            rows={3}
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition resize-none"
                            value={form.rules}
                            onChange={e => setForm({ ...form, rules: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="text-xs uppercase text-zinc-500 font-bold tracking-wider mb-1 block">{t('events.proposeContest.form.organizer')}</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
                            value={form.organizer_name}
                            onChange={e => setForm({ ...form, organizer_name: e.target.value })}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl text-white font-bold text-lg shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin" />
                            {t('events.proposeContest.form.submitting')}
                        </>
                    ) : (
                        t('events.proposeContest.form.submit')
                    )}
                </button>
            </form>
        </div>
    );
}
