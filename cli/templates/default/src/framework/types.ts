/**
 * Shared types for the slide deck framework.
 */

// =============================================================================
// SLIDE CONFIGURATION TYPES
// =============================================================================

/**
 * Props that all slide components receive.
 */
export interface SlideProps {
  slideNumber: number
  totalSlides: number
}

/**
 * A React component that renders a slide.
 */
export type SlideComponent = React.ComponentType<SlideProps>

/**
 * Configuration for a single slide including its animation step count.
 * The `steps` property declares how many animation steps the slide has,
 * eliminating the need for runtime step discovery.
 */
export interface SlideConfig {
  /** The slide component to render */
  component: SlideComponent
  /** Number of animation steps (0 = no animations). This is the max step number used in <Animated step={N}> */
  steps: number
}

// =============================================================================
// NAVIGATION TYPES
// =============================================================================

/**
 * Direction of slide navigation.
 * - 1: Forward (next slide)
 * - -1: Backward (previous slide)
 * - 0: Direct jump (no direction)
 */
export type NavigationDirection = -1 | 0 | 1
