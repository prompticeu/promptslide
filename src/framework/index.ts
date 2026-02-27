// Types
export type {
  SlideProps,
  SlideComponent,
  SlideConfig,
  NavigationDirection
} from "./types"

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
export type {
  UseSlideNavigationOptions,
  UseSlideNavigationReturn
} from "./use-slide-navigation"

// Layout (legacy)
export { SlideLayout, SlideBrandingProvider, useBranding } from "./slide-layout"
export type { SlideBranding } from "./slide-layout"

// Theme
export { SlideThemeProvider, useTheme } from "./theme-context"
export type {
  ThemeConfig,
  ThemeLogos,
  ThemeColors,
  ThemeAssets,
  ThemeFonts,
  LayoutBaseProps
} from "./types"

// Layouts
export { ContentLayout } from "./layouts/content-layout"
export { TitleLayout } from "./layouts/title-layout"
export { SectionLayout } from "./layouts/section-layout"
export { TwoColumnLayout } from "./layouts/two-column-layout"
export { ImageLayout } from "./layouts/image-layout"
export { QuoteLayout } from "./layouts/quote-layout"
export { SlideFooter } from "./layouts/shared-footer"
