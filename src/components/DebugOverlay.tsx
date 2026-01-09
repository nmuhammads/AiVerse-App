import { useState, useEffect, useRef } from 'react'
import { X, Copy, Trash2, ChevronDown, ChevronUp, Bug } from 'lucide-react'

interface LogEntry {
    id: number
    type: 'log' | 'warn' | 'error' | 'info'
    message: string
    timestamp: string
}

let logIdCounter = 0
const logBuffer: LogEntry[] = []
const listeners: Set<() => void> = new Set()

// Capture console methods
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
}

function captureLog(type: 'log' | 'warn' | 'error' | 'info', args: unknown[]) {
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2)
            } catch {
                return String(arg)
            }
        }
        return String(arg)
    }).join(' ')

    const entry: LogEntry = {
        id: ++logIdCounter,
        type,
        message,
        timestamp: new Date().toLocaleTimeString()
    }

    logBuffer.push(entry)
    // Keep only last 100 logs
    if (logBuffer.length > 100) logBuffer.shift()

    listeners.forEach(fn => fn())
}

// Override console methods
console.log = (...args) => {
    originalConsole.log(...args)
    captureLog('log', args)
}
console.warn = (...args) => {
    originalConsole.warn(...args)
    captureLog('warn', args)
}
console.error = (...args) => {
    originalConsole.error(...args)
    captureLog('error', args)
}
console.info = (...args) => {
    originalConsole.info(...args)
    captureLog('info', args)
}

export function DebugOverlay() {
    const [isOpen, setIsOpen] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [logs, setLogs] = useState<LogEntry[]>([...logBuffer])
    const logsEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const update = () => setLogs([...logBuffer])
        listeners.add(update)
        return () => { listeners.delete(update) }
    }, [])

    useEffect(() => {
        if (isOpen && !isMinimized) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, isOpen, isMinimized])

    const copyLogs = () => {
        const text = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n')
        navigator.clipboard.writeText(text).then(() => {
            alert('Логи скопированы!')
        }).catch(() => {
            // Fallback for iOS
            const textarea = document.createElement('textarea')
            textarea.value = text
            document.body.appendChild(textarea)
            textarea.select()
            document.execCommand('copy')
            document.body.removeChild(textarea)
            alert('Логи скопированы!')
        })
    }

    const clearLogs = () => {
        logBuffer.length = 0
        setLogs([])
    }

    const getLogColor = (type: LogEntry['type']) => {
        switch (type) {
            case 'error': return 'text-red-400'
            case 'warn': return 'text-yellow-400'
            case 'info': return 'text-blue-400'
            default: return 'text-zinc-300'
        }
    }

    // Floating button when closed
    // Показывать только в DEV режиме
    const IS_DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'
    if (!IS_DEV_MODE) return null

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-32 left-4 z-[9999] w-12 h-12 rounded-full bg-purple-600 text-white shadow-lg flex items-center justify-center"
            >
                <Bug size={20} />
            </button>
        )
    }

    return (
        <div className={`fixed inset-x-2 z-[9999] bg-zinc-900/95 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl ${isMinimized ? 'bottom-24 h-12' : 'bottom-24 top-20'}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Bug size={16} className="text-purple-400" />
                    <span className="text-xs font-bold text-white">Debug Logs ({logs.length})</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={copyLogs} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400">
                        <Copy size={14} />
                    </button>
                    <button onClick={clearLogs} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400">
                        <Trash2 size={14} />
                    </button>
                    <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400">
                        {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Logs */}
            {!isMinimized && (
                <div className="overflow-auto h-[calc(100%-44px)] p-2 space-y-1 text-[10px] font-mono">
                    {logs.length === 0 ? (
                        <div className="text-center text-zinc-500 py-8">Нет логов</div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className={`${getLogColor(log.type)} break-all`}>
                                <span className="text-zinc-500">[{log.timestamp}]</span>{' '}
                                <span className="font-bold">[{log.type.toUpperCase()}]</span>{' '}
                                {log.message}
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            )}
        </div>
    )
}
