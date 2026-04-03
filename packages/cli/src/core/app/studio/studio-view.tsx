import { useState, useEffect } from "react"
import { ArrowLeft, Layers, RefreshCw } from "lucide-react"

import { Badge } from "../ui/badge"

interface StudioOverlayProps {
  deckName: string
  deckSlug: string
  slideCount: number
}

/**
 * Fixed overlay header for studio mode (multi-deck).
 * Hides during fullscreen presentation mode.
 */
export function StudioOverlay({
  deckName,
  deckSlug,
  slideCount,
}: StudioOverlayProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activity, setActivity] = useState<string | null>(null)

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [])

  // Listen for file change SSE events for this deck
  useEffect(() => {
    const es = new EventSource("/__promptslide_api/events")
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.deckSlug === deckSlug && data.type === "change") {
          setActivity(data.file)
          setTimeout(() => setActivity(null), 2000)
        }
      } catch {}
    }
    return () => es.close()
  }, [deckSlug])

  // Hide during fullscreen and print
  if (isFullscreen) return null

  return (
    <header data-promptslide-print-hidden="true" className="glass-panel fixed top-0 right-0 left-0 z-40 flex h-10 items-center gap-3 border-b border-white/[0.06] bg-neutral-950/80 px-4 backdrop-blur-xl print:hidden">
      <a
        href="/"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-neutral-400 transition-colors hover:bg-neutral-800/50 hover:text-neutral-200"
      >
        <ArrowLeft className="size-3.5" />
        <span className="text-[11px] font-medium">Library</span>
      </a>

      <div className="h-4 w-px bg-neutral-700/50" />

      <div className="flex items-center gap-2">
        <Layers className="size-3 text-neutral-500" />
        <span className="text-xs font-semibold text-neutral-200">{deckName}</span>
        <Badge variant="ghost">{slideCount} slides</Badge>
      </div>

      <div className="flex-1" />

      {/* Activity indicator */}
      {activity && (
        <div className="flex items-center gap-1.5 rounded-md bg-[oklch(0.661_0.201_41.38/0.1)] px-2 py-1 text-[10px] text-[oklch(0.661_0.201_41.38)] animate-fade-in">
          <RefreshCw className="size-3 animate-spin" />
          <span className="truncate max-w-32">{activity}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-neutral-500">
        <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
        Live
      </div>
    </header>
  )
}

export { StudioOverlay as StudioView }
