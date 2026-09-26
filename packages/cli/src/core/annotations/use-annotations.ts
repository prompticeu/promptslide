import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { SlideConfig } from "../types"
import type { Annotation, AnnotationStorageAdapter, AnnotationTarget } from "./types"

import { createHttpAdapter } from "./adapters/http"

export function useAnnotations(
  slidesOrAdapter?: SlideConfig[] | AnnotationStorageAdapter,
  adapter?: AnnotationStorageAdapter
) {
  const slides = Array.isArray(slidesOrAdapter) ? slidesOrAdapter : undefined
  const storage = Array.isArray(slidesOrAdapter) ? adapter : (slidesOrAdapter ?? adapter)
  const adapterRef = useRef(storage ?? createHttpAdapter())
  const slidesRef = useRef(slides)
  slidesRef.current = slides
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  // Load on mount and subscribe to external updates
  useEffect(() => {
    adapterRef.current.load().then(loaded => {
      const configuredSlides = slidesRef.current
      const migrated = loaded.map(annotation => {
        if (annotation.slideId || !configuredSlides) return annotation
        const id = configuredSlides[annotation.slideIndex]?.id
        return id ? { ...annotation, slideId: id } : annotation
      })
      setAnnotations(migrated)
      if (migrated.some((annotation, index) => annotation !== loaded[index])) {
        void adapterRef.current.replaceAll?.(migrated)
      }
    })
    return adapterRef.current.subscribe?.(setAnnotations)
  }, [])

  const addAnnotation = useCallback(
    (
      slideIndex: number,
      slideTitle: string,
      target: AnnotationTarget,
      body: string,
      slideId?: string
    ) => {
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        slideIndex,
        ...(slideId && { slideId }),
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

  const updateAnnotation = useCallback(
    (id: string, patch: Partial<Pick<Annotation, "body" | "status">>) => {
      const current = annotations.find(a => a.id === id)
      if (!current) return
      const updated = { body: patch.body ?? current.body, status: patch.status ?? current.status }
      setAnnotations(prev => prev.map(a => (a.id === id ? { ...a, ...updated } : a)))
      void adapterRef.current.update?.(id, updated)
    },
    [annotations]
  )

  const getSlideAnnotations = useCallback(
    (slideIndex: number) => annotations.filter(a => a.slideIndex === slideIndex),
    [annotations]
  )

  const openCount = useMemo(
    () => annotations.filter(a => a.status === "open").length,
    [annotations]
  )

  // Allow external state updates (e.g. from postMessage adapter)
  const updateAnnotations = useCallback((updated: Annotation[]) => {
    setAnnotations(updated)
  }, [])

  return {
    annotations,
    addAnnotation,
    deleteAnnotation,
    updateAnnotation,
    getSlideAnnotations,
    openCount,
    updateAnnotations
  }
}
