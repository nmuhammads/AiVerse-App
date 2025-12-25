import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Check, Trash2, Undo2, Paintbrush } from 'lucide-react'
import { useHaptics } from '@/hooks/useHaptics'

interface InpaintCanvasProps {
    imageUrl: string
    onMaskGenerated: (maskDataUrl: string) => void
    onClose: () => void
}

export function InpaintCanvas({ imageUrl, onMaskGenerated, onClose }: InpaintCanvasProps) {
    const { t } = useTranslation()
    const { impact } = useHaptics()

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const maskCanvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const [isDrawing, setIsDrawing] = useState(false)
    const [brushSize, setBrushSize] = useState(30)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
    const [imageLoaded, setImageLoaded] = useState(false)
    const [history, setHistory] = useState<ImageData[]>([])
    const [loadError, setLoadError] = useState(false)

    // Store image for redrawing
    const loadedImageRef = useRef<HTMLImageElement | null>(null)

    // Setup canvas after image is loaded
    const setupCanvas = useCallback((img: HTMLImageElement) => {
        const container = containerRef.current
        if (!container) {
            console.error('[InpaintCanvas] Container ref is null')
            return false
        }

        // Wait for container to have dimensions
        const containerWidth = container.clientWidth - 32 // padding
        const containerHeight = window.innerHeight * 0.6

        if (containerWidth <= 0) {
            console.log('[InpaintCanvas] Container width is 0, retrying...')
            return false
        }

        // Calculate size to fit container while preserving aspect ratio
        const imgAspect = img.width / img.height
        let width = containerWidth
        let height = containerWidth / imgAspect

        if (height > containerHeight) {
            height = containerHeight
            width = containerHeight * imgAspect
        }

        console.log('[InpaintCanvas] Canvas size:', { width, height, imgWidth: img.width, imgHeight: img.height })

        // Store image ref first
        loadedImageRef.current = img

        // Set canvas size state
        setCanvasSize({ width, height })

        // Draw after DOM updates
        requestAnimationFrame(() => {
            const canvas = canvasRef.current
            const maskCanvas = maskCanvasRef.current
            if (!canvas || !maskCanvas) {
                console.error('[InpaintCanvas] Canvas refs not ready after RAF')
                return
            }

            // Set actual canvas dimensions
            canvas.width = width
            canvas.height = height
            maskCanvas.width = img.width // Full resolution for mask
            maskCanvas.height = img.height

            // Draw image on main canvas
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height)
                console.log('[InpaintCanvas] Image drawn to canvas')
            }

            // Initialize mask canvas with black (preserve area)
            const maskCtx = maskCanvas.getContext('2d')
            if (maskCtx) {
                maskCtx.fillStyle = 'black'
                maskCtx.fillRect(0, 0, img.width, img.height)
            }

            setImageLoaded(true)
        })

        return true
    }, [])

    // Load image and setup canvas
    useEffect(() => {
        let cancelled = false
        let retryCount = 0
        const maxRetries = 10

        const trySetupCanvas = (img: HTMLImageElement) => {
            if (cancelled) return

            const success = setupCanvas(img)
            if (!success && retryCount < maxRetries) {
                retryCount++
                setTimeout(() => trySetupCanvas(img), 100)
            } else if (!success) {
                console.error('[InpaintCanvas] Failed to setup canvas after retries')
                setLoadError(true)
            }
        }

        const loadImage = async () => {
            try {
                console.log('[InpaintCanvas] Loading image:', imageUrl.slice(0, 100))

                const img = new Image()

                img.onload = () => {
                    console.log('[InpaintCanvas] Image loaded, dimensions:', img.width, 'x', img.height)
                    // Wait a bit for container to be ready, then try setup
                    setTimeout(() => trySetupCanvas(img), 50)
                }

                img.onerror = (e) => {
                    console.error('[InpaintCanvas] Image load error:', e)
                    if (!cancelled) setLoadError(true)
                }

                // For data URLs, load directly
                if (imageUrl.startsWith('data:')) {
                    console.log('[InpaintCanvas] Loading data URL directly')
                    img.src = imageUrl
                } else {
                    // For remote URLs, fetch via proxy and convert to base64
                    console.log('[InpaintCanvas] Fetching via proxy...')
                    try {
                        const proxyUrl = `/api/proxy/image?url=${encodeURIComponent(imageUrl)}`
                        const response = await fetch(proxyUrl)

                        if (!response.ok) {
                            throw new Error(`Proxy returned ${response.status}`)
                        }

                        const blob = await response.blob()
                        const reader = new FileReader()

                        reader.onloadend = () => {
                            const base64 = reader.result as string
                            console.log('[InpaintCanvas] Converted to base64, loading image...')
                            img.src = base64
                        }

                        reader.onerror = () => {
                            console.error('[InpaintCanvas] FileReader error')
                            if (!cancelled) setLoadError(true)
                        }

                        reader.readAsDataURL(blob)
                    } catch (fetchErr) {
                        console.error('[InpaintCanvas] Fetch error:', fetchErr)
                        if (!cancelled) setLoadError(true)
                    }
                }
            } catch (err) {
                console.error('[InpaintCanvas] Error loading image:', err)
                if (!cancelled) setLoadError(true)
            }
        }

        // Small delay to ensure component is mounted
        const timer = setTimeout(loadImage, 50)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [imageUrl, setupCanvas])

    // Get position from event
    const getPosition = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return null

        const rect = canvas.getBoundingClientRect()
        let clientX: number, clientY: number

        if ('touches' in e) {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else {
            clientX = e.clientX
            clientY = e.clientY
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        }
    }, [])

    // Draw on both canvases
    const draw = useCallback((x: number, y: number) => {
        const canvas = canvasRef.current
        const maskCanvas = maskCanvasRef.current
        const img = loadedImageRef.current
        if (!canvas || !maskCanvas || !img) return

        const ctx = canvas.getContext('2d')
        const maskCtx = maskCanvas.getContext('2d')
        if (!ctx || !maskCtx) return

        // Draw on mask canvas (white = edit area) - scaled to full resolution
        const scaleX = maskCanvas.width / canvas.width
        const scaleY = maskCanvas.height / canvas.height

        maskCtx.beginPath()
        maskCtx.arc(x * scaleX, y * scaleY, (brushSize / 2) * scaleX, 0, Math.PI * 2)
        maskCtx.fillStyle = 'white'
        maskCtx.fill()

        // Redraw display: image + mask overlay as single layer
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Draw mask overlay with fixed transparency
        ctx.save()
        ctx.globalAlpha = 0.35
        ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height)
        ctx.restore()
    }, [brushSize])

    // Save state for undo
    const saveState = useCallback(() => {
        const maskCanvas = maskCanvasRef.current
        if (!maskCanvas) return

        const maskCtx = maskCanvas.getContext('2d')
        if (!maskCtx) return

        const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
        setHistory(prev => [...prev.slice(-10), imageData]) // Keep last 10 states
    }, [])

    // Event handlers
    const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault()
        const pos = getPosition(e)
        if (!pos) return

        saveState()
        setIsDrawing(true)
        draw(pos.x, pos.y)
        impact('light')
    }, [getPosition, draw, saveState, impact])

    const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault()
        if (!isDrawing) return

        const pos = getPosition(e)
        if (!pos) return

        draw(pos.x, pos.y)
    }, [isDrawing, getPosition, draw])

    const handleEnd = useCallback(() => {
        setIsDrawing(false)
    }, [])

    // Clear mask
    const handleClear = useCallback(() => {
        const canvas = canvasRef.current
        const maskCanvas = maskCanvasRef.current
        const img = loadedImageRef.current
        if (!canvas || !maskCanvas || !img) return

        saveState()

        // Redraw image on display canvas
        const ctx = canvas.getContext('2d')
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        }

        // Clear mask canvas
        const maskCtx = maskCanvas.getContext('2d')
        if (maskCtx) {
            maskCtx.fillStyle = 'black'
            maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
        }

        impact('medium')
    }, [saveState, impact])

    // Undo
    const handleUndo = useCallback(() => {
        if (history.length === 0) return

        const maskCanvas = maskCanvasRef.current
        const canvas = canvasRef.current
        const img = loadedImageRef.current
        if (!maskCanvas || !canvas || !img) return

        const maskCtx = maskCanvas.getContext('2d')
        const ctx = canvas.getContext('2d')
        if (!maskCtx || !ctx) return

        const lastState = history[history.length - 1]
        maskCtx.putImageData(lastState, 0, 0)

        // Redraw display canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Overlay mask visualization
        const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
        const scaleX = canvas.width / maskCanvas.width
        const scaleY = canvas.height / maskCanvas.height

        for (let y = 0; y < maskCanvas.height; y += 4) {
            for (let x = 0; x < maskCanvas.width; x += 4) {
                const i = (y * maskCanvas.width + x) * 4
                if (maskData.data[i] > 128) { // White pixel in mask
                    ctx.beginPath()
                    ctx.arc(x * scaleX, y * scaleY, 2, 0, Math.PI * 2)
                    ctx.fillStyle = 'rgba(139, 92, 246, 0.3)'
                    ctx.fill()
                }
            }
        }

        setHistory(prev => prev.slice(0, -1))
        impact('light')
    }, [history, impact])

    // Done - export mask
    const handleDone = useCallback(() => {
        const maskCanvas = maskCanvasRef.current
        if (!maskCanvas) return

        const maskDataUrl = maskCanvas.toDataURL('image/png')
        onMaskGenerated(maskDataUrl)
        impact('medium')
    }, [onMaskGenerated, impact])

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <button
                    onClick={() => { impact('light'); onClose() }}
                    className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-white/10"
                >
                    <X size={20} />
                </button>
                <h2 className="text-white font-semibold">{t('editor.maskEditor.title')}</h2>
                <button
                    onClick={handleDone}
                    className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center border border-violet-500"
                >
                    <Check size={20} />
                </button>
            </div>

            {/* Canvas area */}
            <div
                ref={containerRef}
                className="flex-1 flex items-center justify-center p-4 overflow-hidden"
            >
                {loadError && (
                    <div className="text-center">
                        <div className="text-red-400 mb-2">Failed to load image</div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-zinc-800 text-white rounded-lg"
                        >
                            Close
                        </button>
                    </div>
                )}
                {!imageLoaded && !loadError && (
                    <div className="text-zinc-500">{t('common.loading')}</div>
                )}
                <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    className="rounded-xl border border-white/10 touch-none"
                    style={{
                        display: imageLoaded ? 'block' : 'none',
                        maxWidth: '100%',
                        maxHeight: '60vh'
                    }}
                    onMouseDown={handleStart}
                    onMouseMove={handleMove}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                    onTouchStart={handleStart}
                    onTouchMove={handleMove}
                    onTouchEnd={handleEnd}
                />
                {/* Hidden mask canvas */}
                <canvas
                    ref={maskCanvasRef}
                    style={{ display: 'none' }}
                />
            </div>

            {/* Toolbar */}
            <div className="p-4 border-t border-white/10 bg-zinc-900/50">
                <div className="flex items-center justify-between max-w-md mx-auto">
                    {/* Clear */}
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-white/10"
                    >
                        <Trash2 size={18} />
                        <span className="text-sm">{t('editor.maskEditor.clear')}</span>
                    </button>

                    {/* Brush size slider */}
                    <div className="flex items-center gap-3 bg-zinc-800 rounded-xl px-3 py-2 border border-white/10 flex-1 mx-3">
                        <input
                            type="range"
                            min="5"
                            max="100"
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                        <span className="text-white text-sm font-medium w-10 text-right">{brushSize}</span>
                        <Paintbrush size={18} className="text-violet-400" />
                    </div>

                    {/* Undo */}
                    <button
                        onClick={handleUndo}
                        disabled={history.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Undo2 size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}
