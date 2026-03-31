import type { Annotation, AnnotationsFile } from "./types"

const ENDPOINT = "/__promptslide_annotations"

export async function fetchAnnotations(): Promise<Annotation[]> {
  try {
    const res = await fetch(ENDPOINT)
    if (!res.ok) return []
    const data: AnnotationsFile = await res.json()
    return data.annotations || []
  } catch {
    return []
  }
}

export async function saveAnnotations(annotations: Annotation[]): Promise<void> {
  const data: AnnotationsFile = { version: 1, annotations }
  await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
}
