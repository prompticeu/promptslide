// Types
export type { SlideProps, SlideComponent, SlideConfig, NavigationDirection } from "./types"

// Animation Config
export {
  SLIDE_TRANSITION_DURATION,
  MORPH_DURATION,
  STEP_ANIMATION_DURATION,
  STAGGER_DELAY,
  EASE_DEFAULT,
  EASE_OUT,
  EASE_IN,
  EASE_MORPH,
  SPRING_SNAPPY,
  SPRING_SMOOTH,
  SPRING_BOUNCY,
  SLIDE_TRANSITION,
  MORPH_TRANSITION,
  STEP_TRANSITION,
  SLIDE_DISTANCE,
  ELEMENT_SLIDE_DISTANCE,
  SLIDE_DIMENSIONS
} from "./animation-config"

// Animation Context
export { AnimationProvider, useAnimationContext } from "./animation-context"

// Animated Components
export { Animated, AnimatedGroup } from "./animated"
export type { AnimationType } from "./animated"

// Transitions
export {
  SLIDE_VARIANTS,
  createDirectionalVariants,
  directionalSlideX,
  directionalSlideY,
  getSlideVariants,
  getSlideTransition,
  DEFAULT_SLIDE_TRANSITION
} from "./transitions"
export type { SlideTransitionType, SlideTransitionConfig } from "./transitions"

// Morph
export { Morph, MorphGroup, MorphItem, MorphText } from "./morph"

// Navigation Hook
export { useSlideNavigation } from "./use-slide-navigation"
export type { UseSlideNavigationOptions, UseSlideNavigationReturn } from "./use-slide-navigation"

// Branding
export { SlideBrandingProvider, useBranding } from "./branding"
export type { SlideBranding } from "./branding"

// SlideDeck
export { SlideDeck } from "./slide-deck"

// Error Boundary
export { SlideErrorBoundary } from "./slide-error-boundary"

// Utils
export { cn } from "./utils"
