import { Download, FileDown, FileText, X } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { ToolbarAction } from "../toolbar-action"

interface Issue {
  code: string
  message: string
  severity: string
  source?: { slideId?: string }
}
interface ExportOperation {
  cancelled: boolean
  creation: Promise<string>
}
interface Job {
  jobId: string
  status: string
  progress?: { phase: string; completed: number; total: number }
  issues?: Issue[]
  hasFile?: boolean
}

const issueLabels: Record<string, [string, string]> = {
  FONT_DOWNLOAD_FAILED: [
    "Web fonts did not load",
    "The export may use substitute fonts. Retry the export when the font source is available."
  ],
  STYLESHEET_DOWNLOAD_FAILED: [
    "Slide styling did not load",
    "Some styling could not be loaded. Retry the export before relying on its layout."
  ],
  FONT_UNAVAILABLE: [
    "Fonts could not be embedded",
    "Install the original fonts on the computer opening this file to keep the typography consistent."
  ],
  FONT_EMBEDDING_RESTRICTED: [
    "Font embedding is restricted",
    "These fonts require installation on the recipient’s computer."
  ],
  SVG_EFFECT_FALLBACK: [
    "Some effects are graphics",
    "Masked or filtered artwork keeps its appearance as an image."
  ],
  COMPLEX_COMPOSITION_FALLBACK: [
    "Some components are graphics",
    "Complex clipped layouts keep their appearance as images; their contents cannot be edited separately."
  ],
  SVG_TEXT_AFFINE_FALLBACK: [
    "Some transformed labels are graphics",
    "These labels keep their appearance as images rather than editable text."
  ],
  SVG_TEXT_OUTLINED: [
    "Some labels are outlined",
    "Letters are editable shapes rather than editable text."
  ],
  CLIPPED_PAINT_FALLBACK: [
    "Clipped edges are graphics",
    "Content inside clipped layouts remains editable. Partially visible elements are kept as images."
  ],
  SVG_PATTERN_MASK_APPROXIMATED: [
    "Dot patterns use native shapes",
    "Each dot is editable, with closely matched mask transparency."
  ],
  MULTIPLE_FONT_FALLBACK: [
    "Some symbols use fallback fonts",
    "Text using multiple fonts may have different spacing in PowerPoint."
  ],
  GRADIENT_INTERPOLATION_APPROXIMATED: [
    "Transparent gradients are approximated",
    "Gradients remain editable, with a closely matched color and transparency falloff."
  ],
  ELLIPTICAL_GRADIENT_APPROXIMATED: [
    "Elliptical glows use grouped shapes",
    "Glows remain editable. Some presentation apps may show seams between the shapes."
  ],
  SVG_GROUP_OPACITY_APPROXIMATED: [
    "Overlapping transparency may differ",
    "Transparency is applied to individual shapes, which can affect overlapping edges."
  ]
}

function groupIssues(issues: Issue[]) {
  const groups = new Map<string, { code: string; severity: string; issues: Issue[] }>()
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.code}`
    const group = groups.get(key) || { code: issue.code, severity: issue.severity, issues: [] }
    group.issues.push(issue)
    groups.set(key, group)
  }
  return [...groups.values()]
}

function download(bytes: Blob, filename: string) {
  const url = URL.createObjectURL(bytes),
    link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
/** One download entry point; server capabilities determine the available formats. */
export function DownloadMenu({
  disabled,
  onPdf,
  hasRevealSteps = false
}: {
  disabled: boolean
  onPdf: () => void | Promise<void>
  hasRevealSteps?: boolean
}) {
  const [token, setToken] = useState("")
  const [open, setOpen] = useState(false)
  const [builds, setBuilds] = useState("final")
  const [job, setJob] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState("")
  const [savedOnly, setSavedOnly] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState("")
  const menuId = useId()
  const jobRef = useRef<string | null>(null)
  const activeOperation = useRef<ExportOperation | null>(null)
  const alive = useRef(true)
  const button = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (menuOpen) menu.current?.querySelector<HTMLButtonElement>("button")?.focus()
  }, [menuOpen])
  useLayoutEffect(() => {
    if (open) dialog.current?.focus()
  }, [open])
  useEffect(() => {
    if (!menuOpen) return
    const outside = (event: PointerEvent) => {
      if (!button.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [menuOpen])
  useEffect(() => {
    const controller = new AbortController()
    alive.current = true
    void fetch("/__promptslide_exports", { signal: controller.signal })
      .then(async response => {
        if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
          const value = await response.json()
          if (alive.current && value.supported && typeof value.token === "string")
            setToken(value.token)
        }
      })
      .catch(() => {})
    return () => {
      alive.current = false
      controller.abort()
    }
  }, [])
  useEffect(() => {
    if (!token) return
    return () => {
      const operation = activeOperation.current
      if (operation) {
        operation.cancelled = true
        void operation.creation
          .then(id =>
            fetch(`/__promptslide_exports/${id}`, {
              method: "DELETE",
              headers: { "X-Promptslide-Export": token }
            })
          )
          .catch(() => {})
      }
    }
  }, [token])
  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setOpen(false)
        button.current?.querySelector("button")?.focus()
      }
      if (event.key === "Tab") {
        const items = [
          ...(dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),select:not(:disabled),input:not(:disabled),a[href],summary"
          ) || [])
        ].filter(item => item.getClientRects().length > 0)
        const first = items[0],
          last = items[items.length - 1]
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === dialog.current)
        ) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [open, busy])
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch("/__promptslide_exports" + path, {
      ...init,
      headers: { "X-Promptslide-Export": token, ...init.headers }
    })
    if (!response.ok) {
      const value = await response.json().catch(() => ({}))
      throw new Error(value.error || `Export request failed (${response.status})`)
    }
    return response
  }
  const show = () => {
    setMenuOpen(false)
    try {
      setHasDraft(
        Object.keys(JSON.parse(sessionStorage.getItem("promptslide:editor-draft") || "{}")).length >
          0
      )
    } catch {
      setHasDraft(false)
    }
    setBuilds("final")
    setSavedOnly(false)
    setError("")
    setJob(null)
    setOpen(true)
  }
  const cancel = async () => {
    const operation = activeOperation.current
    if (!operation || operation.cancelled) return
    operation.cancelled = true
    setCancelling(true)
    try {
      const id = await operation.creation
      await request(`/${id}`, { method: "DELETE" }).catch(() => {})
    } catch {
      /* Failed creation leaves no server job to remove. */
    }
    if (alive.current && activeOperation.current === operation) {
      setBusy(false)
      setCancelling(false)
      setJob(current => ({
        ...current,
        jobId: current?.jobId || jobRef.current || "",
        status: "cancelled"
      }))
    }
  }
  const start = async () => {
    if (busy) return
    jobRef.current = null
    setBusy(true)
    setCancelling(false)
    setError("")
    setJob(null)
    const operation: ExportOperation = {
      cancelled: false,
      creation: request("/pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "balanced", buildMode: hasRevealSteps ? builds : "final" })
      }).then(async response => {
        const { jobId } = await response.json()
        return jobId
      })
    }
    activeOperation.current = operation
    const current = () =>
      alive.current && activeOperation.current === operation && !operation.cancelled
    try {
      const jobId = await operation.creation
      if (!current()) return
      jobRef.current = jobId
      for (;;) {
        if (!current()) return
        const result = (await (await request(`/${jobId}`)).json()) as Job
        if (!current()) return
        setJob(result)
        if (
          ["succeeded", "succeeded-with-issues", "failed", "rejected", "cancelled"].includes(
            result.status
          )
        ) {
          if (result.hasFile) {
            const file = await (await request(`/${jobId}/file`)).blob()
            if (current()) download(file, "slides.pptx")
          }
          break
        }
        await new Promise(done => setTimeout(done, 500))
      }
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : "PowerPoint export failed")
    } finally {
      if (current()) setBusy(false)
    }
  }
  const report = async () => {
    if (!jobRef.current) return
    try {
      download(await (await request(`/${jobRef.current}/report`)).blob(), "slides.pptx.report.json")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report unavailable")
    }
  }
  const close = () => {
    setOpen(false)
    button.current?.querySelector("button")?.focus()
  }
  const status = cancelling
    ? "Cancelling export…"
    : job?.status === "rejected"
      ? "Export needs attention"
      : job?.status === "succeeded-with-issues"
        ? "PowerPoint exported"
        : job?.status === "succeeded"
          ? "PowerPoint exported"
          : job?.status === "failed"
            ? "Export failed"
            : job?.status === "cancelled"
              ? "Export cancelled"
              : busy
                ? "Exporting PowerPoint…"
                : "Export PowerPoint"
  const finished = !!job?.hasFile && !busy
  const issueGroups = groupIssues(job?.issues || [])
  const warnings = issueGroups.filter(group => group.severity !== "info")
  const information = issueGroups.filter(group => group.severity === "info")
  const progress = job?.progress
  const rendering = progress?.phase === "rendering"
  const progressLabel = rendering
    ? progress.completed < progress.total
      ? `Converting slide ${Math.min(progress.completed + 1, progress.total)} of ${progress.total}`
      : "Finishing your PowerPoint"
    : "Preparing your slides"
  const progressPercent = progress?.total
    ? Math.min(100, Math.max(0, (progress.completed / progress.total) * 100))
    : 0
  const description = busy
    ? "Converting your slides to PowerPoint."
    : finished
      ? "Your .pptx file is ready. The download has started."
      : "Keep text, shapes, and supported effects editable in PowerPoint."
  return (
    <>
      <div
        ref={button}
        role="group"
        aria-label="Download options"
        className="relative flex"
        onBlur={event => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
            setMenuOpen(false)
        }}
        onKeyDown={event => {
          event.stopPropagation()
          if (event.key === "Escape") {
            setMenuOpen(false)
            button.current?.querySelector("button")?.focus()
          } else if (menuOpen && event.key === "Tab") {
            button.current?.querySelector("button")?.focus()
            setMenuOpen(false)
          } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault()
            if (!menuOpen) {
              setMenuOpen(true)
              return
            }
            const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button") || [])]
            const current = items.indexOf(document.activeElement as HTMLButtonElement)
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
            items[next]?.focus()
          }
        }}
      >
        <ToolbarAction
          label="Download"
          title="Download PDF or PowerPoint"
          disabled={disabled || pdfBusy}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={() => setMenuOpen(value => !value)}
        >
          <Download size={16} />
        </ToolbarAction>
        {menuOpen ? (
          <div
            ref={menu}
            id={menuId}
            role="menu"
            aria-label="Download format"
            className="absolute right-0 top-10 w-56 rounded-lg border border-neutral-700 bg-neutral-950 p-1 text-sm text-white"
          >
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-neutral-800 focus:bg-neutral-800 focus:outline-none"
              onClick={() => {
                setMenuOpen(false)
                button.current?.querySelector("button")?.focus()
                setPdfError("")
                setPdfBusy(true)
                void Promise.resolve()
                  .then(onPdf)
                  .catch(cause => {
                    if (alive.current)
                      setPdfError(cause instanceof Error ? cause.message : "PDF export failed")
                  })
                  .finally(() => {
                    if (alive.current) setPdfBusy(false)
                  })
              }}
            >
              <FileText size={16} /> <span className="flex-1">PDF (.pdf)</span>
            </button>
            {token ? (
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-neutral-800 focus:bg-neutral-800 focus:outline-none"
                onClick={show}
              >
                <FileDown size={16} /> PowerPoint (.pptx)
              </button>
            ) : null}
          </div>
        ) : null}
        {pdfBusy ? (
          <span
            role="status"
            className="absolute right-0 top-10 whitespace-nowrap rounded-md bg-neutral-950 px-3 py-2 text-sm text-neutral-300"
          >
            Preparing PDF…
          </span>
        ) : null}
        {pdfError ? (
          <div
            role="alert"
            className="absolute right-0 top-10 w-80 rounded-md border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-200"
          >
            <p className="mb-2">{pdfError}</p>
            <button type="button" className="underline" onClick={() => setPdfError("")}>
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6">
              <div
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pptx-export-title"
                aria-describedby="pptx-export-description"
                tabIndex={-1}
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#111111] text-neutral-100 outline-none"
              >
                <div className="px-6 pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <h2 id="pptx-export-title" className="text-lg font-semibold">
                      {status}
                    </h2>
                    <button
                      type="button"
                      aria-label="Close export"
                      disabled={busy}
                      onClick={close}
                      className="-mr-1 -mt-1 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B35] disabled:opacity-30"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <p
                    id="pptx-export-description"
                    className="mt-2 text-sm leading-relaxed text-neutral-400"
                  >
                    {description}
                  </p>
                </div>
                <div className="px-6">
                  {hasRevealSteps && !busy && !job ? (
                    <details className="mt-5 rounded border border-neutral-800 p-3 text-sm">
                      <summary className="cursor-pointer font-medium">Animation options</summary>
                      <p className="mt-2 text-neutral-400">
                        By default, each slide includes all revealed content.
                      </p>
                      <label className="mt-3 block">
                        Slide reveals
                        <select
                          aria-label="Slide reveals"
                          value={builds}
                          disabled={busy}
                          onChange={e => setBuilds(e.target.value)}
                          className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 p-2"
                        >
                          <option value="final">Show all content</option>
                          <option value="slides">One slide per reveal</option>
                          <option value="native">Animate reveals in PowerPoint</option>
                        </select>
                      </label>
                    </details>
                  ) : null}
                  {hasDraft && !busy && !job ? (
                    <div className="mt-4 rounded border border-amber-700 p-3 text-sm">
                      <p>There are unsaved editor changes.</p>
                      <label className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={savedOnly}
                          onChange={e => setSavedOnly(e.target.checked)}
                        />
                        Export the last saved version
                      </label>
                      <button
                        type="button"
                        className="mt-2 underline"
                        onClick={() => {
                          close()
                          window.dispatchEvent(
                            new CustomEvent("promptslide:editor-request", {
                              detail: { open: true }
                            })
                          )
                        }}
                      >
                        Open editor to save changes
                      </button>
                    </div>
                  ) : null}
                  <div role="status" aria-live="polite" className="sr-only">
                    {busy ? progressLabel : status}
                  </div>
                  {busy ? (
                    <div className="py-6">
                      <div className="mb-3 flex items-center justify-between gap-4 text-sm">
                        <span className="font-medium text-neutral-200">{progressLabel}</span>
                        {rendering ? (
                          <span className="text-xs tabular-nums text-neutral-500">
                            {progress.completed} / {progress.total} ready
                          </span>
                        ) : null}
                      </div>
                      <div
                        role="progressbar"
                        aria-label="Slide conversion"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={rendering ? Math.round(progressPercent) : undefined}
                        className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
                      >
                        <div
                          className={`h-full rounded-full bg-[#FF6B35] transition-[width] duration-500 ${!rendering ? "w-1/4 motion-safe:animate-pulse" : ""}`}
                          style={rendering ? { width: `${progressPercent}%` } : undefined}
                        />
                      </div>
                      <p className="mt-3 text-xs text-neutral-500">
                        Complex slides may take a little longer.
                      </p>
                    </div>
                  ) : null}
                  {error ? (
                    <p role="alert" className="mt-3 text-sm text-red-300">
                      {error}
                    </p>
                  ) : null}
                  {!busy && warnings.length ? (
                    <details
                      className="mt-5 text-sm"
                      open={
                        job?.status === "failed" ||
                        job?.status === "rejected" ||
                        warnings.some(
                          group =>
                            group.code.startsWith("FONT_") ||
                            group.code === "STYLESHEET_DOWNLOAD_FAILED"
                        ) ||
                        undefined
                      }
                    >
                      <summary className="cursor-pointer text-neutral-300 marker:text-neutral-500 hover:text-white">
                        <span className="ml-1">
                          {warnings.length} compatibility {warnings.length === 1 ? "note" : "notes"}
                        </span>
                      </summary>
                      <ul className="mt-4 space-y-4 pl-4">
                        {warnings.map(group => {
                          const slides = [
                            ...new Set(
                              group.issues.map(issue => issue.source?.slideId).filter(Boolean)
                            )
                          ]
                          const [title, detail] = issueLabels[group.code] || [
                            group.code.replaceAll("_", " ").toLowerCase(),
                            group.issues[0].message
                          ]
                          return (
                            <li key={`${group.severity}:${group.code}`}>
                              <p
                                className={`text-sm font-medium ${group.code.startsWith("FONT_") || group.severity === "error" ? "text-amber-200" : "text-neutral-200"}`}
                              >
                                {title}
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                                {detail}
                              </p>
                              <p className="mt-1.5 text-[11px] text-neutral-500">
                                {group.issues.length}{" "}
                                {group.issues.length === 1 ? "element" : "elements"}
                                {slides.length
                                  ? ` · ${slides.length} ${slides.length === 1 ? "slide" : "slides"}`
                                  : ""}
                              </p>
                              {group.code.startsWith("FONT_") && issueLabels[group.code] ? (
                                <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                                  {[...new Set(group.issues.map(issue => issue.message))].join(" ")}
                                </p>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </details>
                  ) : null}
                  {!busy && information.length ? (
                    <details className="my-4 text-xs text-neutral-500">
                      <summary className="cursor-pointer hover:text-neutral-300">
                        Conversion details
                      </summary>
                      <ul className="mt-2 space-y-2 text-neutral-400">
                        {information.map(group => (
                          <li key={group.code}>
                            {group.issues[0].message}{" "}
                            <span className="text-neutral-500">({group.issues.length})</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 px-6 pb-6 pt-5">
                  {job && !busy && job.status !== "cancelled" ? (
                    <button
                      type="button"
                      onClick={() => void report()}
                      className="rounded-lg px-3 py-2 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B35]"
                    >
                      Download report
                    </button>
                  ) : null}
                  {busy ? (
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={() => void cancel()}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B35]"
                    >
                      {cancelling ? "Cancelling…" : "Cancel export"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={hasDraft && !savedOnly}
                      onClick={() => void start()}
                      className={
                        finished
                          ? "rounded-lg px-3 py-2 text-xs text-neutral-400 hover:bg-white/5 hover:text-white"
                          : "rounded-lg bg-[#FF6B35] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#ff824f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B35] disabled:opacity-40"
                      }
                    >
                      {job ? "Export again" : "Export .pptx"}
                    </button>
                  )}
                  {finished ? (
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-lg bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#ff824f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B35]"
                    >
                      Done
                    </button>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
