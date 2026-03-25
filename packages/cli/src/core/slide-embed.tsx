import { useCallback, useEffect, useState } from "react"

import type { SlideTransitionType } from "./transitions"
import type { SlideConfig } from "./types"

import { SLIDE_DIMENSIONS } from "./animation-config"
import { SlideRenderer } from "./slide-renderer"
import { useSlideNavigation } from "./use-slide-navigation"

// =============================================================================
// TYPES
// =============================================================================

interface SlideEmbedProps {
  slides: SlideConfig[]
  transition?: SlideTransitionType
  directionalTransition?: boolean
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Headless slide viewer controlled via window.postMessage.
 * Designed for embedding in an iframe (e.g. the registry editor preview).
 *
 * Inbound messages (parent → embed):
 *   { type: "navigate", data: { slide: number } }
 *   { type: "advance" }
 *   { type: "goBack" }
 *
 * Outbound messages (embed → parent):
 *   { type: "slideReady" }
 *   { type: "slideState", data: { currentSlide, totalSlides, animationStep, totalSteps, titles } }
 *   { type: "hmrUpdate" }
 */
export function SlideEmbed({ slides, transition, directionalTransition }: SlideEmbedProps) {
  const [scale, setScale] = useState(1)

  const {
    currentSlide,
    animationStep,
    totalSteps,
    direction,
    showAllAnimations,
    advance,
    goBack,
    goToSlide,
    onTransitionComplete
  } = useSlideNavigation({ slides })

  // Post slide state to parent whenever it changes
  useEffect(() => {
    const state = {
      currentSlide,
      totalSlides: slides.length,
      animationStep,
      totalSteps,
      titles: slides.map(s => s.title || "")
    }
    window.parent.postMessage({ type: "slideState", data: state }, "*")
  }, [currentSlide, animationStep, totalSteps, slides])

  // Signal readiness on mount
  useEffect(() => {
    window.parent.postMessage({ type: "slideReady" }, "*")
  }, [])

  // Listen for Vite HMR updates
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hot = (import.meta as any).hot as { on: (event: string, cb: () => void) => void } | undefined
    if (hot) {
      hot.on("vite:afterUpdate", () => {
        window.parent.postMessage({ type: "hmrUpdate" }, "*")
      })
    }
  }, [])

  // Listen for inbound messages from parent
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const { type, data } = event.data || {}
      switch (type) {
        case "navigate":
          if (typeof data?.slide === "number") goToSlide(data.slide)
          break
        case "advance":
          advance()
          break
        case "goBack":
          goBack()
          break
      }
    },
    [advance, goBack, goToSlide]
  )

  useEffect(() => {
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [handleMessage])

  // Scale to fit viewport while preserving aspect ratio
  useEffect(() => {
    const calculateScale = () => {
      const scaleX = window.innerWidth / SLIDE_DIMENSIONS.width
      const scaleY = window.innerHeight / SLIDE_DIMENSIONS.height
      setScale(Math.min(scaleX, scaleY))
    }

    calculateScale()
    window.addEventListener("resize", calculateScale)
    return () => window.removeEventListener("resize", calculateScale)
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden"
        style={{
          width: SLIDE_DIMENSIONS.width,
          height: SLIDE_DIMENSIONS.height,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center"
        }}
      >
        <SlideRenderer
          slides={slides}
          currentSlide={currentSlide}
          animationStep={animationStep}
          totalSteps={totalSteps}
          direction={direction}
          showAllAnimations={showAllAnimations}
          transition={transition}
          directionalTransition={directionalTransition}
          onTransitionComplete={onTransitionComplete}
        />
      </div>
    </div>
  )
}
