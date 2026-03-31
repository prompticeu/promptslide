import type { Annotation, AnnotationsFile, AnnotationStorageAdapter } from "../types"

const BASE_ENDPOINT = "/__promptslide_annotations"

/**
 * Derive the deck slug from the current URL pathname.
 * In multi-deck mode the URL is `/:slug`, so the first path segment is the slug.
 * Returns null when running at the root (single-deck / legacy mode).
 */
function getDeckSlug(): string | null {
  if (typeof window === "undefined") return null
  const firstSegment = window.location.pathname.split("/").filter(Boolean)[0]
  return firstSegment || null
}

function getEndpoint(): string {
  const slug = getDeckSlug()
  return slug ? `${BASE_ENDPOINT}?deck=${encodeURIComponent(slug)}` : BASE_ENDPOINT
}

async function loadAll(): Promise<Annotation[]> {
  try {
    const res = await fetch(getEndpoint())
    if (!res.ok) return []
    const data: AnnotationsFile = await res.json()
    return data.annotations || []
  } catch {
    return []
  }
}

async function saveAll(annotations: Annotation[]): Promise<void> {
  const data: AnnotationsFile = { version: 1, annotations }
  await fetch(getEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
}

/** Storage adapter for local Vite dev server (reads/writes annotations.json via middleware) */
export function createHttpAdapter(): AnnotationStorageAdapter {
  let cache: Annotation[] = []

  return {
    async load() {
      cache = await loadAll()
      return cache
    },
    async add(annotation) {
      cache = [...cache, annotation]
      await saveAll(cache)
    },
    async remove(id) {
      cache = cache.filter(a => a.id !== id)
      await saveAll(cache)
    }
  }
}
