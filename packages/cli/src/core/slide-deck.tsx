import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Download, Grid3X3, List, Maximize, Monitor } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

import type { SlideTransitionType } from "./transitions"
import type { SlideConfig } from "./types"

import { SLIDE_DIMENSIONS, SLIDE_TRANSITION } from "./animation-config"
import { AnimationProvider } from "./animation-context"
import { SlideErrorBoundary } from "./slide-error-boundary"
import { DEFAULT_SLIDE_TRANSITION, getSlideVariants } from "./transitions"
import { useSlideNavigation } from "./use-slide-navigation"
import { cn } from "./utils"

// =============================================================================
// TYPES
// =============================================================================

type ViewMode = "slide" | "list" | "grid"

interface SlideDeckProps {
  slides: SlideConfig[]
  transition?: SlideTransitionType
  directionalTransition?: boolean
}

// =============================================================================
// EXPORT VIEW (for Playwright screenshot capture)
// =============================================================================

function SlideExportView({ slides, slideIndex }: { slides: SlideConfig[]; slideIndex: number }) {
  const [ready, setReady] = useState(false)
  const clampedIndex = Math.max(0, Math.min(slideIndex, slides.length - 1))
  const slideConfig = slides[clampedIndex]!
  const SlideComponent = slideConfig.component

  useEffect(() => {
    setReady(true)
  }, [])

  return (
    <div
      data-export-ready={ready ? "true" : undefined}
      style={{
        width: SLIDE_DIMENSIONS.width,
        height: SLIDE_DIMENSIONS.height,
        overflow: "hidden",
        position: "relative",
        background: "black"
      }}
    >
      <AnimationProvider
        currentStep={slideConfig.steps}
        totalSteps={slideConfig.steps}
        showAllAnimations={true}
      >
        <SlideErrorBoundary slideIndex={clampedIndex} slideTitle={slideConfig.title}>
          <SlideComponent slideNumber={clampedIndex + 1} totalSlides={slides.length} />
        </SlideErrorBoundary>
      </AnimationProvider>
    </div>
  )
}

// =============================================================================
// GRID THUMBNAIL (renders slide at fixed 1280×720 and scales to fit card)
// =============================================================================

function GridSlideContainer({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.25)

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) setScale(w / SLIDE_DIMENSIONS.width)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={outerRef} className="absolute inset-0">
      <div
        className="origin-top-left overflow-hidden"
        style={{
          width: SLIDE_DIMENSIONS.width,
          height: SLIDE_DIMENSIONS.height,
          transform: `scale(${scale})`
        }}
      >
        {children}
      </div>
    </div>
  )
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SlideDeck({ slides, transition, directionalTransition }: SlideDeckProps) {
  // Check for export mode via URL params
  const [exportParams] = useState(() => {
    if (typeof window === "undefined") return null
    const params = new URLSearchParams(window.location.search)
    if (params.get("export") !== "true") return null
    return { slideIndex: parseInt(params.get("slide") || "0", 10) }
  })

  if (exportParams) {
    return <SlideExportView slides={slides} slideIndex={exportParams.slideIndex} />
  }

  const [viewMode, setViewMode] = useState<ViewMode>("slide")
  const [isPresentationMode, setIsPresentationMode] = useState(false)
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

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
  } = useSlideNavigation({
    slides
  })

  const togglePresentationMode = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }, [])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsPresentationMode(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  // Calculate scale factor for presentation mode
  useEffect(() => {
    const calculateScale = () => {
      if (!isPresentationMode) {
        setScale(1)
        return
      }
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const scaleX = viewportWidth / SLIDE_DIMENSIONS.width
      const scaleY = viewportHeight / SLIDE_DIMENSIONS.height
      setScale(Math.min(scaleX, scaleY))
    }

    calculateScale()
    window.addEventListener("resize", calculateScale)
    return () => window.removeEventListener("resize", calculateScale)
  }, [isPresentationMode])

  const handleExportPdf = () => {
    const previousMode = viewMode
    setViewMode("list")

    setTimeout(() => {
      const handleAfterPrint = () => {
        setViewMode(previousMode)
        window.removeEventListener("afterprint", handleAfterPrint)
      }
      window.addEventListener("afterprint", handleAfterPrint)
      window.print()
    }, 100)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        togglePresentationMode()
        return
      }

      // G for grid view toggle
      if (e.key === "g" || e.key === "G") {
        setViewMode(prev => (prev === "grid" ? "slide" : "grid"))
        return
      }

      if (viewMode !== "slide") return

      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault()
        advance()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        goBack()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [advance, goBack, viewMode, togglePresentationMode])

  // Per-slide transition resolution
  const currentSlideTransition = slides[currentSlide]?.transition
  const transitionType = currentSlideTransition ?? transition ?? DEFAULT_SLIDE_TRANSITION
  const isDirectional = directionalTransition ?? false

  const slideVariants = getSlideVariants(
    { type: transitionType, directional: isDirectional },
    direction
  )

  const CurrentSlideComponent = slides[currentSlide]!.component

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-foreground">
      <style>{`
        @media print {
          @page {
            size: 1920px 1080px;
            margin: 0;
          }
          html,
          body {
            width: 100%;
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: transparent !important;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div
        className={cn(
          "fixed top-4 right-4 z-50 flex gap-1 rounded-lg border border-neutral-800 bg-neutral-950/90 p-1 backdrop-blur-sm print:hidden",
          isPresentationMode && "hidden"
        )}
      >
        <button
          onClick={() => setViewMode("slide")}
          className={cn(
            "rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white",
            viewMode === "slide" && "bg-neutral-800 text-white"
          )}
          title="Presentation View"
        >
          <Monitor className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={cn(
            "rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white",
            viewMode === "list" && "bg-neutral-800 text-white"
          )}
          title="List View"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("grid")}
          className={cn(
            "rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white",
            viewMode === "grid" && "bg-neutral-800 text-white"
          )}
          title="Grid View"
        >
          <Grid3X3 className="h-4 w-4" />
        </button>

        <div className="mx-1 w-px bg-neutral-800" />

        <button
          onClick={handleExportPdf}
          className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          title="Download PDF"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={togglePresentationMode}
          className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          title="Present (F)"
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>

      {/* Slide View */}
      {viewMode === "slide" && (
        <div
          ref={containerRef}
          role="presentation"
          tabIndex={isPresentationMode ? 0 : undefined}
          className={cn(
            "flex h-screen w-full flex-col items-center justify-center overflow-hidden print:hidden",
            isPresentationMode ? "bg-black p-0" : "p-4 md:p-8"
          )}
          onClick={isPresentationMode ? advance : undefined}
          onKeyDown={
            isPresentationMode
              ? e => {
                  if (e.key === "Enter" || e.key === " ") advance()
                }
              : undefined
          }
        >
          <LayoutGroup id="slide-deck">
            {isPresentationMode ? (
              <div
                className="pointer-events-none relative overflow-hidden bg-black"
                style={{
                  width: SLIDE_DIMENSIONS.width,
                  height: SLIDE_DIMENSIONS.height,
                  transform: `scale(${scale})`,
                  transformOrigin: "center center"
                }}
              >
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
              </div>
            ) : (
              <div className="relative aspect-video w-full max-w-7xl overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-2xl">
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
              </div>
            )}
          </LayoutGroup>

          {/* Navigation Controls */}
          {!isPresentationMode && (
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={goBack}
                className="rounded-full border border-neutral-800 bg-black/50 p-2 text-neutral-400 backdrop-blur-sm transition-colors hover:bg-neutral-900 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex min-w-[4rem] flex-col items-center">
                <span className="font-mono text-sm text-neutral-500">
                  {currentSlide + 1} / {slides.length}
                </span>
                {slides[currentSlide]?.title && (
                  <span className="mt-0.5 text-xs text-neutral-600">
                    {slides[currentSlide].title}
                  </span>
                )}
              </div>
              <button
                onClick={advance}
                className="rounded-full border border-neutral-800 bg-black/50 p-2 text-neutral-400 backdrop-blur-sm transition-colors hover:bg-neutral-900 hover:text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="mx-auto max-w-7xl p-8 pt-16 print:hidden">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {slides.map((slideConfig, index) => {
              const SlideComponent = slideConfig.component
              const prevSection = index > 0 ? slides[index - 1]?.section : undefined
              const showSectionHeader = slideConfig.section && slideConfig.section !== prevSection

              return (
                <div key={index} className={showSectionHeader ? "col-span-full" : undefined}>
                  {showSectionHeader && (
                    <h3 className="mt-4 mb-3 text-xs font-bold tracking-[0.2em] text-neutral-500 uppercase first:mt-0">
                      {slideConfig.section}
                    </h3>
                  )}
                  <button
                    onClick={() => {
                      goToSlide(index)
                      setViewMode("slide")
                    }}
                    className="group relative aspect-video w-full overflow-hidden rounded-lg border border-neutral-800 bg-black shadow-sm transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10"
                  >
                    <GridSlideContainer>
                      <AnimationProvider
                        currentStep={slideConfig.steps}
                        totalSteps={slideConfig.steps}
                        showAllAnimations={true}
                      >
                        <SlideErrorBoundary slideIndex={index} slideTitle={slideConfig.title}>
                          <SlideComponent slideNumber={index + 1} totalSlides={slides.length} />
                        </SlideErrorBoundary>
                      </AnimationProvider>
                    </GridSlideContainer>
                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                    <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
                      {slideConfig.title ? `${index + 1}. ${slideConfig.title}` : index + 1}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List View */}
      <div
        className={cn(
          "mx-auto max-w-7xl p-8 pt-16",
          "print:m-0 print:block print:max-w-none print:p-0",
          viewMode === "list" ? "block" : "hidden print:block"
        )}
      >
        <div className="grid grid-cols-1 gap-8 print:block">
          {slides.map((slideConfig, index) => {
            const SlideComponent = slideConfig.component
            return (
              <div
                key={index}
                className="aspect-video w-full overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-sm print:relative print:m-0 print:h-[1080px] print:w-[1920px] print:break-after-page print:overflow-hidden print:rounded-none print:border-0 print:shadow-none"
              >
                <div className="h-full w-full print:h-[720px] print:w-[1280px] print:origin-top-left print:scale-[1.5]">
                  <AnimationProvider
                    currentStep={slideConfig.steps}
                    totalSteps={slideConfig.steps}
                    showAllAnimations={true}
                  >
                    <SlideErrorBoundary slideIndex={index} slideTitle={slideConfig.title}>
                      <SlideComponent slideNumber={index + 1} totalSlides={slides.length} />
                    </SlideErrorBoundary>
                  </AnimationProvider>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
