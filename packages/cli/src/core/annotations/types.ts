/**
 * Types for the slide annotation system.
 * Annotations are stored as a JSON file in the project root
 * and read by coding agents to act on user feedback.
 */

export interface AnnotationTarget {
  /** User-assigned data-annotate value, if present on the element */
  dataAnnotate?: string
  /** CSS selector path from slide root */
  selector: string
  /** Truncated text content of the element (first 100 chars) */
  textContent?: string
  /** Fallback coordinates as percentage of slide dimensions */
  position: { xPercent: number; yPercent: number }
}

export interface Annotation {
  /** Unique identifier */
  id: string
  /** Slide index (0-based, matching deck-config order) */
  slideIndex: number
  /** Slide title from SlideConfig (informational, for agent readability) */
  slideTitle: string
  /** Target element identification */
  target: AnnotationTarget
  /** The user's feedback text */
  body: string
  /** ISO 8601 timestamp */
  createdAt: string
  /** open = needs attention, resolved = agent addressed it */
  status: "open" | "resolved"
  /** Agent's note when resolving */
  resolution?: string
}

export interface AnnotationsFile {
  version: 1
  annotations: Annotation[]
}
