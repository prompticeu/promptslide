import { Download, FileDown, FileText } from "lucide-react"
import { lazy, Suspense, useEffect, useRef, useState } from "react"

import type { PptxExportRequest } from "./types"

import { ToolbarAction } from "../toolbar-action"
import { Button } from "../ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "../ui/dropdown-menu"

export interface Issue {
  code: string
  message: string
  severity: string
  source?: { slideId?: string }
}
const preloadExportDialog = () => import("./powerpoint-dialog")
const PowerPointDialog = lazy(() =>
  preloadExportDialog().then(module => ({ default: module.PowerPointDialog }))
)

interface ExportOperation {
  cancelled: boolean
  creation: Promise<string>
}
export interface Job {
  jobId: string
  status: string
  progress?: { phase: string; completed: number; total: number }
  issues?: Issue[]
  hasFile?: boolean
  pollAfterMs?: number
}

function download(bytes: Blob, filename: string) {
  const url = URL.createObjectURL(bytes),
    link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const localExportRequest: PptxExportRequest = (path, init) =>
  fetch("/__promptslide_exports" + path, init)

/** One download entry point; server capabilities determine the available formats. */
export function DownloadMenu({
  disabled,
  onPdf,
  hasRevealSteps = false,
  exportRequest = localExportRequest
}: {
  disabled: boolean
  onPdf: () => void | Promise<void>
  hasRevealSteps?: boolean
  exportRequest?: PptxExportRequest
}) {
  const [token, setToken] = useState("")
  const [open, setOpen] = useState(false)
  const [dialogVisited, setDialogVisited] = useState(false)
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
  const jobRef = useRef<string | null>(null)
  const activeOperation = useRef<ExportOperation | null>(null)
  const alive = useRef(true)
  const button = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    let current = true
    alive.current = true
    setToken("")
    activeOperation.current = null
    jobRef.current = null
    setBusy(false)
    setCancelling(false)
    setJob(null)
    setError("")
    setOpen(false)
    setMenuOpen(false)
    void exportRequest("", { signal: controller.signal })
      .then(async response => {
        if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
          const value = await response.json()
          if (current && alive.current && value.supported && typeof value.token === "string")
            setToken(value.token)
        }
      })
      .catch(() => {})
    return () => {
      current = false
      alive.current = false
      controller.abort()
    }
  }, [exportRequest])
  useEffect(() => {
    if (!token) return
    return () => {
      const operation = activeOperation.current
      if (operation) {
        operation.cancelled = true
        void operation.creation
          .then(id =>
            exportRequest(`/${id}`, {
              method: "DELETE",
              headers: { "X-Promptslide-Export": token }
            })
          )
          .catch(() => {})
      }
    }
  }, [token, exportRequest])
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await exportRequest(path, {
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
    setDialogVisited(true)
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
        const pollAfterMs = result.pollAfterMs
        const delay =
          typeof pollAfterMs === "number" && Number.isFinite(pollAfterMs)
            ? Math.max(500, Math.min(5000, pollAfterMs))
            : 500
        await new Promise(done => setTimeout(done, delay))
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
  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <div ref={button} role="group" aria-label="Download options" className="relative flex">
          <DropdownMenuTrigger
            render={
              <ToolbarAction
                label="Download"
                title="Download PDF or PowerPoint"
                onPointerEnter={() => {
                  void preloadExportDialog()
                }}
                onFocus={() => {
                  void preloadExportDialog()
                }}
                disabled={disabled || pdfBusy}
              >
                <Download size={16} />
              </ToolbarAction>
            }
          />
          <DropdownMenuContent
            aria-label="Download format"
            align="end"
            className="w-56"
            items={[
              {
                label: "PDF (.pdf)",
                icon: <FileText size={16} />,
                onClick: () => {
                  setMenuOpen(false)
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
                }
              },
              ...(token
                ? [{ label: "PowerPoint (.pptx)", icon: <FileDown size={16} />, onClick: show }]
                : [])
            ]}
          />
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
              <Button
                variant="unstyled"
                type="button"
                className="underline"
                onClick={() => setPdfError("")}
              >
                Dismiss
              </Button>
            </div>
          ) : null}
        </div>
      </DropdownMenu>
      {dialogVisited && (
        <Suspense
          fallback={
            open ? (
              <span
                role="status"
                className="fixed right-4 top-14 z-[201] rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-300"
              >
                Opening export options…
              </span>
            ) : null
          }
        >
          <PowerPointDialog
            open={open}
            busy={busy}
            cancelling={cancelling}
            job={job}
            error={error}
            hasRevealSteps={hasRevealSteps}
            hasDraft={hasDraft}
            builds={builds}
            savedOnly={savedOnly}
            onBuildsChange={setBuilds}
            onSavedOnlyChange={setSavedOnly}
            onClose={close}
            onStart={start}
            onCancel={cancel}
            onReport={report}
            triggerRef={button}
          />
        </Suspense>
      )}
    </>
  )
}
