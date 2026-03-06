import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'

export type BottomSheetSnap = 'collapsed' | 'half' | 'full'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function nearestSnap(
  value: number,
  points: Record<BottomSheetSnap, number>,
  allowCollapsed: boolean
): BottomSheetSnap {
  const snaps: BottomSheetSnap[] = allowCollapsed ? ['collapsed', 'half', 'full'] : ['half', 'full']
  return snaps.reduce((best, current) => {
    const bestDistance = Math.abs(points[best] - value)
    const currentDistance = Math.abs(points[current] - value)
    return currentDistance < bestDistance ? current : best
  }, snaps[0])
}

export function BottomSheet(props: {
  open: boolean
  onClose: () => void
  title?: string
  initialSnap: BottomSheetSnap
  allowCollapsed?: boolean
  bottomClassName?: string
  contentBottomOffset?: string
  maxHeightPx?: number
  children: ReactNode
}) {
  const {
    open,
    onClose,
    title,
    initialSnap,
    allowCollapsed = true,
    bottomClassName,
    contentBottomOffset,
    maxHeightPx,
    children,
  } = props

  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === 'undefined' ? 820 : window.innerHeight))
  const [isRendered, setIsRendered] = useState(open)
  const [isActive, setIsActive] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragTranslate, setDragTranslate] = useState<number | null>(null)
  const [snap, setSnap] = useState<BottomSheetSnap>(() => {
    if (!allowCollapsed && initialSnap === 'collapsed') return 'half'
    return initialSnap
  })

  const dragStartYRef = useRef(0)
  const dragStartTranslateRef = useRef(0)

  const maxHeight = useMemo(() => {
    const fallback = Math.max(320, Math.round(viewportHeight * 0.9))
    if (typeof maxHeightPx !== 'number' || !Number.isFinite(maxHeightPx)) return fallback
    return clamp(Math.round(maxHeightPx), 320, viewportHeight)
  }, [maxHeightPx, viewportHeight])
  const halfHeight = useMemo(() => Math.max(240, Math.round(viewportHeight * 0.5)), [viewportHeight])
  const collapsedHeight = 48

  const snapPoints = useMemo(
    () => ({
      collapsed: Math.max(0, maxHeight - collapsedHeight),
      half: Math.max(0, maxHeight - halfHeight),
      full: 0,
    }),
    [halfHeight, maxHeight]
  )

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (open) {
      setIsRendered(true)
      setSnap(!allowCollapsed && initialSnap === 'collapsed' ? 'half' : initialSnap)
      setDragTranslate(null)
      const frame = window.requestAnimationFrame(() => {
        setIsActive(true)
      })
      return () => window.cancelAnimationFrame(frame)
    }

    if (!isRendered) return
    setIsActive(false)
    const timer = window.setTimeout(() => {
      setIsRendered(false)
      setIsDragging(false)
      setDragTranslate(null)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [allowCollapsed, initialSnap, isRendered, open])

  const resolveTranslate = useCallback(() => {
    if (!isActive) return maxHeight
    if (dragTranslate !== null) return dragTranslate
    return snapPoints[snap]
  }, [dragTranslate, isActive, maxHeight, snap, snapPoints])

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    if (!touch) return
    setIsDragging(true)
    dragStartYRef.current = touch.clientY
    dragStartTranslateRef.current = resolveTranslate()
  }, [resolveTranslate])

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const touch = event.touches[0]
    if (!touch) return
    const delta = touch.clientY - dragStartYRef.current
    const next = clamp(dragStartTranslateRef.current + delta, 0, maxHeight)
    setDragTranslate(next)
  }, [isDragging, maxHeight])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return
    const value = dragTranslate ?? snapPoints[snap]
    const nextSnap = nearestSnap(value, snapPoints, allowCollapsed)
    setSnap(nextSnap)
    setDragTranslate(null)
    setIsDragging(false)
  }, [allowCollapsed, dragTranslate, isDragging, snap, snapPoints])

  const contentStyle: CSSProperties | undefined = contentBottomOffset
    ? {
      paddingBottom: `calc(${contentBottomOffset} + env(safe-area-inset-bottom) + 14px)`,
    }
    : undefined

  if (!isRendered) return null

  return (
    <div className={`fixed inset-0 z-[160] ${isActive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <button
        className={`absolute inset-0 border-0 bg-black/55 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-label="Close sheet"
      />

      <section
        className={`absolute inset-x-0 ${bottomClassName || 'bottom-0'} mx-auto flex w-full max-w-[760px] flex-col rounded-t-2xl border border-white/10 bg-[#0b1018] shadow-[0_-14px_36px_rgba(0,0,0,0.42)]`}
        style={{
          height: `${maxHeight}px`,
          transform: `translateY(${resolveTranslate()}px)`,
          transition: isDragging ? 'none' : 'transform 220ms ease',
        }}
      >
        <div
          className="flex cursor-grab touch-none items-center justify-center py-2"
          style={{ touchAction: 'none' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <div className="h-1.5 w-11 rounded-full bg-zinc-500/70" />
        </div>

        <div className="flex items-center justify-between border-b border-white/10 px-3 pb-2">
          <p className="text-sm font-semibold text-zinc-100">{title || 'Панель'}</p>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-zinc-900/70 text-zinc-300"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2"
          style={contentStyle}
        >
          {children}
        </div>
      </section>
    </div>
  )
}
