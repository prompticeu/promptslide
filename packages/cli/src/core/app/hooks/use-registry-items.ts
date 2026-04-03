import { useState, useCallback } from "react"

export interface RegistryItem {
  name: string
  type: string
  title: string
  description?: string
  author?: string
  downloads?: number
  steps?: number
}

export function useRegistryItems() {
  const [items, setItems] = useState<RegistryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async (search?: string, type?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (type && type !== "all") params.set("type", type)

      const res = await fetch(`/__promptslide_api/registry/items?${params}`)
      if (res.status === 401) {
        setError("Not authenticated")
        setItems([])
        return
      }
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)

      const data = await res.json()
      setItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  const installItem = useCallback(async (slug: string): Promise<boolean> => {
    try {
      const res = await fetch(`/__promptslide_api/registry/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      if (!res.ok) throw new Error(`Install failed: ${res.status}`)
      return true
    } catch {
      return false
    }
  }, [])

  return { items, loading, error, fetchItems, installItem }
}
