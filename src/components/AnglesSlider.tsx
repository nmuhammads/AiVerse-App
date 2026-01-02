interface AnglesSliderProps {
    label: string
    value: number
    min: number
    max: number
    step?: number
    suffix?: string
    onChange: (value: number) => void
}

export function AnglesSlider({ label, value, min, max, step = 5, suffix = '°', onChange }: AnglesSliderProps) {
    const percentage = ((value - min) / (max - min)) * 100
    const midpoint = ((0 - min) / (max - min)) * 100

    // Градиент от середины к текущему значению
    const gradientStyle = value >= 0
        ? `linear-gradient(to right, transparent 0%, transparent ${midpoint}%, rgb(59 130 246 / 0.3) ${midpoint}%, rgb(59 130 246 / 0.3) ${percentage}%, transparent ${percentage}%)`
        : `linear-gradient(to right, transparent 0%, transparent ${percentage}%, rgb(59 130 246 / 0.3) ${percentage}%, rgb(59 130 246 / 0.3) ${midpoint}%, transparent ${midpoint}%)`

    return (
        <div className="relative overflow-hidden flex items-center rounded-xl border border-white/10 h-12 px-4 bg-zinc-900/50">
            {/* Gradient indicator */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: gradientStyle }} />

            {/* Position indicator */}
            <div
                className="absolute top-0 bottom-0 w-0.5 bg-white rounded-full z-10"
                style={{ left: `calc(${percentage}% - 1px)` }}
            />

            {/* Labels */}
            <div className="relative z-10 flex items-center justify-between w-full pointer-events-none">
                <span className="text-xs text-zinc-500">{label}</span>
                <span className="text-xs text-white font-medium">{value}{suffix}</span>
            </div>

            {/* Hidden range input */}
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
        </div>
    )
}
