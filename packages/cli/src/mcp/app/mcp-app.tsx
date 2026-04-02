import { App } from "@modelcontextprotocol/ext-apps"
import {
  ChevronLeft, ChevronRight, RotateCw, ExternalLink,
  Maximize2, Minimize2, MessageSquarePlus, X, Check
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import "./styles.css"

// ─── Lightweight hooks ───

function useExtApp(opts: { appInfo: { name: string; version: string }; capabilities: Record<string, unknown> }) {
  const [app, setApp] = useState<App | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const instance = new App(opts.appInfo, opts.capabilities)
    instance.connect().then(() => setApp(instance)).catch(setError)
  }, [])

  return { app, error }
}

// ─── Types ───

interface SlideInfo {
  id: string
  file: string | null
  section?: string
  title?: string
  steps: number
}

interface AnnotationTarget {
  contentNearPin?: string
  position: { xPercent: number; yPercent: number }
}

interface Annotation {
  id: string
  slideIndex: number
  slideTitle: string
  target: AnnotationTarget
  body: string
  createdAt: string
  status: "open" | "resolved"
}

interface DeckData {
  name: string
  slug: string
  slides: SlideInfo[]
  renderApi: string | null  // e.g. http://localhost:29180
  devServerUrl: string | null // for "open in browser"
}

// ─── Pin ───

function Pin({ number, status, xPercent, yPercent, isSelected, onClick }: {
  number: number; status: string; xPercent: number; yPercent: number; isSelected: boolean; onClick: () => void
}) {
  return (
    <button
      className={`pin${isSelected ? " selected" : ""}${status === "resolved" ? " resolved" : ""}`}
      style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
      onClick={e => { e.stopPropagation(); onClick() }}
    >
      {number}
    </button>
  )
}

// ─── Inline Annotation Form ───

function AnnotationForm({ xPercent, yPercent, onSubmit, onCancel }: {
  xPercent: number; yPercent: number; onSubmit: (text: string) => void; onCancel: () => void
}) {
  const [text, setText] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const style: React.CSSProperties = {}
  if (xPercent > 60) style.right = `${100 - xPercent}%`; else style.left = `${xPercent}%`
  if (yPercent > 60) style.bottom = `${100 - yPercent}%`; else style.top = `${yPercent}%`

  return (
    <div className="ann-form" style={style} onClick={e => e.stopPropagation()}>
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) onSubmit(text.trim()) }
          if (e.key === "Escape") onCancel()
          e.stopPropagation()
        }}
        placeholder="Add feedback…"
        rows={2}
      />
      <div className="ann-form-actions">
        <button className="ann-btn cancel" onClick={onCancel}><X size={14} /></button>
        <button className="ann-btn submit" disabled={!text.trim()} onClick={() => { if (text.trim()) onSubmit(text.trim()) }}>
          <Check size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Annotation Panel ───

function AnnotationPanel({ annotations, currentIndex, selectedId, onSelect, onResolve, onClose }: {
  annotations: Annotation[]; currentIndex: number; selectedId: string | null
  onSelect: (id: string | null) => void; onResolve: (id: string) => void; onClose: () => void
}) {
  const slideAnns = annotations.filter(a => a.slideIndex === currentIndex)

  return (
    <div className="ann-panel">
      <div className="ann-panel-header">
        <span>Feedback</span>
        <button onClick={onClose}><X size={14} /></button>
      </div>
      <div className="ann-panel-list">
        {slideAnns.length === 0 && (
          <div className="ann-empty">Click on the slide to add feedback.</div>
        )}
        {slideAnns.map((a, i) => (
          <div
            key={a.id}
            className={`ann-item${a.id === selectedId ? " selected" : ""}${a.status === "resolved" ? " resolved" : ""}`}
            onClick={() => onSelect(a.id === selectedId ? null : a.id)}
          >
            <div className="ann-item-num">{i + 1}</div>
            <div className="ann-item-body">
              <p>{a.body}</p>
              <div className="ann-item-meta">
                <span className={`ann-status ${a.status}`}>{a.status}</span>
                {a.status === "open" && (
                  <button className="ann-resolve" onClick={e => { e.stopPropagation(); onResolve(a.id) }}>
                    <Check size={11} /> Resolve
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Scaled iframe for 1280x720 slide content ───

function SlideFrame({ html, title, annotating, onAnnotate, fitHeight = true }: {
  html: string; title: string
  annotating?: boolean
  onAnnotate?: (xPercent: number, yPercent: number, contentNearPin: string) => void
  fitHeight?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(1)
  const [wrapSize, setWrapSize] = useState({ w: 640, h: 360 })
  const highlightRef = useRef<HTMLDivElement>(null)

  // Observe the slide-area container to compute the best fit for 16:9
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => {
      const availW = container.clientWidth
      const availH = container.clientHeight
      // Fit 16:9 into available space
      const scaleW = availW / 1280
      const scaleH = availH / 720
      const s = fitHeight ? Math.min(scaleW, scaleH) : scaleW
      setScale(s)
      setWrapSize({ w: Math.floor(1280 * s), h: Math.floor(720 * s) })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // Find the element in the iframe at given overlay coordinates
  const getElementAt = useCallback((overlayX: number, overlayY: number) => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument) return null
    // Convert overlay coords to iframe coords (undo scale)
    const iframeX = overlayX / scale
    const iframeY = overlayY / scale
    const el = iframe.contentDocument.elementFromPoint(iframeX, iframeY)
    if (!el || el === iframe.contentDocument.body || el === iframe.contentDocument.documentElement) return null
    return el as HTMLElement
  }, [scale])

  // Highlight element on hover in annotation mode
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!annotating || !highlightRef.current || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const el = getElementAt(x, y)
    const hl = highlightRef.current

    if (el) {
      const elRect = el.getBoundingClientRect()
      // Element rect is in iframe coords, scale to overlay coords
      hl.style.display = "block"
      hl.style.left = `${elRect.left * scale}px`
      hl.style.top = `${elRect.top * scale}px`
      hl.style.width = `${elRect.width * scale}px`
      hl.style.height = `${elRect.height * scale}px`
    } else {
      hl.style.display = "none"
    }
  }, [annotating, getElementAt, scale])

  const handleMouseLeave = useCallback(() => {
    if (highlightRef.current) highlightRef.current.style.display = "none"
  }, [])

  // Click to annotate
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!annotating || !onAnnotate || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const xPercent = (x / rect.width) * 100
    const yPercent = (y / rect.height) * 100

    // Get nearby text content
    const el = getElementAt(x, y)
    const contentNearPin = el?.textContent?.trim().slice(0, 100) || ""

    onAnnotate(xPercent, yPercent, contentNearPin)
  }, [annotating, onAnnotate, getElementAt])

  return (
    <div ref={containerRef} className="slide-frame-container">
      <div
        className={`slide-frame-wrap${annotating ? " annotating" : ""}`}
        ref={wrapRef}
        style={{ width: wrapSize.w, height: wrapSize.h }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <iframe
          ref={iframeRef}
          className="slide-frame"
          srcDoc={html}
          sandbox="allow-same-origin"
          title={title}
          style={{ transform: `scale(${scale})` }}
        />
        {/* Annotation mode overlays */}
        {annotating && (
          <>
            <div className="annotation-overlay" />
            <div ref={highlightRef} className="element-highlight" />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Viewer Core ───

function ViewerCore({ app }: { app: App }) {
  const appRef = useRef(app)
  appRef.current = app

  const [deck, setDeck] = useState<DeckData | null>(null)
  const [idx, setIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [displayMode, setDisplayMode] = useState<"inline" | "fullscreen">("inline")
  const [containerHeight, setContainerHeight] = useState<number | null>(null)

  // Slide HTML cache (rendered DOM snapshots) and thumbnail cache (screenshots)
  const [cache, setCache] = useState<Record<string, string>>({})
  const [thumbCache, setThumbCache] = useState<Record<string, string>>({})
  const pendingRef = useRef<Set<string>>(new Set())
  const pendingThumbRef = useRef<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  // Annotations (only in isFullscreen mode)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [annotateMode, setAnnotateMode] = useState(false)
  const [showPanel, setShowPanel] = useState(false)
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number; contentNearPin?: string } | null>(null)

  // ─── Host context (theme, container dimensions, display mode) ───
  useEffect(() => {
    const applyTheme = (theme: string) =>
      document.documentElement.classList.toggle("light", theme === "light")

    try {
      const ctx = app.getHostContext?.() as any
      if (ctx?.theme) applyTheme(ctx.theme)
      if (ctx?.containerDimensions?.height) setContainerHeight(ctx.containerDimensions.height)
    } catch {}

    app.onhostcontextchanged = (ctx: any) => {
      if (ctx.theme) applyTheme(ctx.theme)
      if (ctx.containerDimensions?.height) setContainerHeight(ctx.containerDimensions.height)
      if (ctx.displayMode) setDisplayMode(ctx.displayMode as "inline" | "fullscreen")
    }
  }, [app])

  // ─── Apply container height in fullscreen ───
  useEffect(() => {
    if (displayMode === "fullscreen" && containerHeight) {
      document.documentElement.style.setProperty("--container-h", `${containerHeight}px`)
    } else {
      document.documentElement.style.removeProperty("--container-h")
    }
  }, [displayMode, containerHeight])

  // ─── Setup handlers ───
  useEffect(() => {
    app.ontoolresult = (result: any) => {
      const text = result.content?.find((c: any) => c.type === "text")?.text
      if (!text) { setError("No data received."); return }
      try {
        const data = JSON.parse(text)
        if (data.error) { setError(data.error); return }
        // If same deck, just clear cache (slides may have been edited).
        // If different deck, also reset slide index.
        if (data.slug !== deck?.slug) setIdx(0)
        setCache({}); setDeck(data)
      } catch { setError("Invalid response.") }
    }
    app.ontoolinput = () => {}
    app.ontoolinputpartial = () => {}
    // @ts-expect-error teardown
    app.onteardown = async () => ({})
  }, [app])

  // ─── Context update on navigation ───
  useEffect(() => {
    if (!deck) return
    const s = deck.slides[idx]
    if (!s) return
    try {
      app.updateModelContext({
        content: [{ type: "text", text: `Viewing slide ${idx + 1}/${deck.slides.length}: "${s.title || s.id}"` }],
      })
    } catch {}
  }, [app, deck, idx])

  // ─── Fetch slide: try static HTML via MCP, fallback to screenshot ───
  const fetchSlide = useCallback(async (id: string, force = false) => {
    if (!deck || (!force && cache[id]) || pendingRef.current.has(id)) return
    pendingRef.current.add(id)
    try {
      // Try static HTML (rendered DOM, no scripts — for srcdoc)
      let got = false
      try {
        const r = await app.callServerTool({ name: "get_slide_html", arguments: { deck: deck.slug, slide: id } })
        const text = r.content?.find((c: any) => c.type === "text") as any
        if (text?.text && text.text.startsWith("<!DOCTYPE")) {
          setCache(prev => ({ ...prev, [id]: text.text }))
          got = true
        }
      } catch {}
      // Fallback: screenshot
      if (!got) {
        const r = await app.callServerTool({ name: "get_screenshot", arguments: { deck: deck.slug, slide: id, scale: 1 } })
        const img = r.content?.find((c: any) => c.type === "image") as any
        if (img?.data) {
          setCache(prev => ({ ...prev, [id]: `data:${img.mimeType || "image/png"};base64,${img.data}` }))
        }
      }
    } catch {} finally { pendingRef.current.delete(id) }
  }, [app, deck, cache])

  // ─── Fetch thumbnail screenshot ───
  const fetchThumb = useCallback(async (id: string) => {
    if (!deck || thumbCache[id] || pendingThumbRef.current.has(id)) return
    pendingThumbRef.current.add(id)
    try {
      const r = await app.callServerTool({ name: "get_screenshot", arguments: { deck: deck.slug, slide: id, scale: 1 } })
      const img = r.content?.find((c: any) => c.type === "image") as any
      if (img?.data) {
        setThumbCache(prev => ({ ...prev, [id]: `data:${img.mimeType || "image/png"};base64,${img.data}` }))
      }
    } catch {} finally { pendingThumbRef.current.delete(id) }
  }, [app, deck, thumbCache])

  // Load current + prefetch adjacent
  useEffect(() => {
    if (!deck) return
    const cur = deck.slides[idx]
    if (!cur) return
    if (!cache[cur.id]) setLoading(true)
    fetchSlide(cur.id).then(() => setLoading(false))
    if (deck.slides[idx - 1]) fetchSlide(deck.slides[idx - 1].id)
    if (deck.slides[idx + 1]) fetchSlide(deck.slides[idx + 1].id)
  }, [deck, idx, fetchSlide, cache])

  // Background prefetch all thumbnails
  const prefetchedRef = useRef(false)
  useEffect(() => {
    if (!deck || prefetchedRef.current) return
    prefetchedRef.current = true
    deck.slides.forEach((s, i) => {
      setTimeout(() => fetchThumb(s.id), i * 800)
    })
  }, [deck, fetchThumb])

  // ─── Auto-detect slide edits (poll source via MCP, refresh HTML via dev server) ───
  const sourceHashRef = useRef<Record<string, number>>({})
  const pollDeckRef = useRef(deck)
  const pollIdxRef = useRef(idx)
  pollDeckRef.current = deck
  pollIdxRef.current = idx

  useEffect(() => {
    if (!deck?.renderApi) return
    const id = setInterval(async () => {
      const d = pollDeckRef.current
      const i = pollIdxRef.current
      if (!d) return
      const cur = d.slides[i]
      if (!cur) return
      try {
        // Poll TSX source length via MCP (lightweight, just a file read)
        const r = await appRef.current.callServerTool({ name: "get_slide", arguments: { deck: d.slug, slide: cur.id } })
        const src = r.content?.find((c: any) => c.type === "text")?.text
        if (!src) return
        const hash = src.length
        const prev = sourceHashRef.current[cur.id]
        sourceHashRef.current[cur.id] = hash
        if (prev !== undefined && prev !== hash) {
          // Source changed — invalidate and re-fetch
          pendingRef.current.delete(cur.id)
          setCache(prev => { const n = { ...prev }; delete n[cur.id]; return n })
          setLoading(true)
          // Try static HTML via MCP
          let fetched = false
          try {
            const hr = await appRef.current.callServerTool({ name: "get_slide_html", arguments: { deck: d.slug, slide: cur.id } })
            const text = hr.content?.find((c: any) => c.type === "text") as any
            if (text?.text && text.text.startsWith("<!DOCTYPE")) {
              setCache(prev => ({ ...prev, [cur.id]: text.text }))
              fetched = true
            }
          } catch {}
          // Fallback to screenshot
          if (!fetched) {
            try {
              const sr = await appRef.current.callServerTool({ name: "get_screenshot", arguments: { deck: d.slug, slide: cur.id, scale: 1 } })
              const img = sr.content?.find((c: any) => c.type === "image") as any
              if (img?.data) {
                setCache(prev => ({ ...prev, [cur.id]: `data:${img.mimeType || "image/png"};base64,${img.data}` }))
              }
            } catch {}
          }
          setLoading(false)
        }
      } catch {}
    }, 5000)
    return () => clearInterval(id)
  }, [deck?.slug])

  // ─── Toggle fullscreen via host API ───
  const toggleFullscreen = useCallback(async () => {
    const newMode = displayMode === "fullscreen" ? "inline" : "fullscreen"
    try {
      const result = await appRef.current.requestDisplayMode({ mode: newMode })
      const mode = result.mode as "inline" | "fullscreen"
      setDisplayMode(mode)
      if (mode === "inline") {
        setContainerHeight(null)
        document.documentElement.style.removeProperty("--container-h")
      }
    } catch {}
  }, [displayMode])

  // ─── Annotations ───
  const fetchAnnotations = useCallback(() => {
    if (!deck) return
    app.callServerTool({ name: "get_annotations", arguments: { deck: deck.slug } })
      .then((r: any) => {
        const t = r.content?.find((c: any) => c.type === "text")?.text
        if (t) { try { const p = JSON.parse(t); setAnnotations(Array.isArray(p) ? p : p.annotations || []) } catch {} }
      }).catch(() => {})
  }, [app, deck])

  const isFullscreen = displayMode === "fullscreen"

  useEffect(() => { if (isFullscreen) fetchAnnotations() }, [isFullscreen, fetchAnnotations])

  const submitAnnotation = useCallback(async (text: string) => {
    if (!deck || !pendingPin) return
    try {
      await app.callServerTool({
        name: "add_annotation",
        arguments: {
          deck: deck.slug,
          slide: deck.slides[idx].id,
          text,
          xPercent: Math.round(pendingPin.x * 10) / 10,
          yPercent: Math.round(pendingPin.y * 10) / 10,
          contentNearPin: pendingPin.contentNearPin || ""
        }
      })
      setPendingPin(null); fetchAnnotations(); setShowPanel(true)
    } catch {}
  }, [app, deck, idx, pendingPin, fetchAnnotations])

  const resolveAnnotation = useCallback(async (id: string) => {
    if (!deck) return
    try { await app.callServerTool({ name: "resolve_annotation", arguments: { deck: deck.slug, annotation_id: id } }); fetchAnnotations() } catch {}
  }, [app, deck, fetchAnnotations])

  // ─── Navigation ───
  const go = useCallback((dir: -1 | 1) => {
    if (!deck) return
    setIdx(i => Math.max(0, Math.min(deck.slides.length - 1, i + dir)))
  }, [deck])

  const refresh = useCallback(() => {
    if (!deck) return
    const cur = deck.slides[idx]
    if (!cur) return
    setCache(prev => { const n = { ...prev }; delete n[cur.id]; return n })
    setLoading(true)
    fetchSlide(cur.id, true).then(() => setLoading(false))
  }, [deck, idx, fetchSlide])

  // ─── Keyboard ───
  useEffect(() => {
    if (!deck) return
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1) }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1) }
      else if (e.key === "r") refresh()
      else if (e.key === "Escape") {
        if (pendingPin) setPendingPin(null)
        else if (annotateMode) { setAnnotateMode(false); setShowPanel(false) }
        else if (isFullscreen) toggleFullscreen()
      }
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [deck, go, refresh, pendingPin, annotateMode, isFullscreen, toggleFullscreen])

  useEffect(() => { setPendingPin(null); setSelectedPin(null) }, [idx])

  // ─── Derived ───
  const slideCached = deck?.slides[idx]?.id ? cache[deck.slides[idx].id] ?? null : null
  const isImage = slideCached?.startsWith("data:image")
  const slideContent = slideCached
  const slide = deck?.slides[idx]
  const slideAnns = annotations.filter(a => a.slideIndex === idx || a.slideTitle === slide?.id)
  const openCount = annotations.filter(a => a.status === "open").length

  // ─── Render ───

  if (!deck && !error) return <div className="state"><div className="spinner" /><span>Loading preview…</span></div>
  if (error) return <div className="state"><div className="err"><p>{error}</p></div></div>
  if (!deck || !slide) return null

  const slideView = (
    <div className={`slide-area${annotateMode ? " annotating" : ""}`}>
      {loading && !slideContent ? (
        <div className="slide-placeholder"><div className="spinner" /></div>
      ) : slideContent && isImage ? (
        <img className="slide-img" src={slideContent} alt={slide.title || slide.id} draggable={false} />
      ) : slideContent ? (
        <SlideFrame
          html={slideContent}
          title={slide.title || slide.id}
          annotating={annotateMode && isFullscreen}
          fitHeight={true}
          onAnnotate={(xPct, yPct, content) => {
            setPendingPin({ x: xPct, y: yPct, contentNearPin: content })
            setSelectedPin(null)
          }}
        />
      ) : (
        <div className="slide-placeholder"><span>No preview</span></div>
      )}

      {/* Annotation pins + form (fullscreen only) */}
      {isFullscreen && slideAnns.map((a, i) => (
        <Pin key={a.id} number={i + 1} status={a.status}
          xPercent={a.target.position.xPercent} yPercent={a.target.position.yPercent}
          isSelected={a.id === selectedPin}
          onClick={() => { setSelectedPin(a.id === selectedPin ? null : a.id); setShowPanel(true); setPendingPin(null) }}
        />
      ))}
      {isFullscreen && pendingPin && (
        <AnnotationForm xPercent={pendingPin.x} yPercent={pendingPin.y}
          onSubmit={submitAnnotation} onCancel={() => setPendingPin(null)} />
      )}
    </div>
  )

  const thumbStrip = deck.slides.length > 1 ? (
    <div className={`thumbs${isFullscreen ? " thumbs-sidebar" : ""}`}>
      {deck.slides.map((s, i) => (
        <div key={s.id} className={`thumb${i === idx ? " active" : ""}`} onClick={() => setIdx(i)}>
          {thumbCache[s.id] ? (
            <img src={thumbCache[s.id]} alt={s.id} />
          ) : (
            <span>{i + 1}</span>
          )}
        </div>
      ))}
    </div>
  ) : null

  const editBar = isFullscreen ? (
    <div className="bar bar-edit">
      <div className="bar-nav">
        <button className="bar-btn" disabled={idx === 0} onClick={() => go(-1)}><ChevronLeft size={16} /></button>
        <div className="bar-info">
          <span className="bar-title">{slide.title || slide.id}</span>
          <span className="bar-sub">{idx + 1} / {deck.slides.length}{slide.steps > 0 ? ` · ${slide.steps} steps` : ""}</span>
        </div>
        <button className="bar-btn" disabled={idx === deck.slides.length - 1} onClick={() => go(1)}><ChevronRight size={16} /></button>
      </div>
      <div className="bar-actions">
        <button
          className={`bar-btn${annotateMode ? " active" : ""}${openCount > 0 ? " badge" : ""}`}
          onClick={() => { setAnnotateMode(!annotateMode); if (!annotateMode) setShowPanel(true) }}
          title="Annotate" data-count={openCount > 0 ? openCount : undefined}
        ><MessageSquarePlus size={15} /></button>
        <button className="bar-btn" onClick={refresh} title="Refresh"><RotateCw size={14} /></button>
        <button className="bar-btn edit-btn" onClick={toggleFullscreen} title="Collapse">
          <Minimize2 size={14} /><span>Exit</span>
        </button>
        {deck.devServerUrl && (
          <button className="bar-btn" onClick={() => app.openLink({ url: deck.devServerUrl! })} title="Open in browser"><ExternalLink size={14} /></button>
        )}
      </div>
    </div>
  ) : null

  return (
    <div className={`viewer${isFullscreen ? " fullscreen" : ""}`} tabIndex={0}>
      {/* Top bar (edit mode only) */}
      {editBar}

      <div className="main-row">
        {isFullscreen && thumbStrip}
        {slideView}
        {isFullscreen && showPanel && (
          <AnnotationPanel
            annotations={annotations} currentIndex={idx} selectedId={selectedPin}
            onSelect={setSelectedPin} onResolve={resolveAnnotation}
            onClose={() => { setShowPanel(false); setAnnotateMode(false) }}
          />
        )}
      </div>

      {/* Bottom section: thumbnails + nav (inline mode only) */}
      {!isFullscreen && <div className="inline-bottom">
        {thumbStrip}
        <div className="bar">
        <div className="bar-nav">
          <button className="bar-btn" disabled={idx === 0} onClick={() => go(-1)}><ChevronLeft size={16} /></button>
          <div className="bar-info">
            <span className="bar-title">{slide.title || slide.id}</span>
            <span className="bar-sub">{idx + 1} / {deck.slides.length}{slide.steps > 0 ? ` · ${slide.steps} steps` : ""}</span>
          </div>
          <button className="bar-btn" disabled={idx === deck.slides.length - 1} onClick={() => go(1)}><ChevronRight size={16} /></button>
        </div>
        <div className="bar-actions">
          <button className="bar-btn" onClick={refresh} title="Refresh"><RotateCw size={14} /></button>
          <button className="bar-btn edit-btn" onClick={toggleFullscreen} title="Edit">
            <Maximize2 size={14} /><span>Edit</span>
          </button>
          {deck.devServerUrl && (
            <button className="bar-btn" onClick={() => app.openLink({ url: deck.devServerUrl! })} title="Open in browser"><ExternalLink size={14} /></button>
          )}
        </div>
      </div>
      </div>}
    </div>
  )
}

// ─── Root ───

export function SlideViewer() {
  const { app, error } = useExtApp({
    appInfo: { name: "PromptSlide", version: "1.0.0" },
    capabilities: {},
  })

  if (error) return <div className="state"><div className="err"><p>Connection failed: {error.message}</p></div></div>
  if (!app) return <div className="state"><div className="spinner" /><span>Connecting…</span></div>

  return <ViewerCore app={app} />
}
