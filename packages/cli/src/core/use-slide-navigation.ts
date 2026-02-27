import { useCallback, useEffect, useState } from "react"

import type { NavigationDirection, SlideConfig } from "./types"

// =============================================================================
// TYPES
// =============================================================================

type NavigationStatus = "idle" | "transitioning"

type QueuedAction = "advance" | "goBack" | null

interface NavigationState {
  status: NavigationStatus
  direction: NavigationDirection
}

export interface UseSlideNavigationOptions {
  slides: SlideConfig[]
  initialSlide?: number
  onSlideChange?: (slideIndex: number) => void
}

export interface UseSlideNavigationReturn {
  currentSlide: number
  animationStep: number
  totalSteps: number
  direction: NavigationDirection
  isTransitioning: boolean
  showAllAnimations: boolean
  advance: () => void
  goBack: () => void
  goToSlide: (index: number) => void
  onTransitionComplete: () => void
}

// =============================================================================
// HOOK
// =============================================================================

export function useSlideNavigation({
  slides,
  initialSlide = 0,
  onSlideChange
}: UseSlideNavigationOptions): UseSlideNavigationReturn {
  const [currentSlide, setCurrentSlide] = useState(initialSlide)
  const [animationStep, setAnimationStep] = useState(0)

  const [navState, setNavState] = useState<NavigationState>({
    status: "idle",
    direction: 0
  })

  const [queuedAction, setQueuedAction] = useState<QueuedAction>(null)

  const totalSteps = slides[currentSlide]?.steps ?? 0

  const onTransitionComplete = useCallback(() => {
    setNavState(prev => {
      if (prev.status === "transitioning") {
        return { status: "idle", direction: 0 }
      }
      return prev
    })
  }, [])

  const advance = useCallback(() => {
    if (navState.status === "transitioning") {
      setQueuedAction("advance")
      return
    }

    const currentTotalSteps = slides[currentSlide]?.steps ?? 0

    if (animationStep >= currentTotalSteps) {
      const nextSlide = (currentSlide + 1) % slides.length
      setNavState({ status: "transitioning", direction: 1 })
      setAnimationStep(0)
      setCurrentSlide(nextSlide)
      onSlideChange?.(nextSlide)
    } else {
      setAnimationStep(prev => prev + 1)
    }
  }, [navState.status, animationStep, currentSlide, slides, onSlideChange])

  const goBack = useCallback(() => {
    if (navState.status === "transitioning") {
      setQueuedAction("goBack")
      return
    }

    if (animationStep <= 0) {
      const prevSlide = (currentSlide - 1 + slides.length) % slides.length
      const prevSlideSteps = slides[prevSlide]?.steps ?? 0
      setNavState({ status: "transitioning", direction: -1 })
      setAnimationStep(prevSlideSteps)
      setCurrentSlide(prevSlide)
      onSlideChange?.(prevSlide)
    } else {
      setAnimationStep(prev => prev - 1)
    }
  }, [navState.status, animationStep, currentSlide, slides, onSlideChange])

  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= slides.length || index === currentSlide) {
        return
      }

      const direction = index > currentSlide ? 1 : -1
      setNavState({ status: "transitioning", direction })
      setAnimationStep(0)
      setCurrentSlide(index)
      onSlideChange?.(index)
    },
    [currentSlide, slides.length, onSlideChange]
  )

  useEffect(() => {
    if (navState.status === "idle" && queuedAction !== null) {
      setQueuedAction(null)
      if (queuedAction === "advance") {
        advance()
      } else if (queuedAction === "goBack") {
        goBack()
      }
    }
  }, [navState.status, queuedAction, advance, goBack])

  return {
    currentSlide,
    animationStep,
    totalSteps,
    direction: navState.direction,
    isTransitioning: navState.status !== "idle",
    showAllAnimations: navState.direction === -1 && navState.status === "transitioning",
    advance,
    goBack,
    goToSlide,
    onTransitionComplete
  }
}
