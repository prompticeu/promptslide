import type { BrowserPptxOptions, BrowserPptxResult } from "../../browser"
import type { PptxExportRequest } from "./types"

type Runner = (
  options: Pick<BrowserPptxOptions, "mode" | "buildMode" | "signal" | "onProgress">
) => Promise<BrowserPptxResult>
const json = (body: unknown, status = 200) => Response.json(body, { status })

/** In-memory implementation of the existing download dialog protocol. No HTTP requests. */
export function createBrowserExportRequest(run: Runner) {
  let job:
    | {
        id: string
        controller: AbortController
        status: string
        progress?: unknown
        result?: BrowserPptxResult
        error?: string
        settled?: Promise<void>
      }
    | undefined
  let disposed = false
  const request: PptxExportRequest = async (path, init = {}) => {
    init.signal?.throwIfAborted()
    if (!path)
      return json({
        supported: typeof WebAssembly !== "undefined" && typeof Blob !== "undefined",
        token: "browser"
      })
    if (disposed) return json({ error: "Export viewer was closed" }, 410)
    if (path === "/pptx" && init.method === "POST") {
      if (job && ["preparing", "rendering", "converting"].includes(job.status))
        return json({ error: "An export is already running" }, 409)
      const input = JSON.parse(String(init.body || "{}"))
      if (Object.keys(input).some(k => !["mode", "buildMode"].includes(k)))
        return json({ error: "Invalid browser export options" }, 400)
      if (
        (input.mode && !["balanced", "strict"].includes(input.mode)) ||
        (input.buildMode && !["final", "native", "slides"].includes(input.buildMode))
      )
        return json({ error: "Invalid browser export options" }, 400)
      const current: NonNullable<typeof job> = (job = {
        id:
          crypto.randomUUID?.() ||
          Array.from(crypto.getRandomValues(new Uint8Array(16)), value =>
            value.toString(16).padStart(2, "0")
          ).join(""),
        controller: new AbortController(),
        status: "preparing"
      })
      current.settled = run({
        ...input,
        signal: current.controller.signal,
        onProgress: progress => {
          if (!current.controller.signal.aborted) {
            current.status = progress.phase === "completed" ? "converting" : progress.phase
            current.progress = progress
          }
        }
      })
        .then(result => {
          if (!current.controller.signal.aborted) {
            current.result = result
            current.status = result.report.status
          }
        })
        .catch(error => {
          current.status = current.controller.signal.aborted ? "cancelled" : "failed"
          current.error = error.message
          current.result = {
            report: error.report || {
              status: current.status,
              issues: [{ code: "EXPORT_FAILED", severity: "error", message: error.message }]
            }
          }
        })
      return json({ jobId: current.id }, 202)
    }
    const parts = path.split("/").filter(Boolean)
    if (!job || parts[0] !== job.id) return json({ error: "Export not found" }, 404)
    if (init.method === "DELETE") {
      const current = job
      current.controller.abort()
      await current.settled
      current.result = undefined
      current.status = "cancelled"
      return json({ status: "cancelled" })
    }
    if (parts[1] === "report")
      return job.result ? json(job.result.report) : json({ error: "Report is not ready" }, 409)
    if (parts[1] === "file")
      return job.result?.pptx
        ? new Response(
            new Blob([job.result.pptx as BlobPart], {
              type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            })
          )
        : json({ error: "File is not ready" }, 409)
    if (parts.length !== 1) return json({ error: "Unknown export request" }, 404)
    return json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      issues: job.result?.report.issues || [],
      hasFile: !!job.result?.pptx
    })
  }
  return {
    request,
    activate() {
      disposed = false
    },
    dispose() {
      disposed = true
      job?.controller.abort()
      job = undefined
    }
  }
}
