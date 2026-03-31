import type { Annotation, AnnotationsFile, AnnotationStorageAdapter } from "../types"

const ENDPOINT = "/__promptslide_annotations"

async function loadAll(): Promise<Annotation[]> {
  try {
    const res = await fetch(ENDPOINT)
    if (!res.ok) return []
    const data: AnnotationsFile = await res.json()
    return data.annotations || []
  } catch {
    return []
  }
}

async function saveAll(annotations: Annotation[]): Promise<void> {
  const data: AnnotationsFile = { version: 1, annotations }
  await fetch(ENDPOINT, {
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
