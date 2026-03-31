import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createHttpAdapter } from "./adapters/http"
import type { Annotation, AnnotationStorageAdapter, AnnotationTarget } from "./types"

export function useAnnotations(adapter?: AnnotationStorageAdapter) {
  const adapterRef = useRef(adapter ?? createHttpAdapter())
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  // Load on mount and subscribe to external updates
  useEffect(() => {
    adapterRef.current.load().then(setAnnotations)
    return adapterRef.current.subscribe?.(setAnnotations)
  }, [])

  const addAnnotation = useCallback(
    (slideIndex: number, slideTitle: string, target: AnnotationTarget, body: string) => {
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        slideIndex,
        slideTitle,
        target,
        body,
        createdAt: new Date().toISOString(),
        status: "open"
      }
      setAnnotations(prev => [...prev, annotation])
      adapterRef.current.add(annotation)
    },
    []
  )

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
    adapterRef.current.remove(id)
  }, [])

  const getSlideAnnotations = useCallback(
    (slideIndex: number) => annotations.filter(a => a.slideIndex === slideIndex),
    [annotations]
  )

  const openCount = useMemo(() => annotations.filter(a => a.status === "open").length, [annotations])

  // Allow external state updates (e.g. from postMessage adapter)
  const updateAnnotations = useCallback((updated: Annotation[]) => {
    setAnnotations(updated)
  }, [])

  return { annotations, addAnnotation, deleteAnnotation, getSlideAnnotations, openCount, updateAnnotations }
}
