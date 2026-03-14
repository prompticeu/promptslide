import type { AnnotationTarget } from "./types"

/**
 * Build a composite target descriptor from a clicked DOM element.
 */
export function buildElementTarget(
  element: HTMLElement,
  slideRoot: HTMLElement
): AnnotationTarget {
  const rect = element.getBoundingClientRect()
  const rootRect = slideRoot.getBoundingClientRect()

  const xPercent = ((rect.left + rect.width / 2 - rootRect.left) / rootRect.width) * 100
  const yPercent = ((rect.top + rect.height / 2 - rootRect.top) / rootRect.height) * 100

  return {
    dataAnnotate: element.getAttribute("data-annotate") || undefined,
    contentNearPin: getTextFingerprint(element),
    position: { xPercent, yPercent }
  }
}

/**
 * Resolve a stored target back to a DOM element, trying strategies in priority order.
 */
export function resolveTarget(
  target: AnnotationTarget,
  slideRoot: HTMLElement
): { element: HTMLElement | null; method: "dataAnnotate" | "contentNearPin" | "position" } {
  // 1. Try data-annotate attribute
  if (target.dataAnnotate) {
    const el = slideRoot.querySelector<HTMLElement>(`[data-annotate="${target.dataAnnotate}"]`)
    if (el) return { element: el, method: "dataAnnotate" }
  }

  // 2. Try text content match
  if (target.contentNearPin) {
    const match = findByTextContent(slideRoot, target.contentNearPin)
    if (match) return { element: match, method: "contentNearPin" }
  }

  // 3. Fallback to coordinates (no element found)
  return { element: null, method: "position" }
}

/**
 * Extract a text fingerprint from an element (first 100 chars, trimmed).
 */
function getTextFingerprint(element: HTMLElement): string | undefined {
  const text = element.textContent?.trim()
  if (!text) return undefined
  return text.slice(0, 100)
}

/**
 * Find an element by matching its text content.
 */
function findByTextContent(root: HTMLElement, text: string): HTMLElement | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let best: HTMLElement | null = null
  let bestLength = Infinity

  while (walker.nextNode()) {
    const el = walker.currentNode as HTMLElement
    const elText = el.textContent?.trim()
    if (!elText) continue

    const elFingerprint = elText.slice(0, 100)
    if (elFingerprint === text && elText.length < bestLength) {
      best = el
      bestLength = elText.length
    }
  }

  return best
}
