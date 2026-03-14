import { useCallback, useEffect, useState } from "react"
import { fetchAnnotations, saveAnnotations } from "./api"
import type { Annotation, AnnotationTarget } from "./types"

export function useAnnotations() {
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  // Load on mount
  useEffect(() => {
    fetchAnnotations().then(setAnnotations)
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
      setAnnotations(prev => {
        const next = [...prev, annotation]
        saveAnnotations(next)
        return next
      })
    },
    []
  )

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => {
      const next = prev.filter(a => a.id !== id)
      saveAnnotations(next)
      return next
    })
  }, [])

  const getSlideAnnotations = useCallback(
    (slideIndex: number) => annotations.filter(a => a.slideIndex === slideIndex),
    [annotations]
  )

  const openCount = annotations.filter(a => a.status === "open").length

  return { annotations, addAnnotation, deleteAnnotation, getSlideAnnotations, openCount }
}
