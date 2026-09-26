import { useCallback, useEffect, useRef, useState } from "react"

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

const POSITION_KEY = "promptslide:position"

function slideKey(slides: SlideConfig[], index: number): string {
  return slides[index]?.id || String(index + 1)
}

function slideFromHash(slides: SlideConfig[]): number | null {
  if (typeof window === "undefined" || !window.location.hash) return null
  let hash: string
  try {
    hash = decodeURIComponent(window.location.hash.slice(1))
  } catch {
    return null
  }
  const byId = slides.findIndex(slide => slide.id === hash)
  if (byId >= 0) return byId
  if (/^[1-9]\d*$/.test(hash)) {
    const index = Number(hash) - 1
    if (index < slides.length) return index
  }
  return null
}

function savedStep(slides: SlideConfig[], index: number): number {
  if (typeof window === "undefined") return 0
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(POSITION_KEY) || "null")
    if (saved?.slide === slideKey(slides, index) && Number.isInteger(saved.step)) {
      return Math.max(0, Math.min(saved.step, slides[index]?.steps ?? 0))
    }
  } catch {
    /* Storage may be unavailable. */
  }
  return 0
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
  const [currentSlide, setCurrentSlide] = useState(() => slideFromHash(slides) ?? initialSlide)
  const [animationStep, setAnimationStep] = useState(() =>
    savedStep(slides, slideFromHash(slides) ?? initialSlide)
  )
  const slidesRef = useRef(slides)
  const activeKeyRef = useRef(slideKey(slides, slideFromHash(slides) ?? initialSlide))

  const [navState, setNavState] = useState<NavigationState>({
    status: "idle",
    direction: 0
  })

  const [queuedAction, setQueuedAction] = useState<QueuedAction>(null)

  const totalSteps = slides[currentSlide]?.steps ?? 0

  useEffect(() => {
    if (typeof window === "undefined" || slides.length === 0) return
    if (slidesRef.current !== slides) {
      slidesRef.current = slides
      const previousKey = activeKeyRef.current
      const movedIndex = slides.findIndex(slide => slide.id && slide.id === previousKey)
      if (movedIndex >= 0 && movedIndex !== currentSlide) {
        setCurrentSlide(movedIndex)
        return
      }
      if (movedIndex < 0 && !/^[1-9]\d*$/.test(previousKey) && currentSlide !== 0) {
        setAnimationStep(0)
        setCurrentSlide(0)
        return
      }
    }
    if (!slides[currentSlide]) {
      setCurrentSlide(0)
      setAnimationStep(0)
      return
    }
    const key = slideKey(slides, currentSlide)
    activeKeyRef.current = key
    const hash = `#${encodeURIComponent(key)}`
    if (window.location.hash !== hash) {
      window.history.replaceState(window.history.state, "", hash)
    }
    try {
      window.sessionStorage.setItem(
        POSITION_KEY,
        JSON.stringify({ slide: key, step: animationStep })
      )
    } catch {
      /* Storage may be unavailable. */
    }
  }, [slides, currentSlide, animationStep])

  useEffect(() => {
    const handleHashChange = () => {
      const index = slideFromHash(slides) ?? 0
      if (index === currentSlide) return
      setNavState({ status: "transitioning", direction: index > currentSlide ? 1 : -1 })
      setAnimationStep(0)
      setCurrentSlide(index)
      onSlideChange?.(index)
    }
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [slides, currentSlide, onSlideChange])

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
