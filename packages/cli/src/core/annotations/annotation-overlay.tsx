import { useCallback, useEffect, useRef, useState } from "react"
import type { SlideConfig } from "../types"
import { AnnotationForm } from "./annotation-form"
import { AnnotationPin } from "./annotation-pin"
import { buildElementTarget, resolveTarget } from "./selectors"
import type { Annotation, AnnotationTarget } from "./types"

interface AnnotationOverlayProps {
  slides: SlideConfig[]
  currentSlide: number
  /** Ref to the slide container element (the div wrapping SlideRenderer) */
  slideContainerRef: React.RefObject<HTMLDivElement | null>
  selectedId: string | null
  onSelectId: (id: string | null) => void
  onShowPanel: () => void
  slideAnnotations: Annotation[]
  addAnnotation: (slideIndex: number, slideTitle: string, target: AnnotationTarget, body: string) => void
}

interface PendingAnnotation {
  target: AnnotationTarget
  xPercent: number
  yPercent: number
}

export function AnnotationOverlay({ slides, currentSlide, slideContainerRef, selectedId, onSelectId, onShowPanel, slideAnnotations, addAnnotation }: AnnotationOverlayProps) {
  const [pending, setPending] = useState<PendingAnnotation | null>(null)
  const [hoveredElement, setHoveredElement] = useState<DOMRect | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const slideTitle = slides[currentSlide]?.title || `Slide ${currentSlide + 1}`

  // Resolve annotation positions — use the element if found, otherwise fallback coordinates
  const resolvedAnnotations = slideAnnotations.map((a, i) => {
    const container = slideContainerRef.current
    if (!container) {
      return { annotation: a, xPercent: a.target.position.xPercent, yPercent: a.target.position.yPercent, number: i + 1 }
    }

    const { element } = resolveTarget(a.target, container)
    if (element) {
      const rect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const xPercent = ((rect.left + rect.width / 2 - containerRect.left) / containerRect.width) * 100
      const yPercent = ((rect.top + rect.height / 2 - containerRect.top) / containerRect.height) * 100
      return { annotation: a, xPercent, yPercent, number: i + 1 }
    }

    return { annotation: a, xPercent: a.target.position.xPercent, yPercent: a.target.position.yPercent, number: i + 1 }
  })

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      const container = slideContainerRef.current
      if (!container) return

      // Get the element under the click by temporarily hiding the overlay
      const overlay = overlayRef.current
      if (overlay) overlay.style.pointerEvents = "none"
      const elementUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      if (overlay) overlay.style.pointerEvents = ""

      if (!elementUnder || !container.contains(elementUnder)) {
        setPending(null)
        onSelectId(null)
        return
      }

      // Pick the most specific meaningful element (skip tiny text nodes, pick their parent)
      let target = elementUnder
      if (target.tagName === "SPAN" && target.parentElement && container.contains(target.parentElement)) {
        // For inline spans, prefer their parent for a more meaningful target
        const parent = target.parentElement
        if (parent.tagName !== "DIV" || parent.children.length <= 3) {
          target = parent
        }
      }

      const annotationTarget = buildElementTarget(target, container)
      const containerRect = container.getBoundingClientRect()
      const xPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100
      const yPercent = ((e.clientY - containerRect.top) / containerRect.height) * 100

      setPending({ target: annotationTarget, xPercent, yPercent })
      onSelectId(null)
    },
    [slideContainerRef, onSelectId]
  )

  const handleSubmit = useCallback(
    (text: string) => {
      if (!pending) return
      addAnnotation(currentSlide, slideTitle, pending.target, text)
      setPending(null)
      onShowPanel()
    },
    [pending, currentSlide, slideTitle, addAnnotation, onShowPanel]
  )

  // Track hover for element highlighting
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (pending) {
        setHoveredElement(null)
        return
      }

      const container = slideContainerRef.current
      if (!container) return

      const overlay = overlayRef.current
      if (overlay) overlay.style.pointerEvents = "none"
      const elementUnder = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      if (overlay) overlay.style.pointerEvents = ""

      if (elementUnder && container.contains(elementUnder) && elementUnder !== container) {
        const containerRect = container.getBoundingClientRect()
        const elRect = elementUnder.getBoundingClientRect()
        setHoveredElement(
          new DOMRect(
            elRect.left - containerRect.left,
            elRect.top - containerRect.top,
            elRect.width,
            elRect.height
          )
        )
      } else {
        setHoveredElement(null)
      }
    },
    [slideContainerRef, pending]
  )

  // Clear pending when slide changes
  useEffect(() => {
    setPending(null)
    onSelectId(null)
    setHoveredElement(null)
  }, [currentSlide, onSelectId])

  return (
    <>
      {/* Hover highlight */}
      {hoveredElement && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border-2 border-dashed border-[#FF6B35]/50 bg-[#FF6B35]/5"
          style={{
            left: hoveredElement.x,
            top: hoveredElement.y,
            width: hoveredElement.width,
            height: hoveredElement.height
          }}
        />
      )}

      {/* Click capture overlay */}
      <div
        ref={overlayRef}
        role="button"
        tabIndex={0}
        className="absolute inset-0 z-20"
        style={{ cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='none'%3E%3Ccircle cx='12' cy='12' r='8' stroke='%23FF6B35' stroke-width='2' opacity='0.8'/%3E%3Ccircle cx='12' cy='12' r='2' fill='%23FF6B35'/%3E%3C/svg%3E") 12 12, crosshair` }}
        onClick={handleOverlayClick}
        onKeyDown={e => { if (e.key === "Escape") { setPending(null); onSelectId(null) } }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredElement(null)}
      />

      {/* Annotation pins */}
      {resolvedAnnotations.map(({ annotation, xPercent, yPercent, number }) => (
        <AnnotationPin
          key={annotation.id}
          number={number}
          status={annotation.status}
          xPercent={xPercent}
          yPercent={yPercent}
          isSelected={annotation.id === selectedId}
          onClick={() => {
            onSelectId(annotation.id === selectedId ? null : annotation.id)
            onShowPanel()
            setPending(null)
          }}
        />
      ))}

      {/* New annotation form */}
      {pending && (
        <AnnotationForm
          xPercent={pending.xPercent}
          yPercent={pending.yPercent}
          onSubmit={handleSubmit}
          onCancel={() => setPending(null)}
        />
      )}

    </>
  )
}
