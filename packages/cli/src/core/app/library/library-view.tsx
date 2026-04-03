import { useState, useEffect, useCallback } from "react"
import {
  Search, Layers, LayoutTemplate, Palette, Component,
  Download, Loader2, Plus, Copy, Upload, RefreshCw
} from "lucide-react"

import { cn } from "../../utils"
import { AppShell } from "../app-shell"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { DeckCard } from "./deck-card"
import type { DeckInfo } from "./deck-card"
import { useAuth } from "../hooks/use-auth"
import { useRegistryItems } from "../hooks/use-registry-items"
import type { RegistryItem } from "../hooks/use-registry-items"
import { useFileEvents } from "../hooks/use-file-events"
import { useAutoSync } from "../hooks/use-auto-sync"

type FilterType = "all" | "deck" | "layout" | "component" | "theme"
type TabType = "local" | "registry"

const filterOptions: { type: FilterType; label: string; icon: React.ReactNode }[] = [
  { type: "all", label: "All", icon: null },
  { type: "deck", label: "Decks", icon: <Layers className="size-3.5" /> },
  { type: "layout", label: "Layouts", icon: <LayoutTemplate className="size-3.5" /> },
  { type: "component", label: "Components", icon: <Component className="size-3.5" /> },
  { type: "theme", label: "Themes", icon: <Palette className="size-3.5" /> },
]

export function LibraryView() {
  const [decks, setDecks] = useState<DeckInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [activeTab, setActiveTab] = useState<TabType>("local")
  const [installingName, setInstallingName] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showCloneDialog, setShowCloneDialog] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const { auth } = useAuth()
  const registry = useRegistryItems()
  const { isDeckActive } = useFileEvents()
  const { syncing, pushDeck, pullDeck, getSyncInfo } = useAutoSync({ autoPush: auth.authenticated, debounceMs: 2000 })

  useEffect(() => { fetchDecks() }, [])

  useEffect(() => {
    if (activeTab === "registry" && auth.authenticated) {
      registry.fetchItems(searchQuery || undefined, activeFilter !== "all" ? activeFilter : undefined)
    }
  }, [activeTab, auth.authenticated])

  async function fetchDecks() {
    try {
      const res = await fetch("/__promptslide_api/decks")
      if (!res.ok) throw new Error(`Failed to fetch decks: ${res.status}`)
      const data = await res.json()
      setDecks(data.decks)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decks")
    } finally {
      setLoading(false)
    }
  }

  const handleRegistrySearch = useCallback(() => {
    if (auth.authenticated) {
      registry.fetchItems(searchQuery || undefined, activeFilter !== "all" ? activeFilter : undefined)
    }
  }, [auth.authenticated, searchQuery, activeFilter, registry.fetchItems])

  const handleInstall = useCallback(async (item: RegistryItem) => {
    setInstallingName(item.name)
    const success = await registry.installItem(item.name)
    setInstallingName(null)
    if (success) await fetchDecks()
  }, [registry.installItem])

  const handleCreateDeck = useCallback(async (name: string) => {
    setCreating(true)
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const res = await fetch("/__promptslide_api/decks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create deck")
      }
      setShowCreateDialog(false)
      await fetchDecks()
    } catch {} finally {
      setCreating(false)
    }
  }, [])

  const handleCloneDeck = useCallback(async (source: string, newName: string) => {
    setCreating(true)
    try {
      const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const res = await fetch("/__promptslide_api/decks/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, slug, name: newName }),
      })
      if (!res.ok) throw new Error("Clone failed")
      setShowCloneDialog(null)
      await fetchDecks()
    } catch {} finally {
      setCreating(false)
    }
  }, [])

  const filteredDecks = decks.filter((deck) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return deck.name.toLowerCase().includes(q) || deck.slug.toLowerCase().includes(q)
  })

  return (
    <AppShell currentPath="/">
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between animate-fade-up">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Library</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your Decks</h1>
            <p className="mt-1 text-sm text-neutral-400">Browse, create, and manage presentations</p>
          </div>
          <Button variant="default" size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="size-3.5" />
            New Deck
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-1 border-b border-neutral-800/50 animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <button
            onClick={() => setActiveTab("local")}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === "local" ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            Local
            {activeTab === "local" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[oklch(0.661_0.201_41.38)]" />}
          </button>
          {auth.authenticated && (
            <button
              onClick={() => setActiveTab("registry")}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === "registry" ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              Registry
              {activeTab === "registry" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[oklch(0.661_0.201_41.38)]" />}
            </button>
          )}
        </div>

        {/* Search + Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder={activeTab === "registry" ? "Search registry..." : "Search decks..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && activeTab === "registry") handleRegistrySearch() }}
              className="h-8 w-full rounded-lg border border-neutral-800 bg-neutral-900/50 pl-9 pr-3 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none transition-colors focus:border-neutral-600"
            />
          </div>
          {activeTab === "registry" && (
            <Button variant="outline" size="sm" onClick={handleRegistrySearch}>Search</Button>
          )}
          <div className="flex gap-1">
            {filterOptions.map((opt) => (
              <Button
                key={opt.type}
                variant={activeFilter === opt.type ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveFilter(opt.type)}
              >
                {opt.icon}
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        {activeTab === "local" ? (
          loading ? (
            <LoadingSpinner />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchDecks} />
          ) : filteredDecks.length === 0 ? (
            <EmptyState
              title={searchQuery ? "No matching decks" : "No decks yet"}
              subtitle={searchQuery ? "Try a different search term" : "Create a deck or install one from the Registry"}
            />
          ) : (
            <div className="grid gap-4 animate-fade-up" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", animationDelay: "0.15s" }}>
              {filteredDecks.map((deck) => (
                <DeckCard
                  key={deck.slug}
                  deck={deck}
                  isActive={isDeckActive(deck.slug)}
                  syncInfo={getSyncInfo(deck.slug)}
                  onClone={() => setShowCloneDialog(deck.slug)}
                  onPush={auth.authenticated ? () => pushDeck(deck.slug) : undefined}
                  onPull={auth.authenticated ? () => pullDeck(deck.slug) : undefined}
                  syncing={syncing === deck.slug}
                />
              ))}
            </div>
          )
        ) : (
          registry.loading ? (
            <LoadingSpinner />
          ) : registry.error ? (
            <ErrorState message={registry.error} />
          ) : registry.items.length === 0 ? (
            <EmptyState title="No items found" subtitle="Try a different search or filter" />
          ) : (
            <div className="grid gap-4 animate-fade-up" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", animationDelay: "0.15s" }}>
              {registry.items.map((item) => (
                <RegistryItemCard
                  key={item.name}
                  item={item}
                  installing={installingName === item.name}
                  onInstall={() => handleInstall(item)}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Create Deck Dialog */}
      {showCreateDialog && (
        <SimpleDialog
          title="Create New Deck"
          placeholder="my-presentation"
          actionLabel="Create"
          loading={creating}
          onSubmit={handleCreateDeck}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {/* Clone Deck Dialog */}
      {showCloneDialog && (
        <SimpleDialog
          title={`Clone "${showCloneDialog}"`}
          placeholder={`${showCloneDialog}-copy`}
          actionLabel="Clone"
          loading={creating}
          onSubmit={(name) => handleCloneDeck(showCloneDialog, name)}
          onClose={() => setShowCloneDialog(null)}
        />
      )}
    </AppShell>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="size-6 animate-spin rounded-full border-2 border-neutral-700 border-t-[oklch(0.661_0.201_41.38)]" />
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Layers className="mb-3 size-10 text-neutral-700" />
      <p className="text-sm text-neutral-400">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">Try again</Button>}
    </div>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <Layers className="mb-3 size-10 text-neutral-700" />
      <p className="text-sm font-medium text-neutral-300">{title}</p>
      <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
    </div>
  )
}

function SimpleDialog({
  title, placeholder, actionLabel, loading, onSubmit, onClose
}: {
  title: string; placeholder: string; actionLabel: string
  loading: boolean; onSubmit: (value: string) => void; onClose: () => void
}) {
  const [value, setValue] = useState(placeholder)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-96 rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit(value.trim()) }}
          placeholder={placeholder}
          autoFocus
          className="mt-4 h-9 w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 text-sm text-neutral-200 outline-none focus:border-neutral-500"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => value.trim() && onSubmit(value.trim())} disabled={loading || !value.trim()}>
            {loading ? <Loader2 className="size-3 animate-spin" /> : null}
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function RegistryItemCard({ item, installing, onInstall }: { item: RegistryItem; installing: boolean; onInstall: () => void }) {
  const [opening, setOpening] = useState(false)

  async function handleOpen() {
    setOpening(true)
    // Pull to local, then navigate to Studio
    try {
      const res = await fetch("/__promptslide_api/sync/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: item.name })
      })
      if (!res.ok) throw new Error("Pull failed")
      const data = await res.json()
      // Navigate to the deck in Studio
      window.location.href = `/${data.slug || item.name.split("/")[0]}`
    } catch {
      // Fallback: just install
      onInstall()
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80 transition-all hover:border-[oklch(0.661_0.201_41.38/0.3)] cursor-pointer" onClick={handleOpen}>
      <div className="relative aspect-video bg-neutral-900 overflow-hidden">
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800">
          {opening ? (
            <Loader2 className="size-8 animate-spin text-[oklch(0.661_0.201_41.38)]" />
          ) : (
            <Layers className="size-10 text-neutral-700" />
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-neutral-100">{item.title}</span>
          <Badge variant="outline">{item.type}</Badge>
        </div>
        {item.description && <p className="line-clamp-2 text-xs text-neutral-500">{item.description}</p>}
        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
          {item.author && <span>{item.author}</span>}
          {item.downloads != null && <span>{item.downloads} downloads</span>}
        </div>
      </div>
    </div>
  )
}
