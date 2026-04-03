import { useState, useEffect, useCallback, useRef } from "react"

interface FileEvent {
  type: "change" | "add" | "unlink"
  deckSlug: string
  file: string
}

export function useFileEvents() {
  const [activeDecks, setActiveDecks] = useState<Map<string, number>>(new Map())
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const es = new EventSource("/__promptslide_api/events")

    es.onmessage = (e) => {
      try {
        const data: FileEvent = JSON.parse(e.data)
        if (!data.deckSlug) return

        setActiveDecks((prev) => {
          const next = new Map(prev)
          next.set(data.deckSlug, Date.now())
          return next
        })

        // Clear activity after 3 seconds of no changes
        const existing = timeoutsRef.current.get(data.deckSlug)
        if (existing) clearTimeout(existing)
        timeoutsRef.current.set(
          data.deckSlug,
          setTimeout(() => {
            setActiveDecks((prev) => {
              const next = new Map(prev)
              next.delete(data.deckSlug)
              return next
            })
            timeoutsRef.current.delete(data.deckSlug)
          }, 3000)
        )
      } catch {}
    }

    return () => {
      es.close()
      for (const t of timeoutsRef.current.values()) clearTimeout(t)
    }
  }, [])

  const isDeckActive = useCallback(
    (slug: string) => activeDecks.has(slug),
    [activeDecks]
  )

  return { activeDecks, isDeckActive }
}
