import { useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'

interface AnglesCubeProps {
    imageUrl: string
    rotation: number      // -90 to 90
    tilt: number          // -45 to 45
    zoom: number          // 0 to 10
    onRotationChange: (value: number) => void
    onTiltChange: (value: number) => void
    onReset: () => void
}

export function AnglesCube({
    imageUrl, rotation, tilt, zoom,
    onRotationChange, onTiltChange, onReset
}: AnglesCubeProps) {
    const cubeRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [startPos, setStartPos] = useState({ x: 0, y: 0 })

    const cubeSize = 80
    const halfSize = cubeSize / 2
    const scale = 1 + (zoom / 20) // 1.0 to 1.5

    // Touch/Mouse handlers для интерактивного управления
    const handleStart = (clientX: number, clientY: number) => {
        setIsDragging(true)
        setStartPos({ x: clientX, y: clientY })
    }

    const handleMove = (clientX: number, clientY: number) => {
        if (!isDragging) return
        const deltaX = clientX - startPos.x
        const deltaY = clientY - startPos.y

        // Чувствительность: 1px = 0.5 градуса
        const newRotation = Math.max(-90, Math.min(90, rotation + deltaX * 0.5))
        const newTilt = Math.max(-45, Math.min(45, tilt - deltaY * 0.3))

        onRotationChange(Math.round(newRotation / 15) * 15)
        onTiltChange(Math.round(newTilt / 45) * 45)
        setStartPos({ x: clientX, y: clientY })
    }

    const handleEnd = () => setIsDragging(false)

    return (
        <div className="relative flex items-center justify-center rounded-xl bg-zinc-900/50 min-h-[180px] border border-white/5">
            {/* 3D Cube Container */}
            <div
                ref={cubeRef}
                style={{
                    width: cubeSize,
                    height: cubeSize,
                    perspective: '400px',
                    transform: `scale(${scale})`,
                    transition: 'transform 0.15s ease-out'
                }}
                onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
                onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchEnd={handleEnd}
            >
                <div
                    className="select-none transition-transform cursor-grab active:cursor-grabbing"
                    style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        transformStyle: 'preserve-3d',
                        transform: `rotateX(${-tilt}deg) rotateY(${-rotation}deg)`,
                        transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                    }}
                >
                    {/* Front face - User Image */}
                    <CubeFace transform={`rotateY(0deg) translateZ(${halfSize}px)`} active>
                        <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    </CubeFace>

                    {/* Back face */}
                    <CubeFace transform={`rotateY(180deg) translateZ(${halfSize}px)`}>B</CubeFace>

                    {/* Right face */}
                    <CubeFace transform={`rotateY(90deg) translateZ(${halfSize}px)`}>R</CubeFace>

                    {/* Left face */}
                    <CubeFace transform={`rotateY(-90deg) translateZ(${halfSize}px)`}>L</CubeFace>

                    {/* Top face */}
                    <CubeFace transform={`rotateX(90deg) translateZ(${halfSize}px)`}>T</CubeFace>

                    {/* Bottom face */}
                    <CubeFace transform={`rotateX(-90deg) translateZ(${halfSize}px)`}>B</CubeFace>
                </div>
            </div>

            {/* Reset Button */}
            <button
                onClick={onReset}
                className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition"
            >
                <RotateCcw size={14} />
                Reset
            </button>
        </div>
    )
}

function CubeFace({ transform, active, children }: {
    transform: string
    active?: boolean
    children: React.ReactNode
}) {
    return (
        <div
            style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                transform,
                backfaceVisibility: 'hidden'
            }}
        >
            <div className={`
                w-full h-full flex items-center justify-center 
                bg-zinc-800/90 rounded-lg overflow-hidden
                text-white text-sm font-medium
                border-2 border-white/20
                scale-[0.85]
                shadow-lg shadow-black/30
                ${active ? 'opacity-100 border-violet-500/50' : 'opacity-70'}
            `}>
                {children}
            </div>
        </div>
    )
}
