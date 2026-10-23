import type { LoopConfig, SlideConfig } from "../types"
export const DEFAULT_LOOP_CONFIG: LoopConfig
export function validateLoopConfig(value: unknown): LoopConfig
export function validDuration(value: unknown): boolean
export function loopSlideKey(slide: Pick<SlideConfig, "id">, index: number): string
export function stateDuration(
  config: LoopConfig,
  slide: Pick<SlideConfig, "id">,
  index: number,
  step: number
): number
export function includedSlides(config: LoopConfig, slides: SlideConfig[]): number[]
export function loopDuration(config: LoopConfig, slides: SlideConfig[]): number
