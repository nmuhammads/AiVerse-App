import { useEffect, useRef, useState } from 'react'
import {
  Ellipsis,
  ListTree,
  PencilLine,
  Save,
  Settings2,
  Shapes,
} from 'lucide-react'

export function MobileHeaderMenu(props: {
  onSave: () => void
  onOpenLibrary: () => void
  onOpenInspector: () => void
  onOpenTemplates: () => void
  onOpenRename: () => void
  disabled?: boolean
}) {
  const {
    onSave,
    onOpenLibrary,
    onOpenInspector,
    onOpenTemplates,
    onOpenRename,
    disabled = false,
  } = props
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  const runAction = (action: () => void) => {
    action()
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative z-[120]">
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-zinc-900/75 text-zinc-200 disabled:opacity-60"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-label="Open menu"
      >
        <Ellipsis className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[130] min-w-[172px] rounded-xl border border-white/10 bg-[#0f151f]/95 p-1.5 shadow-[0_14px_28px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-100 hover:bg-zinc-800/80"
            onClick={() => runAction(onSave)}
          >
            <Save className="h-3.5 w-3.5 text-zinc-300" />
            Save
          </button>
          <button
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-100 hover:bg-zinc-800/80"
            onClick={() => runAction(onOpenLibrary)}
          >
            <ListTree className="h-3.5 w-3.5 text-zinc-300" />
            Nodes
          </button>
          <button
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-100 hover:bg-zinc-800/80"
            onClick={() => runAction(onOpenInspector)}
          >
            <Settings2 className="h-3.5 w-3.5 text-zinc-300" />
            Settings
          </button>
          <button
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-100 hover:bg-zinc-800/80"
            onClick={() => runAction(onOpenTemplates)}
          >
            <Shapes className="h-3.5 w-3.5 text-zinc-300" />
            Templates
          </button>
          <button
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-zinc-100 hover:bg-zinc-800/80"
            onClick={() => runAction(onOpenRename)}
          >
            <PencilLine className="h-3.5 w-3.5 text-zinc-300" />
            Rename
          </button>
        </div>
      ) : null}
    </div>
  )
}
