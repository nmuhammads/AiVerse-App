import React, { useEffect, useRef, useState } from 'react'
import wheelBase from '@/assets/wheel_newyear.png'
import pointerBlue from '@/assets/pointer_blue.png'
import pointerPink from '@/assets/pointer_pink.png'

interface Segment {
    value: number | string
    color: string
    label: string
    textColor?: string
}

interface WheelProps {
    segments: Segment[]
    rotation: number
    isSpinning: boolean
    onSpinEnd?: () => void
    debug?: boolean
    wheelScale?: number
    wheelAdjustment?: number
    wheelX?: number
    wheelY?: number
    pointerX?: number
    pointerY?: number
    pointerRotation?: number
}

export const Wheel: React.FC<WheelProps> = ({
    segments,
    rotation,
    isSpinning,
    onSpinEnd,
    debug,
    wheelScale = 1,
    wheelAdjustment = 0,
    wheelX = 0,
    wheelY = 6,
    pointerX = 5,
    pointerY = 3,
    pointerRotation = 100
}) => {
    const wheelRef = useRef<HTMLDivElement>(null)
    const [showGlow, setShowGlow] = useState(false)
    const [showBlue, setShowBlue] = useState(true)

    useEffect(() => {
        if (isSpinning) {
            setShowGlow(true)
        }

        if (isSpinning) {
            const timer = setTimeout(() => {
                setShowGlow(false)
                onSpinEnd?.()
            }, 8000)
            return () => clearTimeout(timer)
        }
    }, [rotation, isSpinning, onSpinEnd])

    // Alternating pointer color animation
    useEffect(() => {
        const interval = setInterval(() => {
            setShowBlue(prev => !prev)
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    const numSegments = segments.length
    const segmentAngle = 360 / numSegments

    return (
        <div className="relative w-full aspect-square mx-auto">
            {/* Glow effect behind wheel when spinning */}
            <div
                className={`absolute inset-[-10%] rounded-full transition-opacity duration-500 pointer-events-none ${showGlow ? 'opacity-100' : 'opacity-0'}`}
                style={{
                    background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(236,72,153,0.2) 40%, transparent 70%)',
                    filter: 'blur(20px)',
                }}
            />


            {/* Pointer/Marker with neon color animation */}
            <div
                className="absolute top-[-30%] left-1/2 z-30"
                style={{
                    transform: `translate(calc(-50% + ${pointerX}px), ${pointerY}px)`
                }}
            >
                <div className="">
                    <div
                        className="w-40 h-40 relative"
                        style={{
                            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
                            transform: `rotate(${pointerRotation}deg)`,
                        }}
                    >
                        {/* Blue pointer */}
                        <img
                            src={pointerBlue}
                            alt="Pointer"
                            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${showBlue ? 'opacity-100' : 'opacity-0'}`}
                            draggable={false}
                        />
                        {/* Pink pointer - slightly adjusted */}
                        <img
                            src={pointerPink}
                            alt="Pointer"
                            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${showBlue ? 'opacity-0' : 'opacity-100'}`}
                            style={{
                                transform: 'scaleX(0.97) scaleY(1.1) translateY(-3px) translateX(3px)',
                            }}
                            draggable={false}
                        />
                    </div>
                </div>
            </div>

            {/* The Wheel - fixed centering */}
            <div className="absolute inset-0 z-10">
                {/* Rotatable Element */}
                <div
                    ref={wheelRef}
                    className="absolute inset-0"
                    style={{
                        transform: `rotate(${rotation}deg)`,
                        transition: isSpinning ? 'transform 8s cubic-bezier(0.1, 0, 0, 1)' : 'none',
                        willChange: 'transform',
                        transformOrigin: 'center center',
                    }}
                >
                    {/* Background Image - wheel itself */}
                    <div className="absolute inset-0 w-full h-full"
                        style={{
                            transform: `scale(${wheelScale}) rotate(${wheelAdjustment}deg) translate(${wheelX}px, ${wheelY}px)`,
                        }}
                    >
                        <img
                            src={wheelBase}
                            alt="Wheel"
                            className="w-full h-full object-cover rounded-full"
                            draggable={false}
                        />
                    </div>

                    {/* Text Labels */}
                    <div className="absolute inset-0">
                        {segments.map((seg, i) => {
                            const initialOffset = -15
                            const angleDeg = i * segmentAngle + segmentAngle / 2 + initialOffset
                            const angleRad = (angleDeg - 90) * (Math.PI / 180)
                            const radius = 43
                            const x = 50 + radius * Math.cos(angleRad)
                            const y = 50 + radius * Math.sin(angleRad)

                            const normalizedAngle = ((angleDeg % 360) + 360) % 360
                            const isBottomHalf = normalizedAngle > 90 && normalizedAngle < 270
                            const textRotation = isBottomHalf ? angleDeg + 0 : angleDeg

                            return (
                                <div
                                    key={i}
                                    className="absolute flex items-center justify-center"
                                    style={{
                                        left: `${x}%`,
                                        top: `${y}%`,
                                        transform: `translate(-50%, -50%) rotate(${textRotation}deg)`,
                                    }}
                                >
                                    <div className="bg-black/30 backdrop-blur-[2px] border border-white/10 rounded-lg px-1.5 py-0.5 shadow-sm">
                                        <span
                                            className="text-sm font-black text-white whitespace-nowrap"
                                            style={{
                                                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                                                letterSpacing: '0.05em',
                                                fontWeight: 800,
                                                fontSize: '0.9rem',
                                            }}
                                        >
                                            {seg.label}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Center Cap with Logo - Fixed at exact center */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden ${isSpinning ? 'scale-110' : 'scale-100'} transition-transform`}
                        style={{
                            background: 'linear-gradient(145deg, #1f1f23 0%, #0a0a0b 100%)',
                            boxShadow: '0 0 20px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1)',
                            border: '2px solid rgba(255,255,255,0.15)',
                        }}
                    >
                        <img
                            src="/logo.png"
                            alt="Logo"
                            className="w-full h-full object-cover scale-125"
                            draggable={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
