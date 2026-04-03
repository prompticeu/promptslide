import { useState, useEffect, useCallback, useRef } from "react"

export interface SyncInfo {
  slug: string
  remoteSlug?: string
  lastPushed?: string
  lastPulled?: string
  localModified?: string
  status: "synced" | "modified" | "pushing" | "pulling" | "error" | "unlinked"
  error?: string
}

/**
 * Auto-sync hook: watches for file changes via SSE and tracks sync state
 * per deck. Optionally auto-pushes changes after a debounce period.
 */
export function useAutoSync(options: { autoPush?: boolean; debounceMs?: number } = {}) {
  const { autoPush = false, debounceMs = 10000 } = options
  const [syncMap, setSyncMap] = useState<Map<string, SyncInfo>>(new Map())
  const [syncing, setSyncing] = useState<string | null>(null)
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const authRef = useRef<boolean>(false)

  // Check auth on mount
  useEffect(() => {
    fetch("/__promptslide_api/auth/status")
      .then(r => r.json())
      .then(d => { authRef.current = d.authenticated })
      .catch(() => {})
  }, [])

  // Load sync metadata for all decks on mount
  useEffect(() => {
    loadSyncState()
  }, [])

  async function loadSyncState() {
    try {
      const res = await fetch("/__promptslide_api/sync/status")
      if (!res.ok) return
      const data = await res.json()
      const map = new Map<string, SyncInfo>()
      for (const info of data.decks || []) {
        map.set(info.slug, info)
      }
      setSyncMap(map)
    } catch {}
  }

  // Listen for file changes via SSE
  useEffect(() => {
    const es = new EventSource("/__promptslide_api/events")

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (!data.deckSlug || data.type === "connected") return

        // Mark deck as modified
        setSyncMap(prev => {
          const next = new Map(prev)
          const existing = next.get(data.deckSlug)
          if (existing && existing.status !== "pushing" && existing.status !== "pulling") {
            next.set(data.deckSlug, {
              ...existing,
              status: "modified",
              localModified: new Date().toISOString()
            })
          }
          return next
        })

        // Debounced auto-push
        if (autoPush && authRef.current) {
          const existing = debounceTimers.current.get(data.deckSlug)
          if (existing) clearTimeout(existing)
          debounceTimers.current.set(
            data.deckSlug,
            setTimeout(() => {
              pushDeck(data.deckSlug)
              debounceTimers.current.delete(data.deckSlug)
            }, debounceMs)
          )
        }
      } catch {}
    }

    return () => {
      es.close()
      for (const t of debounceTimers.current.values()) clearTimeout(t)
    }
  }, [autoPush, debounceMs])

  const pushDeck = useCallback(async (slug: string) => {
    setSyncing(slug)
    setSyncMap(prev => {
      const next = new Map(prev)
      const existing = next.get(slug) || { slug, status: "pushing" as const }
      next.set(slug, { ...existing, status: "pushing" })
      return next
    })

    try {
      const res = await fetch("/__promptslide_api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug })
      })
      const data = await res.json()

      setSyncMap(prev => {
        const next = new Map(prev)
        if (res.ok) {
          next.set(slug, {
            slug,
            remoteSlug: slug,
            lastPushed: new Date().toISOString(),
            status: "synced"
          })
        } else {
          const existing = next.get(slug) || { slug, status: "error" as const }
          next.set(slug, { ...existing, status: "error", error: data.error })
        }
        return next
      })

      // Persist sync state
      if (res.ok) {
        await fetch("/__promptslide_api/sync/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, action: "pushed" })
        }).catch(() => {})
      }
    } catch (err) {
      setSyncMap(prev => {
        const next = new Map(prev)
        next.set(slug, { slug, status: "error", error: "Push failed" })
        return next
      })
    } finally {
      setSyncing(null)
    }
  }, [])

  const pullDeck = useCallback(async (slug: string) => {
    setSyncing(slug)
    setSyncMap(prev => {
      const next = new Map(prev)
      const existing = next.get(slug) || { slug, status: "pulling" as const }
      next.set(slug, { ...existing, status: "pulling" })
      return next
    })

    try {
      const res = await fetch("/__promptslide_api/sync/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug })
      })

      setSyncMap(prev => {
        const next = new Map(prev)
        if (res.ok) {
          next.set(slug, {
            slug,
            remoteSlug: slug,
            lastPulled: new Date().toISOString(),
            status: "synced"
          })
        } else {
          const existing = next.get(slug) || { slug, status: "error" as const }
          next.set(slug, { ...existing, status: "error" })
        }
        return next
      })
    } catch {
      setSyncMap(prev => {
        const next = new Map(prev)
        next.set(slug, { slug, status: "error", error: "Pull failed" })
        return next
      })
    } finally {
      setSyncing(null)
    }
  }, [])

  const getSyncInfo = useCallback((slug: string): SyncInfo => {
    return syncMap.get(slug) || { slug, status: "unlinked" }
  }, [syncMap])

  return { syncMap, syncing, pushDeck, pullDeck, getSyncInfo, loadSyncState }
}
