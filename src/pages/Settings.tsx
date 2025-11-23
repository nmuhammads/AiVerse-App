import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Globe, Bell, Info, Shield, ChevronRight, Moon } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'

export default function Settings() {
    const navigate = useNavigate()
    const { impact } = useHaptics()

    const sections = [
        {
            title: 'Основные',
            items: [
                { icon: Globe, label: 'Язык', value: 'Русский', onClick: () => { } },
                { icon: Moon, label: 'Тема', value: 'Темная', onClick: () => { } },
            ]
        },
        {
            title: 'Уведомления',
            items: [
                { icon: Bell, label: 'Push-уведомления', value: 'Вкл', onClick: () => { } },
            ]
        },
        {
            title: 'О приложении',
            items: [
                { icon: Shield, label: 'Политика конфиденциальности', onClick: () => { } },
                { icon: Info, label: 'О нас', value: 'v2.2', onClick: () => { } },
            ]
        }
    ]

    return (
        <div className="min-h-dvh bg-black text-white pt-[calc(env(safe-area-inset-top)+20px)] pb-10">
            {/* Header */}
            <div className="px-4 py-4 flex items-center gap-4 relative">
                <button
                    onClick={() => { impact('light'); navigate(-1) }}
                    className="w-10 h-10 rounded-xl bg-zinc-900/50 border border-white/10 flex items-center justify-center text-white hover:bg-zinc-800 transition-colors"
                >
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-xl font-bold">Настройки</h1>
            </div>

            {/* Content */}
            <div className="px-4 space-y-6 mt-4">
                {sections.map((section, idx) => (
                    <div key={idx} className="space-y-3">
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">{section.title}</h2>
                        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                            {section.items.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => { impact('light'); item.onClick() }}
                                    className={`w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors ${i !== section.items.length - 1 ? 'border-b border-white/5' : ''}`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                                        <item.icon size={16} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-medium text-white">{item.label}</div>
                                    </div>
                                    {item.value && <div className="text-xs font-medium text-zinc-500">{item.value}</div>}
                                    <ChevronRight size={16} className="text-zinc-600" />
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
