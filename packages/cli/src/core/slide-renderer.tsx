import { AnimatePresence, motion } from "framer-motion"

import type { SlideTransitionType } from "./transitions"
import type { NavigationDirection, SlideConfig } from "./types"

import { SLIDE_TRANSITION } from "./animation-config"
import { AnimationProvider } from "./animation-context"
import { SlideErrorBoundary } from "./slide-error-boundary"
import { DEFAULT_SLIDE_TRANSITION, getSlideVariants } from "./transitions"

// =============================================================================
// TYPES
// =============================================================================

export interface SlideRendererProps {
  slides: SlideConfig[]
  currentSlide: number
  animationStep: number
  totalSteps: number
  direction: NavigationDirection
  showAllAnimations: boolean
  transition?: SlideTransitionType
  directionalTransition?: boolean
  onTransitionComplete: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Renders a single slide with animated transitions.
 * Extracted from SlideDeck so it can be reused in SlideEmbed and other contexts.
 */
export function SlideRenderer({
  slides,
  currentSlide,
  animationStep,
  totalSteps,
  direction,
  showAllAnimations,
  transition,
  directionalTransition,
  onTransitionComplete
}: SlideRendererProps) {
  const currentSlideTransition = slides[currentSlide]?.transition
  const transitionType = currentSlideTransition ?? transition ?? DEFAULT_SLIDE_TRANSITION
  const isDirectional = directionalTransition ?? false

  const slideVariants = getSlideVariants(
    { type: transitionType, directional: isDirectional },
    direction
  )

  const CurrentSlideComponent = slides[currentSlide]!.component

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={currentSlide}
        variants={slideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={SLIDE_TRANSITION}
        onAnimationComplete={definition => {
          if (definition === "center") {
            onTransitionComplete()
          }
        }}
        className="absolute inset-0 h-full w-full"
      >
        <AnimationProvider
          currentStep={animationStep}
          totalSteps={totalSteps}
          showAllAnimations={showAllAnimations}
        >
          <SlideErrorBoundary
            slideIndex={currentSlide}
            slideTitle={slides[currentSlide]?.title}
          >
            <CurrentSlideComponent
              slideNumber={currentSlide + 1}
              totalSlides={slides.length}
            />
          </SlideErrorBoundary>
        </AnimationProvider>
      </motion.div>
    </AnimatePresence>
  )
}
