import { App } from "@modelcontextprotocol/ext-apps"
import {
  ChevronLeft, ChevronRight, RotateCw, ExternalLink,
  Maximize2, Minimize2
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

interface DeckData {
  name: string
  slug: string
  slides: SlideInfo[]
  renderApi: string | null  // e.g. http://localhost:29180
  devServerUrl: string | null // for "open in browser"
}

// ─── Scaled iframe for 1280x720 slide content ───

function SlideFrame({ html, title }: {
  html: string; title: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setScale(el.clientWidth / 1280)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="slide-frame-wrap" ref={wrapRef}>
      <iframe
        ref={iframeRef}
        className="slide-frame"
        srcDoc={html}
        sandbox="allow-same-origin"
        title={title}
        style={{ transform: `scale(${scale})` }}
      />
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
        const r = await app.callServerTool({ name: "render", arguments: { deck: deck.slug, format: "html", slide: id } })
        const text = r.content?.find((c: any) => c.type === "text") as any
        if (text?.text) {
          const payload = JSON.parse(text.text)
          const html = payload?.path ? null : payload?.artifact?.data ?? payload?.data?.data
          if (typeof html === "string" && html.startsWith("<!DOCTYPE")) {
            setCache(prev => ({ ...prev, [id]: html }))
            got = true
          }
        }
      } catch {}
      // Fallback: screenshot
      if (!got) {
        const r = await app.callServerTool({ name: "render", arguments: { deck: deck.slug, format: "png", slide: id, scale: 1 } })
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
      const r = await app.callServerTool({ name: "render", arguments: { deck: deck.slug, format: "png", slide: id, scale: 1 } })
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
        const r = await appRef.current.callServerTool({ name: "read", arguments: { deck: d.slug, slide: cur.id } })
        const textItem = r.content?.find((c: any) => c.type === "text") as { text?: string } | undefined
        const text = textItem?.text
        if (!text) return
        const payload = JSON.parse(text)
        const src = payload?.content
        if (typeof src !== "string") return
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
            const hr = await appRef.current.callServerTool({ name: "render", arguments: { deck: d.slug, format: "html", slide: cur.id } })
            const text = hr.content?.find((c: any) => c.type === "text") as any
            if (text?.text) {
              const payload = JSON.parse(text.text)
              const html = payload?.path ? null : payload?.artifact?.data ?? payload?.data?.data
              if (typeof html === "string" && html.startsWith("<!DOCTYPE")) {
                setCache(prev => ({ ...prev, [cur.id]: html }))
                fetched = true
              }
            }
          } catch {}
          // Fallback to screenshot
          if (!fetched) {
            try {
              const sr = await appRef.current.callServerTool({ name: "render", arguments: { deck: d.slug, format: "png", slide: cur.id, scale: 1 } })
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
      setDisplayMode(result.mode as "inline" | "fullscreen")
    } catch {}
  }, [displayMode])

  const isFullscreen = displayMode === "fullscreen"

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
      else if (e.key === "Escape" && isFullscreen) toggleFullscreen()
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [deck, go, refresh, isFullscreen, toggleFullscreen])

  // ─── Derived ───
  const slideCached = deck?.slides[idx]?.id ? cache[deck.slides[idx].id] ?? null : null
  const isImage = slideCached?.startsWith("data:image")
  const slideContent = slideCached
  const slide = deck?.slides[idx]

  // ─── Render ───

  if (!deck && !error) return <div className="state"><div className="spinner" /><span>Loading preview…</span></div>
  if (error) return <div className="state"><div className="err"><p>{error}</p></div></div>
  if (!deck || !slide) return null

  return (
    <div className={`viewer${isFullscreen ? " fullscreen" : ""}`} tabIndex={0}>
      {/* Slide area */}
      <div className="main-row">
        <div className="slide-area">
          {loading && !slideContent ? (
            <div className="slide-placeholder"><div className="spinner" /></div>
          ) : slideContent && isImage ? (
            <img className="slide-img" src={slideContent} alt={slide.title || slide.id} draggable={false} />
          ) : slideContent ? (
            <SlideFrame
              html={slideContent}
              title={slide.title || slide.id}
            />
          ) : (
            <div className="slide-placeholder"><span>No preview</span></div>
          )}
        </div>
      </div>

      {/* Thumbnail strip */}
      {deck.slides.length > 1 && (
        <div className="thumbs">
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
      )}

      {/* Bottom bar */}
      <div className="bar">
        <button className="bar-btn" disabled={idx === 0} onClick={() => go(-1)}>
          <ChevronLeft size={16} />
        </button>

        <div className="bar-info">
          <span className="bar-title">{slide.title || slide.id}</span>
          <span className="bar-sub">{idx + 1} / {deck.slides.length}{slide.steps > 0 ? ` · ${slide.steps} steps` : ""}</span>
        </div>

        <button className="bar-btn" disabled={idx === deck.slides.length - 1} onClick={() => go(1)}>
          <ChevronRight size={16} />
        </button>

        <div className="bar-actions">
          <button className="bar-btn" onClick={refresh} title="Refresh">
            <RotateCw size={14} />
          </button>
          <button className="bar-btn edit-btn" onClick={toggleFullscreen} title={isFullscreen ? "Collapse" : "Edit"}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? "Exit" : "Edit"}</span>
          </button>
          {deck.devServerUrl && (
            <button className="bar-btn" onClick={() => app.openLink({ url: deck.devServerUrl! })} title="Open in browser">
              <ExternalLink size={14} />
            </button>
          )}
        </div>
      </div>
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
