import { LayoutGroup } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Grid3X3,
  List,
  MessageCircle,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Play
} from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import type { Annotation, AnnotationTarget } from "./annotations"
import type { SlideTransitionType } from "./transitions"
import type { SlideConfig } from "./types"

import { SLIDE_DIMENSIONS } from "./animation-config"
import { AnimationProvider } from "./animation-context"
import { AnnotationOverlay, AnnotationPanel, useAnnotations } from "./annotations"
import { SlideErrorBoundary } from "./slide-error-boundary"
import { SlideRenderer } from "./slide-renderer"
import { useSlideNavigation } from "./use-slide-navigation"
import { cn } from "./utils"

// =============================================================================
// TYPES
// =============================================================================

type ViewMode = "slide" | "list" | "grid"
const NARROW_VIEWPORT_WIDTH = 768
const DEFAULT_THUMBNAIL_WIDTH = 240
const MIN_THUMBNAIL_WIDTH = 176
const MAX_THUMBNAIL_WIDTH = 480
const THUMBNAIL_WIDTH_STORAGE_KEY = "promptslide:thumbnail-width"

function GridThumbnail({
  slide,
  index,
  total
}: {
  slide: SlideConfig
  index: number
  total: number
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const SlideComponent = slide.component

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    if (!viewport || !canvas) return
    const resize = () => {
      canvas.style.transform = `scale(${viewport.clientWidth / SLIDE_DIMENSIONS.width})`
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={viewportRef} className="absolute inset-0 overflow-hidden">
      <div
        ref={canvasRef}
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: SLIDE_DIMENSIONS.width, height: SLIDE_DIMENSIONS.height }}
      >
        <AnimationProvider currentStep={slide.steps} totalSteps={slide.steps} showAllAnimations>
          <SlideErrorBoundary slideIndex={index} slideTitle={slide.title}>
            <SlideComponent slideNumber={index + 1} totalSlides={total} />
          </SlideErrorBoundary>
        </AnimationProvider>
      </div>
    </div>
  )
}

function ListSlide({ slide, index, total }: { slide: SlideConfig; index: number; total: number }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const SlideComponent = slide.component

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    if (!viewport || !canvas) return
    const resize = () => {
      canvas.style.transform = `scale(${viewport.clientWidth / SLIDE_DIMENSIONS.width})`
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={viewportRef}
      className="relative aspect-video w-full overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-sm print:m-0 print:h-[1080px] print:w-[1920px] print:break-after-page print:rounded-none print:border-0 print:shadow-none"
    >
      <div
        ref={canvasRef}
        className="list-slide-canvas absolute top-0 left-0 origin-top-left"
        style={{ width: SLIDE_DIMENSIONS.width, height: SLIDE_DIMENSIONS.height }}
      >
        <AnimationProvider currentStep={slide.steps} totalSteps={slide.steps} showAllAnimations>
          <SlideErrorBoundary slideIndex={index} slideTitle={slide.title}>
            <SlideComponent slideNumber={index + 1} totalSlides={total} />
          </SlideErrorBoundary>
        </AnimationProvider>
      </div>
    </div>
  )
}

interface SlideDeckProps {
  slides: SlideConfig[]
  transition?: SlideTransitionType
  directionalTransition?: boolean
  /** Annotation data to display. When provided (even empty array), annotation UI is enabled. When undefined, annotation UI is hidden. */
  annotations?: Annotation[]
  /** Called when the user creates an annotation */
  onAnnotationAdd?: (
    slideIndex: number,
    slideTitle: string,
    target: AnnotationTarget,
    body: string,
    slideId?: string
  ) => void
  /** Called when the user deletes an annotation */
  onAnnotationDelete?: (id: string) => void
  onAnnotationUpdate?: (id: string, patch: Partial<Pick<Annotation, "body" | "status">>) => void
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
    let cancelled = false
    const markReady = async () => {
      await document.fonts.ready
      await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})))
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) setReady(true)
        })
      )
    }
    void markReady()
    return () => {
      cancelled = true
    }
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
// COMPONENT
// =============================================================================

export function SlideDeck({
  slides,
  transition,
  directionalTransition,
  annotations,
  onAnnotationAdd,
  onAnnotationDelete,
  onAnnotationUpdate
}: SlideDeckProps) {
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
  const internal = useAnnotations(slides)
  const isExternallyManaged = annotations !== undefined
  const effectiveAnnotations = isExternallyManaged ? annotations : internal.annotations
  const effectiveAdd = isExternallyManaged ? onAnnotationAdd : internal.addAnnotation
  const effectiveDelete = isExternallyManaged ? onAnnotationDelete : internal.deleteAnnotation
  const effectiveUpdate = isExternallyManaged ? onAnnotationUpdate : internal.updateAnnotation

  const openCount = useMemo(
    () => effectiveAnnotations.filter(a => a.status === "open").length,
    [effectiveAnnotations]
  )
  const getSlideAnnotations = useCallback(
    (slideIndex: number) =>
      effectiveAnnotations.filter(a =>
        a.slideId ? a.slideId === slides[slideIndex]?.id : a.slideIndex === slideIndex
      ),
    [effectiveAnnotations, slides]
  )
  const unlinkedAnnotations = useMemo(
    () =>
      effectiveAnnotations.filter(a => a.slideId && !slides.some(slide => slide.id === a.slideId)),
    [effectiveAnnotations, slides]
  )

  const [viewMode, setViewMode] = useState<ViewMode>("slide")
  const [isPresentationMode, setIsPresentationMode] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth
  )
  const [showThumbnailRail, setShowThumbnailRail] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= NARROW_VIEWPORT_WIDTH
  )
  const [thumbnailWidth, setThumbnailWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_THUMBNAIL_WIDTH
    const savedWidth = Number(window.localStorage.getItem(THUMBNAIL_WIDTH_STORAGE_KEY))
    return Number.isFinite(savedWidth) && savedWidth >= MIN_THUMBNAIL_WIDTH
      ? Math.min(savedWidth, MAX_THUMBNAIL_WIDTH)
      : DEFAULT_THUMBNAIL_WIDTH
  })
  const [isAnnotationMode, setIsAnnotationMode] = useState(false)
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null)
  const [isResizingThumbnails, setIsResizingThumbnails] = useState(false)
  const [isDragCollapsed, setIsDragCollapsed] = useState(false)
  const [isAnimatingDragBoundary, setIsAnimatingDragBoundary] = useState(false)
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const slideContainerRef = useRef<HTMLDivElement>(null)
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const activeThumbnailRef = useRef<HTMLButtonElement>(null)
  const preferredRailOpenRef = useRef(true)
  const wasNarrowViewportRef = useRef(viewportWidth < NARROW_VIEWPORT_WIDTH)
  const resizeStartRef = useRef<{
    pointerId: number
    pointerX: number
    width: number
  } | null>(null)
  const previousUserSelectRef = useRef("")
  const previousCursorRef = useRef("")
  const dragCollapsedRef = useRef(false)
  const dragAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isNarrowViewport = viewportWidth < NARROW_VIEWPORT_WIDTH
  const maxThumbnailWidth = isNarrowViewport
    ? Math.max(120, Math.floor(viewportWidth * 0.8))
    : Math.min(MAX_THUMBNAIL_WIDTH, viewportWidth - 360)
  const minThumbnailWidth = Math.min(MIN_THUMBNAIL_WIDTH, maxThumbnailWidth)
  const visibleThumbnailWidth = Math.min(thumbnailWidth, maxThumbnailWidth)
  const isThumbnailRailVisible = showThumbnailRail && !isDragCollapsed

  const setThumbnailRailOpen = useCallback((open: boolean) => {
    preferredRailOpenRef.current = open
    setShowThumbnailRail(open)
  }, [])

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (isNarrowViewport !== wasNarrowViewportRef.current) {
      setShowThumbnailRail(isNarrowViewport ? false : preferredRailOpenRef.current)
      if (isNarrowViewport) {
        setIsAnnotationMode(false)
        setShowAnnotationPanel(false)
        setSelectedAnnotationId(null)
      }
      wasNarrowViewportRef.current = isNarrowViewport
    }
  }, [isNarrowViewport])

  useEffect(() => {
    window.localStorage.setItem(THUMBNAIL_WIDTH_STORAGE_KEY, String(thumbnailWidth))
  }, [thumbnailWidth])

  useEffect(
    () => () => {
      if (resizeStartRef.current) {
        document.body.style.userSelect = previousUserSelectRef.current
        document.body.style.cursor = previousCursorRef.current
      }
      if (dragAnimationTimerRef.current) clearTimeout(dragAnimationTimerRef.current)
    },
    []
  )

  useEffect(() => {
    if (
      (!showThumbnailRail || isPresentationMode || viewMode !== "slide") &&
      resizeStartRef.current
    ) {
      resizeStartRef.current = null
      dragCollapsedRef.current = false
      setIsResizingThumbnails(false)
      setIsDragCollapsed(false)
      setIsAnimatingDragBoundary(false)
      if (dragAnimationTimerRef.current) clearTimeout(dragAnimationTimerRef.current)
      document.body.style.userSelect = previousUserSelectRef.current
      document.body.style.cursor = previousCursorRef.current
    }
  }, [showThumbnailRail, isPresentationMode, viewMode])

  useEffect(() => {
    if (!isResizingThumbnails) return

    const getDraggedWidth = (clientX: number) => {
      const start = resizeStartRef.current
      return start ? start.width + clientX - start.pointerX : null
    }
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== resizeStartRef.current?.pointerId) return
      const nextWidth = getDraggedWidth(event.clientX)
      if (nextWidth === null) return
      const collapsed = nextWidth < minThumbnailWidth
      if (collapsed !== dragCollapsedRef.current) {
        dragCollapsedRef.current = collapsed
        setIsDragCollapsed(collapsed)
        setIsAnimatingDragBoundary(true)
        if (dragAnimationTimerRef.current) clearTimeout(dragAnimationTimerRef.current)
        dragAnimationTimerRef.current = setTimeout(() => {
          setIsAnimatingDragBoundary(false)
          dragAnimationTimerRef.current = null
        }, 200)
      }
      if (!collapsed) setThumbnailWidth(Math.min(maxThumbnailWidth, nextWidth))
    }
    const stopResize = (event?: PointerEvent) => {
      if (event && event.pointerId !== resizeStartRef.current?.pointerId) return
      const nextWidth = event ? getDraggedWidth(event.clientX) : null
      const collapsed =
        event?.type === "pointerup" && nextWidth !== null && nextWidth < minThumbnailWidth
      resizeStartRef.current = null
      dragCollapsedRef.current = false
      document.body.style.userSelect = previousUserSelectRef.current
      document.body.style.cursor = previousCursorRef.current
      setIsResizingThumbnails(false)
      setIsDragCollapsed(false)
      if (collapsed) setThumbnailRailOpen(false)
      else if (nextWidth !== null) {
        setThumbnailWidth(Math.max(minThumbnailWidth, Math.min(maxThumbnailWidth, nextWidth)))
      }
    }
    const handleBlur = () => stopResize()

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", stopResize)
    window.addEventListener("pointercancel", stopResize)
    window.addEventListener("blur", handleBlur)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", stopResize)
      window.removeEventListener("pointercancel", stopResize)
      window.removeEventListener("blur", handleBlur)
    }
  }, [isResizingThumbnails, minThumbnailWidth, maxThumbnailWidth, setThumbnailRailOpen])

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

  useEffect(() => {
    if (viewMode === "slide" && !isPresentationMode && showThumbnailRail) {
      activeThumbnailRef.current?.scrollIntoView({ block: "nearest" })
    }
  }, [currentSlide, isPresentationMode, showThumbnailRail, viewMode])

  // Calculate scale factor for presentation mode
  useEffect(() => {
    const calculateScale = () => {
      if (!isPresentationMode) {
        setScale(1)
        return
      }
      const availableWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const scaleX = availableWidth / SLIDE_DIMENSIONS.width
      const scaleY = viewportHeight / SLIDE_DIMENSIONS.height
      setScale(Math.min(scaleX, scaleY))
    }

    calculateScale()
    window.addEventListener("resize", calculateScale)
    return () => window.removeEventListener("resize", calculateScale)
  }, [isPresentationMode])

  // Keep slide layout at its design size; only scale the rendered canvas.
  useLayoutEffect(() => {
    const viewport = previewViewportRef.current
    const canvas = slideContainerRef.current
    if (!viewport || !canvas) return
    const resize = (width: number, height: number) => {
      const fitScale = Math.min(width / SLIDE_DIMENSIONS.width, height / SLIDE_DIMENSIONS.height)
      canvas.style.transform = `scale(${fitScale})`
    }
    resize(viewport.clientWidth, viewport.clientHeight)
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      resize(entry.contentRect.width, entry.contentRect.height)
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [viewMode, isPresentationMode])

  const toggleCommentMode = useCallback(() => {
    const next = !isAnnotationMode
    setIsAnnotationMode(next)
    setShowAnnotationPanel(next)
    if (!next) {
      setSelectedAnnotationId(null)
      setHoveredAnnotationId(null)
    }
  }, [isAnnotationMode])

  const handleExportPdf = useCallback(async () => {
    try {
      const response = await fetch("/__promptslide_pdf")
      if (response.ok && response.headers.get("content-type")?.includes("application/pdf")) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "slides.pdf"
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        return
      }
    } catch {
      /* Static builds use the browser print fallback. */
    }
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
  }, [viewMode])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, [contenteditable='true']")) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const key = e.key.toLowerCase()
      if (e.repeat && "fvglcdt".includes(key)) return

      if (key === "f") {
        e.preventDefault()
        void togglePresentationMode()
        return
      }

      if (key === "v" && !isPresentationMode) {
        e.preventDefault()
        setViewMode("slide")
        return
      }

      if (key === "g") {
        e.preventDefault()
        setViewMode(prev => (prev === "grid" ? "slide" : "grid"))
        return
      }

      if (key === "l") {
        e.preventDefault()
        setViewMode(prev => (prev === "list" ? "slide" : "list"))
        return
      }

      if (key === "c" && !isPresentationMode) {
        e.preventDefault()
        toggleCommentMode()
        return
      }

      if (key === "d" && !isPresentationMode) {
        e.preventDefault()
        void handleExportPdf()
        return
      }

      if (viewMode === "slide" && !isPresentationMode && key === "t") {
        e.preventDefault()
        setThumbnailRailOpen(!showThumbnailRail)
        return
      }

      if (viewMode !== "slide" || (isAnnotationMode && !isPresentationMode)) return

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
  }, [
    advance,
    goBack,
    viewMode,
    togglePresentationMode,
    isAnnotationMode,
    isPresentationMode,
    setThumbnailRailOpen,
    showThumbnailRail,
    toggleCommentMode,
    handleExportPdf
  ])

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-foreground">
      <style>{`
        @media print {
          .list-slide-canvas {
            transform: scale(1.5) !important;
          }
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
          "fixed top-4 z-50 flex gap-1 rounded-lg border border-neutral-800 bg-neutral-950/90 p-1 backdrop-blur-sm transition-[right] duration-200 ease-out print:hidden",
          (isPresentationMode || (isNarrowViewport && isAnnotationMode && showAnnotationPanel)) &&
            "hidden",
          isAnnotationMode && showAnnotationPanel ? "right-[21rem]" : "right-4"
        )}
      >
        <button
          onClick={() => setViewMode("slide")}
          className={cn(
            "rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white",
            viewMode === "slide" && "bg-neutral-800 text-white"
          )}
          title="Presentation View (V)"
        >
          <Monitor className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={cn(
            "rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white",
            viewMode === "list" && "bg-neutral-800 text-white"
          )}
          title="List View (L)"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("grid")}
          className={cn(
            "rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white",
            viewMode === "grid" && "bg-neutral-800 text-white"
          )}
          title="Grid View (G)"
        >
          <Grid3X3 className="h-4 w-4" />
        </button>

        <div className="mx-1 w-px bg-neutral-800" />

        <button
          onClick={toggleCommentMode}
          className={cn(
            "relative inline-flex h-8 items-center justify-center rounded-md transition-colors",
            isAnnotationMode
              ? "border border-[#FF6B35]/50 bg-[#FF6B35]/15 p-[7px] text-[#FF6B35] hover:border-[#FF6B35] hover:bg-[#FF6B35]/25"
              : "p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          )}
          title="Comment (C)"
        >
          <MessageCircle className="h-4 w-4" />
          {openCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF6B35] text-[10px] font-bold text-white">
              {openCount}
            </span>
          )}
        </button>

        <div className="mx-1 w-px bg-neutral-800" />

        <button
          onClick={handleExportPdf}
          className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          title="Download PDF (D)"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={togglePresentationMode}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[#FF6B35]/50 bg-[#FF6B35]/15 px-3 text-sm font-semibold text-[#FF6B35] transition-colors hover:border-[#FF6B35] hover:bg-[#FF6B35]/25"
          title="Present (F)"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Present</span>
        </button>
      </div>

      {/* Slide View */}
      {viewMode === "slide" && (
        <div
          className={cn("flex h-screen w-full print:hidden", isPresentationMode ? "bg-black" : "")}
        >
          {!isPresentationMode && (
            <>
              <div
                className={cn(
                  "relative z-10 h-screen shrink-0",
                  isNarrowViewport && "fixed inset-y-0 left-0",
                  isResizingThumbnails && !isAnimatingDragBoundary
                    ? "transition-none"
                    : "transition-[width] duration-200 ease-out motion-reduce:transition-none"
                )}
                style={{ width: isThumbnailRailVisible ? visibleThumbnailWidth : 0 }}
              >
                <div className="h-full w-full overflow-hidden">
                  <aside
                    id="presentation-thumbnails"
                    aria-label="Slide thumbnails"
                    aria-hidden={!isThumbnailRailVisible}
                    inert={!isThumbnailRailVisible}
                    className={cn(
                      "flex h-screen shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 text-white transition-opacity motion-reduce:transition-none",
                      isThumbnailRailVisible
                        ? "opacity-100 delay-100 duration-100"
                        : "opacity-0 duration-75"
                    )}
                    style={{ width: visibleThumbnailWidth }}
                  >
                    <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
                      <span className="text-sm font-semibold">Slides ({slides.length})</span>
                      <button
                        type="button"
                        onClick={() => setThumbnailRailOpen(false)}
                        className="rounded p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                        aria-label="Hide slide thumbnails"
                        title="Hide thumbnails (T)"
                      >
                        <PanelLeftClose className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                      {slides.map((slideConfig, index) => (
                        <button
                          key={slideConfig.id ?? index}
                          ref={index === currentSlide ? activeThumbnailRef : undefined}
                          type="button"
                          onClick={() => goToSlide(index)}
                          aria-label={`Go to slide ${index + 1}${slideConfig.title ? `: ${slideConfig.title}` : ""}`}
                          aria-current={index === currentSlide ? "page" : undefined}
                          className={cn(
                            "block w-full rounded-lg border p-1.5 text-left transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B35]",
                            index === currentSlide
                              ? "border-[#FF6B35] bg-[#FF6B35]/15 ring-1 ring-[#FF6B35]"
                              : "border-transparent hover:border-neutral-600 hover:bg-neutral-800"
                          )}
                        >
                          <div className="relative aspect-video w-full overflow-hidden rounded bg-black">
                            <GridThumbnail
                              slide={slideConfig}
                              index={index}
                              total={slides.length}
                            />
                          </div>
                          <div className="mt-1.5 flex items-baseline gap-2 px-0.5 text-xs">
                            {slideConfig.title ? (
                              <>
                                <span className="font-mono text-neutral-400">{index + 1}</span>
                                <span className="truncate">{slideConfig.title}</span>
                              </>
                            ) : (
                              <span>Slide {index + 1}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </aside>
                </div>
                {isThumbnailRailVisible && (
                  <div
                    role="separator"
                    aria-label="Resize slide thumbnails"
                    aria-orientation="vertical"
                    aria-valuemin={minThumbnailWidth}
                    aria-valuemax={maxThumbnailWidth}
                    aria-valuenow={visibleThumbnailWidth}
                    tabIndex={0}
                    className={cn(
                      "absolute inset-y-0 -right-1 w-2 cursor-col-resize touch-none focus-visible:outline-none after:pointer-events-none after:absolute after:inset-y-0 after:right-1 after:w-0.5 after:bg-transparent after:content-[''] after:transition-colors hover:after:bg-[#FF6B35]/50 focus-visible:after:bg-[#FF6B35]/50",
                      isResizingThumbnails && "after:bg-[#FF6B35]/60"
                    )}
                    onPointerDown={event => {
                      if (event.button !== 0) return
                      event.preventDefault()
                      resizeStartRef.current = {
                        pointerId: event.pointerId,
                        pointerX: event.clientX,
                        width: visibleThumbnailWidth
                      }
                      dragCollapsedRef.current = false
                      setIsAnimatingDragBoundary(false)
                      if (dragAnimationTimerRef.current) clearTimeout(dragAnimationTimerRef.current)
                      setIsResizingThumbnails(true)
                      previousUserSelectRef.current = document.body.style.userSelect
                      previousCursorRef.current = document.body.style.cursor
                      document.body.style.userSelect = "none"
                      document.body.style.cursor = "col-resize"
                    }}
                    onKeyDown={event => {
                      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                        event.preventDefault()
                        event.stopPropagation()
                        const amount = event.key === "ArrowRight" ? 16 : -16
                        setThumbnailWidth(
                          Math.max(
                            minThumbnailWidth,
                            Math.min(maxThumbnailWidth, visibleThumbnailWidth + amount)
                          )
                        )
                      }
                    }}
                  />
                )}
              </div>
              <div
                aria-hidden={isThumbnailRailVisible || isResizingThumbnails}
                inert={isThumbnailRailVisible || isResizingThumbnails}
                className={cn(
                  "fixed top-4 left-4 z-50 rounded-lg border border-neutral-800 bg-neutral-950/90 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none",
                  isThumbnailRailVisible || isResizingThumbnails
                    ? "pointer-events-none opacity-0"
                    : "opacity-100 delay-200"
                )}
              >
                <button
                  type="button"
                  onClick={() => setThumbnailRailOpen(true)}
                  className="rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
                  aria-label="Show slide thumbnails"
                  title="Show thumbnails (T)"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          <div
            ref={containerRef}
            role="presentation"
            tabIndex={isPresentationMode ? 0 : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden",
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
                <div
                  ref={previewViewportRef}
                  className="relative aspect-video w-full max-w-7xl overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-2xl"
                >
                  <div
                    ref={slideContainerRef}
                    className="absolute top-0 left-0 overflow-hidden"
                    style={{
                      width: SLIDE_DIMENSIONS.width,
                      height: SLIDE_DIMENSIONS.height,
                      transformOrigin: "top left"
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
                    {isAnnotationMode && (
                      <AnnotationOverlay
                        slides={slides}
                        currentSlide={currentSlide}
                        slideContainerRef={slideContainerRef}
                        selectedId={selectedAnnotationId}
                        hoveredId={hoveredAnnotationId}
                        onSelectId={setSelectedAnnotationId}
                        onShowPanel={() => setShowAnnotationPanel(true)}
                        slideAnnotations={getSlideAnnotations(currentSlide)}
                        addAnnotation={effectiveAdd ?? (() => {})}
                      />
                    )}
                  </div>
                </div>
              )}
            </LayoutGroup>

            {/* Navigation Controls */}
            {!isPresentationMode && (
              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={goBack}
                  className="rounded-full border border-neutral-800 bg-black/50 p-2 text-neutral-400 backdrop-blur-sm transition-colors hover:bg-neutral-900 hover:text-white"
                  title="Previous step or slide (←)"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex min-w-[4rem] flex-col items-center">
                  <span className="font-mono text-sm text-neutral-500">
                    {currentSlide + 1} / {slides.length}
                  </span>
                </div>
                <button
                  onClick={advance}
                  className="rounded-full border border-neutral-800 bg-black/50 p-2 text-neutral-400 backdrop-blur-sm transition-colors hover:bg-neutral-900 hover:text-white"
                  title="Next step or slide (→ / Space)"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Annotation Panel — beside the slide */}
          {!isPresentationMode && (
            <div
              aria-hidden={!isAnnotationMode || !showAnnotationPanel}
              inert={!isAnnotationMode || !showAnnotationPanel}
              className={cn(
                "h-full shrink-0 overflow-hidden transition-[width,transform] duration-200 ease-out motion-reduce:transition-none",
                isNarrowViewport && "fixed inset-y-0 right-0 z-50 shadow-xl",
                isNarrowViewport &&
                  (!isAnnotationMode || !showAnnotationPanel) &&
                  "translate-x-full"
              )}
              style={{
                width:
                  isAnnotationMode && showAnnotationPanel
                    ? isNarrowViewport
                      ? "min(20rem, 90vw)"
                      : "20rem"
                    : 0
              }}
            >
              <div
                className={cn(
                  "h-full transition-opacity motion-reduce:transition-none",
                  isAnnotationMode && showAnnotationPanel
                    ? "opacity-100 delay-100 duration-100"
                    : "opacity-0 duration-75"
                )}
              >
                <AnnotationPanel
                  annotations={getSlideAnnotations(currentSlide)}
                  unlinkedAnnotations={unlinkedAnnotations}
                  selectedId={selectedAnnotationId}
                  onSelect={setSelectedAnnotationId}
                  onHover={setHoveredAnnotationId}
                  onDelete={effectiveDelete ?? (() => {})}
                  onUpdate={effectiveUpdate ?? (() => {})}
                  onClose={() => {
                    setIsAnnotationMode(false)
                    setShowAnnotationPanel(false)
                    setSelectedAnnotationId(null)
                    setHoveredAnnotationId(null)
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="mx-auto max-w-7xl p-8 pt-16 print:hidden">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {slides.map((slideConfig, index) => {
              const prevSection = index > 0 ? slides[index - 1]?.section : undefined
              const showSectionHeader = slideConfig.section && slideConfig.section !== prevSection

              return (
                <div key={slideConfig.id ?? index} className="contents">
                  {showSectionHeader && (
                    <h3 className="col-span-full mt-4 mb-0 text-xs font-bold tracking-[0.2em] text-neutral-500 uppercase first:mt-0">
                      {slideConfig.section}
                    </h3>
                  )}
                  <button
                    onClick={() => {
                      goToSlide(index)
                      setViewMode("slide")
                    }}
                    className="group relative aspect-video w-full overflow-hidden rounded-lg border border-neutral-800 bg-black shadow-sm transition-all hover:border-[#FF6B35] hover:shadow-lg hover:shadow-[#FF6B35]/10"
                  >
                    <GridThumbnail slide={slideConfig} index={index} total={slides.length} />
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
          {slides.map((slideConfig, index) => (
            <ListSlide
              key={slideConfig.id ?? index}
              slide={slideConfig}
              index={index}
              total={slides.length}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
