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
// NATIVE BRIDGE HELPERS
// =============================================================================

/** Detect if running inside a WKWebView (native macOS app) */
function isNativeWebView(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).webkit?.messageHandlers?.promptslide
}

/** Send a message to the native app or the parent iframe */
function postToHost(type: string, data?: Record<string, unknown>) {
  if (isNativeWebView()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).webkit.messageHandlers.promptslide.postMessage({ type, ...data })
  } else {
    window.parent.postMessage({ type, data }, "*")
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Headless slide viewer controlled via window.postMessage or WKWebView bridge.
 * Designed for embedding in an iframe (e.g. the registry editor preview)
 * or in a native macOS WKWebView.
 *
 * Inbound messages (parent/native → embed):
 *   { type: "navigate", data: { slide: number } }
 *   { type: "advance" }
 *   { type: "goBack" }
 *
 * Outbound messages (embed → parent/native):
 *   { type: "slideReady" }
 *   { type: "slideState", data: { currentSlide, totalSlides, animationStep, totalSteps, titles, sections } }
 *   { type: "transitionComplete", currentSlide }
 *   { type: "hmrUpdate" }
 *
 * Native bridge (window.__promptslide):
 *   goToSlide(index), advance(), goBack(), getState() → JSON
 */
export function SlideEmbed({ slides, transition, directionalTransition }: SlideEmbedProps) {
  const [scale, setScale] = useState(1)

  // Screenshot mode: show all animations, no transitions
  const [isScreenshotMode] = useState(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).get("screenshot") === "true"
  })

  const {
    currentSlide,
    animationStep,
    totalSteps,
    direction,
    showAllAnimations,
    advance,
    goBack,
    goToSlide,
    onTransitionComplete: baseOnTransitionComplete
  } = useSlideNavigation({ slides })

  // Wrap transition complete to also notify native
  const onTransitionComplete = useCallback(() => {
    baseOnTransitionComplete()
    postToHost("transitionComplete", { currentSlide })
  }, [baseOnTransitionComplete, currentSlide])

  // Render-ready signal: set data-slide-ready after fonts load + rAF on each slide change
  const [slideReady, setSlideReady] = useState(false)
  useEffect(() => {
    setSlideReady(false)
    document.fonts.ready.then(() => {
      requestAnimationFrame(() => { setSlideReady(true) })
    })
  }, [currentSlide])

  // Post slide state to host whenever it changes
  useEffect(() => {
    postToHost("slideState", {
      currentSlide,
      totalSlides: slides.length,
      animationStep,
      totalSteps,
      titles: slides.map(s => s.title || ""),
      sections: slides.map(s => s.section || ""),
      notes: slides.map(s => s.notes || "")
    })
  }, [currentSlide, animationStep, totalSteps, slides])

  // Signal readiness on mount with full deck metadata
  useEffect(() => {
    postToHost("deckReady", {
      totalSlides: slides.length,
      slides: slides.map((s, i) => ({
        index: i,
        id: s.id,
        title: s.title || "",
        steps: s.steps,
        section: s.section || "",
        notes: s.notes || ""
      }))
    })
  }, [slides])

  // Expose window.__promptslide API for native Swift bridge
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__promptslide = {
      goToSlide: (index: number) => goToSlide(index),
      advance: () => advance(),
      goBack: () => goBack(),
      getState: () =>
        JSON.stringify({
          currentSlide,
          totalSlides: slides.length,
          animationStep,
          totalSteps
        })
    }
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__promptslide
    }
  }, [goToSlide, advance, goBack, currentSlide, slides.length, animationStep, totalSteps])

  // Listen for Vite HMR updates
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hot = (import.meta as any).hot as { on: (event: string, cb: () => void) => void } | undefined
    if (hot) {
      hot.on("vite:afterUpdate", () => {
        postToHost("hmrUpdate")
      })
    }
  }, [])

  // Listen for inbound messages from parent (iframe mode)
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
    <div className="h-screen w-screen overflow-hidden bg-black" data-slide-ready={slideReady ? "true" : "false"}>
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
          animationStep={isScreenshotMode ? (slides[currentSlide]?.steps ?? 0) : animationStep}
          totalSteps={isScreenshotMode ? (slides[currentSlide]?.steps ?? 0) : totalSteps}
          direction={direction}
          showAllAnimations={isScreenshotMode || showAllAnimations}
          transition={isScreenshotMode ? "none" : transition}
          directionalTransition={isScreenshotMode ? false : directionalTransition}
          onTransitionComplete={onTransitionComplete}
        />
      </div>
    </div>
  )
}
