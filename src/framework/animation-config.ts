/**
 * Centralized animation configuration for the slide deck framework.
 * All animation timings, easings, and spring configs are defined here.
 */

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

/** Duration for slide-to-slide transitions (seconds) */
export const SLIDE_TRANSITION_DURATION = 0.3

/** Duration for morph/layout animations between slides (seconds) */
export const MORPH_DURATION = 0.8

/** Duration for within-slide step animations (seconds) */
export const STEP_ANIMATION_DURATION = 0.4

/** Default stagger delay for grouped animations (seconds) */
export const STAGGER_DELAY = 0.1

// =============================================================================
// EASING PRESETS
// =============================================================================

export const EASE_DEFAULT = "easeInOut" as const
export const EASE_OUT = "easeOut" as const
export const EASE_IN = "easeIn" as const

/** Smooth ease-in-out curve for morph animations (cubic bezier) */
export const EASE_MORPH = [0.4, 0, 0.2, 1] as const

// =============================================================================
// SPRING CONFIGURATIONS
// =============================================================================

/** Spring config for snappy, responsive animations */
export const SPRING_SNAPPY = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30
}

/** Spring config for smooth, gentle animations */
export const SPRING_SMOOTH = {
  type: "spring" as const,
  stiffness: 200,
  damping: 25
}

/** Spring config for bouncy animations */
export const SPRING_BOUNCY = {
  type: "spring" as const,
  stiffness: 400,
  damping: 20
}

// =============================================================================
// TRANSITION PRESETS
// =============================================================================

/** Standard transition for slide transitions */
export const SLIDE_TRANSITION = {
  duration: SLIDE_TRANSITION_DURATION,
  ease: EASE_DEFAULT
} as const

/** Standard transition for morph animations (smooth ease-in-out) */
export const MORPH_TRANSITION = {
  duration: MORPH_DURATION,
  ease: EASE_MORPH
}

/** Standard transition for step animations (spring-based, duration computed from stiffness/damping) */
export const STEP_TRANSITION = {
  ...SPRING_SNAPPY
}

// =============================================================================
// DISTANCE CONSTANTS (pixels)
// =============================================================================

/** Distance for slide animations */
export const SLIDE_DISTANCE = 100

/** Distance for within-slide element animations */
export const ELEMENT_SLIDE_DISTANCE = 30

// =============================================================================
// SLIDE DIMENSIONS
// =============================================================================

/** Standard slide dimensions (16:9 aspect ratio) */
export const SLIDE_DIMENSIONS = {
  width: 1280,
  height: 720,
  aspectRatio: 16 / 9
} as const
