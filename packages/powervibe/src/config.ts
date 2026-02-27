import type { SlideConfig } from "./framework/types"
import type { SlideTransitionType } from "./framework/transitions"
import type { SlideBranding } from "./framework/slide-layout"

export interface DeckConfig {
  /** Slide list with step counts */
  slides: SlideConfig[]
  /** Branding info shown in slide footer */
  branding?: SlideBranding
  /** Slide transition type */
  transition?: SlideTransitionType
  /** Use directional transitions based on navigation direction */
  directionalTransition?: boolean
}

/**
 * Define your deck configuration. Used by `powervibe dev` to render your slides.
 *
 * ```ts
 * // deck.config.ts
 * import { defineConfig } from "powervibe/config"
 * import { SlideTitle } from "./src/slides/slide-title"
 *
 * export default defineConfig({
 *   branding: { name: "My Deck", logoUrl: "/logo.svg" },
 *   slides: [
 *     { component: SlideTitle, steps: 0 },
 *   ],
 * })
 * ```
 */
export function defineConfig(config: DeckConfig): DeckConfig {
  return config
}
