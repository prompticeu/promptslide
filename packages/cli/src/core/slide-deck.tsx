import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Download, Grid3X3, Home, List, Loader2, Maximize, MessageCircle, Monitor } from "lucide-react"
import { Fragment, type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { SlideTransitionType } from "./transitions"
import type { SlideConfig } from "./types"

import { SLIDE_DIMENSIONS } from "./animation-config"
import { AnimationProvider } from "./animation-context"
import { AnnotationOverlay, AnnotationPanel, useAnnotations } from "./annotations"
import type { Annotation, AnnotationTarget } from "./annotations"
import { SlideErrorBoundary } from "./slide-error-boundary"
import { SlideRenderer } from "./slide-renderer"
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
  /** Annotation data to display. When provided (even empty array), annotation UI is enabled. When undefined, annotation UI is hidden. */
  annotations?: Annotation[]
  /** Called when the user creates an annotation */
  onAnnotationAdd?: (slideIndex: number, slideTitle: string, target: AnnotationTarget, body: string) => void
  /** Called when the user deletes an annotation */
  onAnnotationDelete?: (id: string) => void
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

/**
 * Renders children at fixed SLIDE_DIMENSIONS and scales to fit the outer container.
 * Used for grid thumbnails and the main slide view.
 */
function ScaledSlideContainer({ children, className, innerRef }: { children: ReactNode; className?: string; innerRef?: React.Ref<HTMLDivElement> }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [containerScale, setContainerScale] = useState(1)

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w > 0 && h > 0) {
        const scaleX = w / SLIDE_DIMENSIONS.width
        const scaleY = h / SLIDE_DIMENSIONS.height
        setContainerScale(Math.min(scaleX, scaleY))
      } else if (w > 0) {
        setContainerScale(w / SLIDE_DIMENSIONS.width)
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scaledWidth = SLIDE_DIMENSIONS.width * containerScale
  const scaledHeight = SLIDE_DIMENSIONS.height * containerScale

  return (
    <div ref={outerRef} className={className} style={{ position: "relative", overflow: "hidden" }}>
      <div
        ref={innerRef}
        style={{
          width: SLIDE_DIMENSIONS.width,
          height: SLIDE_DIMENSIONS.height,
          transform: `scale(${containerScale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: `calc(50% - ${scaledHeight / 2}px)`,
          left: `calc(50% - ${scaledWidth / 2}px)`
        }}
      >
        {children}
      </div>
    </div>
  )
}

function GridSlideContainer({ children }: { children: ReactNode }) {
  return (
    <ScaledSlideContainer className="absolute inset-0">
      {children}
    </ScaledSlideContainer>
  )
}

// =============================================================================
// COMPONENT
// =============================================================================

const toolbarStyle: CSSProperties = {
  position: "fixed",
  top: 16,
  zIndex: 50,
  display: "flex",
  gap: 4,
  padding: 4,
  borderRadius: 12,
  border: "1px solid rgb(38 38 38)",
  background: "rgb(10 10 10 / 0.9)",
  backdropFilter: "blur(8px)"
}

const toolbarButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 8,
  border: "none",
  borderRadius: 8,
  background: "transparent",
  color: "rgb(163 163 163)",
  cursor: "pointer",
  textDecoration: "none"
}

const toolbarSeparatorStyle: CSSProperties = {
  width: 1,
  marginInline: 4,
  background: "rgb(38 38 38)"
}

const navButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 8,
  borderRadius: 9999,
  border: "1px solid rgb(38 38 38)",
  background: "rgb(0 0 0 / 0.5)",
  color: "rgb(163 163 163)",
  cursor: "pointer",
  backdropFilter: "blur(8px)"
}

const navLabelStyle: CSSProperties = {
  display: "flex",
  minWidth: 64,
  flexDirection: "column",
  alignItems: "center"
}

export function SlideDeck({ slides, transition, directionalTransition, annotations, onAnnotationAdd, onAnnotationDelete }: SlideDeckProps) {
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

  // Use internal useAnnotations as fallback when no external annotations prop is provided
  const internal = useAnnotations()
  const isExternallyManaged = annotations !== undefined
  const effectiveAnnotations = isExternallyManaged ? annotations : internal.annotations
  const effectiveAdd = isExternallyManaged ? onAnnotationAdd : internal.addAnnotation
  const effectiveDelete = isExternallyManaged ? onAnnotationDelete : internal.deleteAnnotation

  const openCount = useMemo(() => effectiveAnnotations.filter(a => a.status === "open").length, [effectiveAnnotations])
  const getSlideAnnotations = useCallback(
    (slideIndex: number) => effectiveAnnotations.filter(a => a.slideIndex === slideIndex),
    [effectiveAnnotations]
  )

  const [viewMode, setViewMode] = useState<ViewMode>("slide")
  const [isPresentationMode, setIsPresentationMode] = useState(false)
  const [isAnnotationMode, setIsAnnotationMode] = useState(false)
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const slideContainerRef = useRef<HTMLDivElement>(null)

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

  const handleExportPdf = async () => {
    // Try API-based export first (no print dialog), fall back to window.print()
    const slug = window.location.pathname.replace(/^\//, "").split("/")[0]
    if (slug) {
      setIsExporting(true)
      try {
        const response = await fetch(`/api/export/${slug}.pdf`)
        if (!response.ok) throw new Error("Export failed")
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `${slug}.pdf`
        link.click()
        URL.revokeObjectURL(url)
      } catch {
        // Fallback to print dialog on error
        window.print()
      } finally {
        setIsExporting(false)
      }
      return
    }

    // Fallback: window.print()
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

      if (viewMode !== "slide" || isAnnotationMode) return

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
  }, [advance, goBack, viewMode, togglePresentationMode, isAnnotationMode])

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
        className={cn("print:hidden", isPresentationMode && "hidden")}
        style={{
          ...toolbarStyle,
          right: isAnnotationMode && showAnnotationPanel ? 312 : 16,
          display: isPresentationMode ? "none" : "flex"
        }}
      >
        <a
          href="/"
          style={toolbarButtonStyle}
          title="All Decks"
        >
          <Home className="h-4 w-4" />
        </a>

        <div style={toolbarSeparatorStyle} />

        <button
          onClick={() => setViewMode("slide")}
          style={{
            ...toolbarButtonStyle,
            ...(viewMode === "slide" ? { background: "rgb(38 38 38)", color: "white" } : null)
          }}
          title="Presentation View"
        >
          <Monitor className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("list")}
          style={{
            ...toolbarButtonStyle,
            ...(viewMode === "list" ? { background: "rgb(38 38 38)", color: "white" } : null)
          }}
          title="List View"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("grid")}
          style={{
            ...toolbarButtonStyle,
            ...(viewMode === "grid" ? { background: "rgb(38 38 38)", color: "white" } : null)
          }}
          title="Grid View"
        >
          <Grid3X3 className="h-4 w-4" />
        </button>

        <div style={toolbarSeparatorStyle} />

        <button
          onClick={() => {
            setIsAnnotationMode(prev => {
              const next = !prev
              setShowAnnotationPanel(next)
              if (!next) setSelectedAnnotationId(null)
              return next
            })
          }}
          style={{
            ...toolbarButtonStyle,
            position: "relative",
            ...(isAnnotationMode ? { background: "#FF6B35", color: "white" } : null)
          }}
          title="Annotate slides"
        >
          <MessageCircle className="h-4 w-4" />
          {openCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF6B35] text-[10px] font-bold text-white">
              {openCount}
            </span>
          )}
        </button>

        <div style={toolbarSeparatorStyle} />

        <button
          onClick={handleExportPdf}
          disabled={isExporting}
          style={{
            ...toolbarButtonStyle,
            cursor: isExporting ? "wait" : "pointer",
            color: isExporting ? "var(--primary)" : toolbarButtonStyle.color
          }}
          title={isExporting ? "Exporting PDF..." : "Download PDF"}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={togglePresentationMode}
          style={toolbarButtonStyle}
          title="Present (F)"
        >
          <Maximize className="h-4 w-4" />
        </button>
      </div>

      {/* Slide View */}
      {viewMode === "slide" && (
        <div
          className={cn(
            "flex h-screen w-full print:hidden",
            isPresentationMode ? "bg-black" : ""
          )}
        >
          <div
            ref={containerRef}
            role="presentation"
            tabIndex={isPresentationMode ? 0 : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center overflow-hidden",
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
              ) : (
                <ScaledSlideContainer
                  innerRef={slideContainerRef}
                  className="aspect-video w-full max-w-7xl rounded-xl border border-neutral-800 bg-black shadow-2xl"
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
                  {isAnnotationMode && (
                    <AnnotationOverlay
                      slides={slides}
                      currentSlide={currentSlide}
                      slideContainerRef={slideContainerRef}
                      selectedId={selectedAnnotationId}
                      onSelectId={setSelectedAnnotationId}
                      onShowPanel={() => setShowAnnotationPanel(true)}
                      slideAnnotations={getSlideAnnotations(currentSlide)}
                      addAnnotation={effectiveAdd ?? (() => {})}

                    />
                  )}
                </ScaledSlideContainer>
              )}
            </LayoutGroup>

            {/* Navigation Controls */}
            {!isPresentationMode && (
              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={goBack}
                  style={navButtonStyle}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div style={navLabelStyle}>
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
                  style={navButtonStyle}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Annotation Panel — beside the slide */}
          {isAnnotationMode && showAnnotationPanel && !isPresentationMode && (
            <AnnotationPanel
              annotations={getSlideAnnotations(currentSlide)}
              selectedId={selectedAnnotationId}
              onSelect={setSelectedAnnotationId}
              onDelete={effectiveDelete ?? (() => {})}
              onClose={() => {
                setShowAnnotationPanel(false)
                setSelectedAnnotationId(null)
              }}
            />
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
                <Fragment key={index}>
                  {showSectionHeader && (
                    <h3 className="col-span-full mt-4 mb-3 text-xs font-bold tracking-[0.2em] text-neutral-500 uppercase first:mt-0">
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
                </Fragment>
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
