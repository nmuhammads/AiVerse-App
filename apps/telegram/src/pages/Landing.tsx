/**
 * Landing Page
 * Public page for guests explaining what AiVerse is
 * Required for Google OAuth verification
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, Video, MessageSquare, Trophy, ArrowRight, Globe } from 'lucide-react'

const LANGUAGES = [
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'en', label: 'English', flag: '🇺🇸' }
]

export default function Landing() {
    const { t, i18n } = useTranslation()

    const toggleLanguage = () => {
        const newLang = i18n.language === 'ru' ? 'en' : 'ru'
        i18n.changeLanguage(newLang)
    }

    const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]

    const features = [
        {
            icon: <Sparkles className="w-8 h-8" />,
            titleKey: 'landing.features.images.title',
            descKey: 'landing.features.images.desc',
            gradient: 'from-violet-500 to-fuchsia-500'
        },
        {
            icon: <Video className="w-8 h-8" />,
            titleKey: 'landing.features.videos.title',
            descKey: 'landing.features.videos.desc',
            gradient: 'from-cyan-500 to-blue-500'
        },
        {
            icon: <MessageSquare className="w-8 h-8" />,
            titleKey: 'landing.features.chat.title',
            descKey: 'landing.features.chat.desc',
            gradient: 'from-amber-500 to-orange-500'
        },
        {
            icon: <Trophy className="w-8 h-8" />,
            titleKey: 'landing.features.community.title',
            descKey: 'landing.features.community.desc',
            gradient: 'from-emerald-500 to-teal-500'
        }
    ]

    return (
        <div className="min-h-screen bg-black text-white overflow-x-hidden">
            {/* Background gradient */}
            <div className="fixed inset-0 bg-gradient-to-br from-violet-950/30 via-black to-fuchsia-950/20 pointer-events-none" />

            {/* Animated gradient orbs */}
            <div className="fixed top-1/4 -left-32 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl animate-pulse pointer-events-none" />
            <div className="fixed bottom-1/4 -right-32 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: '1s' }} />

            {/* Content */}
            <div className="relative z-10">
                {/* Header */}
                <header className="px-6 py-6">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
                                AiVerse
                            </h1>
                            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-pulse" />
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={toggleLanguage}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors text-sm"
                            >
                                <Globe className="w-4 h-4" />
                                <span>{currentLang.flag} {currentLang.code.toUpperCase()}</span>
                            </button>
                            <Link
                                to="/login"
                                className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors text-sm font-medium"
                            >
                                {t('landing.signIn')}
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Hero Section */}
                <section className="px-6 pt-16 pb-24">
                    <div className="max-w-4xl mx-auto text-center">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 mb-8">
                            <Sparkles className="w-4 h-4 text-violet-400" />
                            <span className="text-sm text-violet-300">{t('landing.badge')}</span>
                        </div>

                        {/* Headline */}
                        <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight mb-6">
                            <span className="bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
                                {t('landing.headline.part1')}
                            </span>
                            <br />
                            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
                                {t('landing.headline.part2')}
                            </span>
                        </h2>

                        {/* Subheadline */}
                        <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
                            {t('landing.subheadline')}
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                to="/login"
                                className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-lg hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-xl shadow-violet-500/25"
                            >
                                {t('landing.cta.getStarted')}
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link
                                to="/studio"
                                className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-medium text-lg hover:bg-white/10 transition-colors"
                            >
                                {t('landing.cta.tryDemo')}
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="px-6 py-20 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
                    <div className="max-w-6xl mx-auto">
                        <h3 className="text-3xl sm:text-4xl font-bold text-center mb-4">
                            {t('landing.features.title')}
                        </h3>
                        <p className="text-white/50 text-center mb-16 max-w-xl mx-auto">
                            {t('landing.features.subtitle')}
                        </p>

                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {features.map((feature, index) => (
                                <div
                                    key={index}
                                    className="group p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300"
                                >
                                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} p-3 mb-4 group-hover:scale-110 transition-transform`}>
                                        {feature.icon}
                                    </div>
                                    <h4 className="text-lg font-bold mb-2">{t(feature.titleKey)}</h4>
                                    <p className="text-white/50 text-sm leading-relaxed">{t(feature.descKey)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Bottom CTA */}
                <section className="px-6 py-20">
                    <div className="max-w-3xl mx-auto text-center">
                        <h3 className="text-3xl sm:text-4xl font-bold mb-6">
                            {t('landing.bottomCta.title')}
                        </h3>
                        <p className="text-white/50 mb-8">
                            {t('landing.bottomCta.subtitle')}
                        </p>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-lg hover:from-violet-500 hover:to-fuchsia-500 transition-all"
                        >
                            {t('landing.cta.getStarted')}
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>
                </section>

                {/* Footer */}
                <footer className="px-6 py-8 border-t border-white/5">
                    <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                                AiVerse
                            </span>
                            <span className="text-white/30 text-sm">© 2026</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-white/40">
                            <Link to="/privacy" className="hover:text-white/70 transition-colors">
                                {t('landing.footer.privacy')}
                            </Link>
                            <Link to="/terms" className="hover:text-white/70 transition-colors">
                                {t('landing.footer.terms')}
                            </Link>
                            <a
                                href="mailto:contact@aiverseapp.net"
                                className="hover:text-white/70 transition-colors"
                            >
                                {t('landing.footer.contact')}
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    )
}
