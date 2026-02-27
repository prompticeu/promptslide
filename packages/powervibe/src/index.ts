// Types
export type {
  SlideProps,
  SlideComponent,
  SlideConfig,
  NavigationDirection
} from "./framework/types"

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
} from "./framework/animation-config"

// Animation Context
export { AnimationProvider, useAnimationContext } from "./framework/animation-context"

// Animated Components
export { Animated, AnimatedGroup } from "./framework/animated"
export type { AnimationType } from "./framework/animated"

// Transitions
export {
  SLIDE_VARIANTS,
  createDirectionalVariants,
  directionalSlideX,
  directionalSlideY,
  getSlideVariants,
  getSlideTransition,
  DEFAULT_SLIDE_TRANSITION
} from "./framework/transitions"
export type { SlideTransitionType, SlideTransitionConfig } from "./framework/transitions"

// Morph
export { Morph, MorphGroup, MorphItem, MorphText } from "./framework/morph"

// Navigation Hook
export { useSlideNavigation } from "./framework/use-slide-navigation"
export type {
  UseSlideNavigationOptions,
  UseSlideNavigationReturn
} from "./framework/use-slide-navigation"

// Layout
export { SlideLayout, SlideBrandingProvider, useBranding } from "./framework/slide-layout"
export type { SlideBranding } from "./framework/slide-layout"

// Slide Deck Controller
export { SlideDeck } from "./components/slide-deck"

// Config
export { defineConfig } from "./config"
export type { DeckConfig } from "./config"

// Utils
export { cn } from "./lib/utils"
