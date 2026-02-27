/**
 * Slide transition variants for the slide deck framework.
 * These define how slides enter and exit during navigation.
 */

import type { Variants } from "framer-motion"

import {
  EASE_MORPH,
  MORPH_DURATION,
  SLIDE_DISTANCE,
  SLIDE_TRANSITION,
  SLIDE_TRANSITION_DURATION
} from "./animation-config"

// =============================================================================
// TYPES
// =============================================================================

export type SlideTransitionType =
  | "fade"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "zoom"
  | "zoom-fade"
  | "morph"
  | "none"

export interface SlideTransitionConfig {
  /** The transition type */
  type: SlideTransitionType
  /** Optional custom duration (overrides default) */
  duration?: number
  /** Whether to use directional transitions based on navigation direction */
  directional?: boolean
}

// =============================================================================
// STATIC VARIANTS (non-directional)
// =============================================================================

const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 }
}

const slideLeftVariants: Variants = {
  enter: { x: SLIDE_DISTANCE, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -SLIDE_DISTANCE, opacity: 0 }
}

const slideRightVariants: Variants = {
  enter: { x: -SLIDE_DISTANCE, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: SLIDE_DISTANCE, opacity: 0 }
}

const slideUpVariants: Variants = {
  enter: { y: SLIDE_DISTANCE, opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: -SLIDE_DISTANCE, opacity: 0 }
}

const slideDownVariants: Variants = {
  enter: { y: -SLIDE_DISTANCE, opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: SLIDE_DISTANCE, opacity: 0 }
}

const zoomVariants: Variants = {
  enter: { scale: 0.8, opacity: 0 },
  center: { scale: 1, opacity: 1 },
  exit: { scale: 1.2, opacity: 0 }
}

const zoomFadeVariants: Variants = {
  enter: { scale: 0.95, opacity: 0 },
  center: { scale: 1, opacity: 1 },
  exit: { scale: 1.05, opacity: 0 }
}

const morphVariants: Variants = {
  enter: {
    opacity: 0,
    zIndex: 1
  },
  center: {
    opacity: 1,
    zIndex: 1,
    transition: {
      opacity: { delay: 0.05, duration: 0.25 }
    }
  },
  exit: {
    opacity: 0,
    zIndex: 0,
    transition: {
      opacity: { duration: MORPH_DURATION, ease: EASE_MORPH }
    }
  }
}

const noneVariants: Variants = {
  enter: {},
  center: {},
  exit: {}
}

// =============================================================================
// VARIANT REGISTRY
// =============================================================================

export const SLIDE_VARIANTS: Record<SlideTransitionType, Variants> = {
  fade: fadeVariants,
  "slide-left": slideLeftVariants,
  "slide-right": slideRightVariants,
  "slide-up": slideUpVariants,
  "slide-down": slideDownVariants,
  zoom: zoomVariants,
  "zoom-fade": zoomFadeVariants,
  morph: morphVariants,
  none: noneVariants
}

// =============================================================================
// DIRECTIONAL VARIANTS (based on navigation direction)
// =============================================================================

export function createDirectionalVariants(
  axis: "x" | "y" = "x"
): (direction: number) => Variants {
  return (direction: number) => ({
    enter: {
      [axis]: direction > 0 ? SLIDE_DISTANCE : -SLIDE_DISTANCE,
      opacity: 0
    },
    center: {
      [axis]: 0,
      opacity: 1
    },
    exit: {
      [axis]: direction < 0 ? SLIDE_DISTANCE : -SLIDE_DISTANCE,
      opacity: 0
    }
  })
}

/** Horizontal directional slide (left/right based on direction) */
export const directionalSlideX = createDirectionalVariants("x")

/** Vertical directional slide (up/down based on direction) */
export const directionalSlideY = createDirectionalVariants("y")

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getSlideVariants(
  config: SlideTransitionConfig | SlideTransitionType,
  direction: number = 1
): Variants {
  const type = typeof config === "string" ? config : config.type
  const directional = typeof config === "object" ? config.directional : false

  if (directional && (type === "slide-left" || type === "slide-right")) {
    return directionalSlideX(direction)
  }

  if (directional && (type === "slide-up" || type === "slide-down")) {
    return directionalSlideY(direction)
  }

  return SLIDE_VARIANTS[type]
}

export function getSlideTransition(
  config?: SlideTransitionConfig | SlideTransitionType
): { duration: number; ease: typeof SLIDE_TRANSITION.ease } {
  if (!config) return SLIDE_TRANSITION

  const type = typeof config === "string" ? config : config.type

  const defaultDuration =
    type === "morph" ? MORPH_DURATION : SLIDE_TRANSITION_DURATION

  const duration =
    typeof config === "object" && config.duration
      ? config.duration
      : defaultDuration

  return {
    ...SLIDE_TRANSITION,
    duration
  }
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export const DEFAULT_SLIDE_TRANSITION: SlideTransitionType = "fade"
