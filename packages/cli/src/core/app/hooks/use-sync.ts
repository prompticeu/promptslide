import { useState, useCallback } from "react"

interface SyncState {
  syncing: boolean
  lastSync: string | null
  error: string | null
}

export function useSync() {
  const [syncState, setSyncState] = useState<SyncState>({
    syncing: false,
    lastSync: null,
    error: null,
  })

  /**
   * Push a local deck to the Registry (publish).
   * Uses the CLI's publish flow under the hood.
   */
  const pushDeck = useCallback(async (slug: string): Promise<boolean> => {
    setSyncState({ syncing: true, lastSync: null, error: null })
    try {
      const res = await fetch("/__promptslide_api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Push failed" }))
        throw new Error(data.error || `Push failed: ${res.status}`)
      }
      setSyncState({ syncing: false, lastSync: new Date().toISOString(), error: null })
      return true
    } catch (err) {
      setSyncState({ syncing: false, lastSync: null, error: err instanceof Error ? err.message : "Push failed" })
      return false
    }
  }, [])

  /**
   * Pull latest version of a deck from the Registry to local.
   */
  const pullDeck = useCallback(async (slug: string): Promise<boolean> => {
    setSyncState({ syncing: true, lastSync: null, error: null })
    try {
      const res = await fetch("/__promptslide_api/sync/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Pull failed" }))
        throw new Error(data.error || `Pull failed: ${res.status}`)
      }
      setSyncState({ syncing: false, lastSync: new Date().toISOString(), error: null })
      return true
    } catch (err) {
      setSyncState({ syncing: false, lastSync: null, error: err instanceof Error ? err.message : "Pull failed" })
      return false
    }
  }, [])

  return { syncState, pushDeck, pullDeck }
}
