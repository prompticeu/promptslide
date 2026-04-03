import { Layers, Clock, Copy, Upload, Download, RefreshCw, Check, Cloud, CloudOff } from "lucide-react"

import { cn } from "../../utils"
import { Badge } from "../ui/badge"
import type { SyncInfo } from "../hooks/use-auto-sync"

export interface DeckInfo {
  slug: string
  name: string
  slideCount: number
  transition?: string
  theme?: string
  modifiedAt?: string
  thumbnailUrl?: string
}

interface DeckCardProps {
  deck: DeckInfo
  className?: string
  isActive?: boolean
  syncInfo?: SyncInfo
  onClone?: () => void
  onPush?: () => void
  onPull?: () => void
  syncing?: boolean
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const syncStatusConfig = {
  synced: { icon: Cloud, color: "text-emerald-500", label: "Synced" },
  modified: { icon: Cloud, color: "text-amber-500", label: "Modified" },
  pushing: { icon: RefreshCw, color: "text-[oklch(0.661_0.201_41.38)]", label: "Pushing..." },
  pulling: { icon: Download, color: "text-[oklch(0.661_0.201_41.38)]", label: "Pulling..." },
  error: { icon: CloudOff, color: "text-red-400", label: "Sync error" },
  unlinked: { icon: CloudOff, color: "text-neutral-600", label: "Local only" },
} as const

export function DeckCard({ deck, className, isActive, syncInfo, onClone, onPush, onPull, syncing }: DeckCardProps) {
  const status = syncInfo?.status || "unlinked"
  const statusCfg = syncStatusConfig[status]
  const StatusIcon = statusCfg.icon
  const isSpinning = status === "pushing" || status === "pulling"

  return (
    <div className={cn(
      "group relative flex flex-col overflow-hidden rounded-xl border bg-neutral-900/80 transition-all",
      isActive
        ? "border-[oklch(0.661_0.201_41.38/0.4)] shadow-[0_0_20px_oklch(0.661_0.201_41.38/0.08)]"
        : "border-neutral-800 hover:border-[oklch(0.661_0.201_41.38/0.3)] hover:bg-neutral-900",
      className
    )}>
      {/* Activity pulse */}
      {isActive && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-md bg-[oklch(0.661_0.201_41.38/0.15)] px-2 py-1">
          <RefreshCw className="size-3 animate-spin text-[oklch(0.661_0.201_41.38)]" />
          <span className="text-[10px] font-medium text-[oklch(0.661_0.201_41.38)]">Editing</span>
        </div>
      )}

      {/* Thumbnail */}
      <a href={`/${deck.slug}`} className="relative aspect-video bg-neutral-900 overflow-hidden">
        {deck.thumbnailUrl ? (
          <img src={deck.thumbnailUrl} alt={deck.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800">
            <Layers className="size-10 text-neutral-700" />
          </div>
        )}
      </a>

      {/* Info */}
      <div className="flex flex-col gap-1.5 px-3 py-2.5">
        <a href={`/${deck.slug}`} className="flex items-center gap-2 no-underline">
          <span className="truncate text-sm font-semibold text-neutral-100">{deck.name}</span>
          <Badge variant="ghost">{deck.slideCount} slides</Badge>
        </a>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            {deck.theme && <span className="truncate">{deck.theme}</span>}
            {deck.modifiedAt && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatRelativeTime(deck.modifiedAt)}
              </span>
            )}
          </div>

          {/* Sync status indicator */}
          <div className={cn("flex items-center gap-1 text-[10px]", statusCfg.color)} title={statusCfg.label}>
            <StatusIcon className={cn("size-3", isSpinning && "animate-spin")} />
          </div>
        </div>

        {/* Actions — visible on hover */}
        <div className="mt-1 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onClone && (
            <button onClick={(e) => { e.preventDefault(); onClone() }} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200" title="Use as template">
              <Copy className="size-3" /> Clone
            </button>
          )}
          {onPush && status !== "synced" && status !== "pushing" && (
            <button onClick={(e) => { e.preventDefault(); onPush() }} disabled={syncing} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50" title="Push to Registry">
              <Upload className="size-3" /> Push
            </button>
          )}
          {onPull && (
            <button onClick={(e) => { e.preventDefault(); onPull() }} disabled={syncing} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50" title="Pull from Registry">
              <Download className="size-3" /> Pull
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
