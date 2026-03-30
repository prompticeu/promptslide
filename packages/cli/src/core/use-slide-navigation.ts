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
// URL HASH HELPERS
// =============================================================================

/** Read slide index from URL hash. Supports both ID (#architecture) and legacy number (#3) */
function readSlideFromHash(slides: SlideConfig[]): number | null {
  if (typeof window === "undefined") return null
  const hash = window.location.hash.slice(1) // remove #
  if (!hash) return null

  // Try matching by slide ID first
  const idx = slides.findIndex(s => s.id === hash)
  if (idx >= 0) return idx

  // Fallback: legacy 1-based number
  const num = parseInt(hash, 10)
  if (!isNaN(num) && num >= 1 && num <= slides.length) return num - 1

  return null
}

/** Write current slide ID to URL hash */
function writeSlideToHash(slides: SlideConfig[], index: number): void {
  if (typeof window === "undefined") return
  const id = slides[index]?.id
  if (!id) return
  const newHash = `#${id}`
  if (window.location.hash !== newHash) {
    history.replaceState(null, "", newHash)
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useSlideNavigation({
  slides,
  initialSlide = 0,
  onSlideChange
}: UseSlideNavigationOptions): UseSlideNavigationReturn {
  const [currentSlide, setCurrentSlide] = useState(() => {
    const fromHash = readSlideFromHash(slides)
    return fromHash ?? initialSlide
  })
  const [animationStep, setAnimationStep] = useState(0)

  const [navState, setNavState] = useState<NavigationState>({
    status: "idle",
    direction: 0
  })

  const [queuedAction, setQueuedAction] = useState<QueuedAction>(null)

  const totalSteps = slides[currentSlide]?.steps ?? 0

  // Sync slide index → URL hash
  useEffect(() => {
    writeSlideToHash(slides, currentSlide)
  }, [currentSlide, slides])

  // Listen for hash changes (manual URL edits, back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const fromHash = readSlideFromHash(slides)
      if (fromHash !== null && fromHash !== currentSlide) {
        const direction = fromHash > currentSlide ? 1 : -1
        setNavState({ status: "transitioning", direction })
        setAnimationStep(0)
        setCurrentSlide(fromHash)
        onSlideChange?.(fromHash)
      }
    }
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [currentSlide, slides, onSlideChange])

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
