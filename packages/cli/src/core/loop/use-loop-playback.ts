import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { LoopConfig, SlideConfig } from "../types"

import { includedSlides, stateDuration } from "./config.mjs"

type Options = {
  config: LoopConfig
  slides: SlideConfig[]
  currentSlide: number
  animationStep: number
  isTransitioning: boolean
  enabled: boolean
  advance: () => void
  goBack: () => void
  restartAtSlide: (index: number) => void
}

export function useLoopPlayback({
  config,
  slides,
  currentSlide,
  animationStep,
  isTransitioning,
  enabled,
  advance,
  goBack,
  restartAtSlide
}: Options) {
  const [paused, setPaused] = useState(false)
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden)
  const [epoch, setEpoch] = useState(0)
  const [revision, setRevision] = useState(0)
  const remaining = useRef<number | undefined>(undefined)
  const identity = useRef("")
  const included = useMemo(() => includedSlides(config, slides), [config, slides])

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  const restart = useCallback(
    (index: number) => {
      setEpoch(value => value + 1)
      remaining.current = undefined
      restartAtSlide(index)
    },
    [restartAtSlide]
  )

  const resetTimer = useCallback(() => {
    remaining.current = undefined
    setRevision(value => value + 1)
  }, [])

  const move = (direction: 1 | -1) => {
    resetTimer()
    if (isTransitioning || included.length === 0) return
    if (direction === 1 && animationStep < (slides[currentSlide]?.steps ?? 0)) advance()
    else if (direction === -1 && animationStep > 0) goBack()
    else {
      const position = included.indexOf(currentSlide)
      restart(included[(position + direction + included.length) % included.length]!)
    }
  }

  useEffect(() => {
    if (!enabled) {
      remaining.current = undefined
      setPaused(false)
      return
    }
    const key = `${currentSlide}:${animationStep}:${epoch}:${revision}`
    if (identity.current !== key) {
      identity.current = key
      remaining.current = undefined
    }
    if (paused || hidden || isTransitioning || included.length === 0) return
    const slide = slides[currentSlide]
    if (!slide) return
    const duration =
      remaining.current ?? stateDuration(config, slide, currentSlide, animationStep) * 1000
    const deadline = performance.now() + duration
    const timer = window.setTimeout(() => {
      remaining.current = undefined
      if (animationStep < slide.steps) advance()
      else {
        const position = included.indexOf(currentSlide)
        restart(included[(position + 1) % included.length]!)
      }
    }, duration)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(0, deadline - performance.now())
    }
  }, [
    enabled,
    paused,
    hidden,
    isTransitioning,
    currentSlide,
    animationStep,
    epoch,
    revision,
    config,
    slides,
    advance,
    restart,
    included
  ])

  return { paused, setPaused, epoch, restart, move }
}
