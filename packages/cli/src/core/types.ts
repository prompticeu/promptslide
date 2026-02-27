/**
 * Shared types for the slide deck framework.
 */

import type { SlideTransitionType } from "./transitions"

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
  /** Display name for grid view thumbnails, navigation, and accessibility */
  title?: string
  /** Speaker notes (not rendered on slide, shown in notes panel) */
  notes?: string
  /** Per-slide transition override (falls back to deck-level transition) */
  transition?: SlideTransitionType
  /** Section/chapter name for grouping slides in grid view */
  section?: string
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

// =============================================================================
// THEME CONFIGURATION TYPES
// =============================================================================

/**
 * Logo variants for different contexts.
 */
export interface ThemeLogos {
  /** Full logo (default, used in footers) */
  full?: string
  /** Icon-only mark (used in compact spaces) */
  icon?: string
  /** Light version for dark backgrounds */
  fullLight?: string
  /** Light icon for dark backgrounds */
  iconLight?: string
}

/**
 * Brand color overrides using OKLCH strings.
 * Injected as CSS custom properties at runtime.
 * If omitted, the existing globals.css values apply.
 */
export interface ThemeColors {
  primary?: string
  primaryForeground?: string
  secondary?: string
  secondaryForeground?: string
  accent?: string
  accentForeground?: string
}

/**
 * Corporate visual assets (paths relative to public/).
 */
export interface ThemeAssets {
  /** Background image URL (e.g. for title slides) */
  backgroundImage?: string
  /** Subtle pattern overlay URL */
  patternImage?: string
}

/**
 * Typography preferences. Font names must be loaded via
 * <link> in index.html or @font-face in globals.css.
 */
export interface ThemeFonts {
  heading?: string
  body?: string
}

/**
 * Full theme configuration.
 */
export interface ThemeConfig {
  /** Company/product name (shown in footers) */
  name: string
  /** Optional tagline */
  tagline?: string
  /** Logo configuration */
  logo?: ThemeLogos
  /** Brand color overrides (OKLCH strings) */
  colors?: ThemeColors
  /** Corporate visual assets */
  assets?: ThemeAssets
  /** Typography preferences */
  fonts?: ThemeFonts
}

// =============================================================================
// LAYOUT BASE PROPS
// =============================================================================

/**
 * Base props shared by all layout components.
 */
export interface LayoutBaseProps extends SlideProps {
  children?: React.ReactNode
  hideFooter?: boolean
  className?: string
}
