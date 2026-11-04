import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises"
import { isIP } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { validateOptions, PPTX_MIME } from "./options.mjs"

const PREFIX = "/__promptslide_exports"
const TERMINAL = new Set(["succeeded", "succeeded-with-issues", "rejected", "failed", "cancelled"])
const expiresMs = 15 * 60 * 1000
function tailscaleAddress(value) {
  const address = value?.replace(/^::ffff:/, "")
  if (isIP(address) === 4) {
    const [first, second] = address.split(".").map(Number)
    return first === 100 && second >= 64 && second <= 127
  }
  return isIP(address) === 6 && /^fd7a:115c:a1e0:/i.test(address)
}
function studioRequest(req, baseUrl) {
  const host = req.headers.host || ""
  const local =
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)
  // A server explicitly bound to a tailnet interface may serve exports to
  // tailnet peers. Wildcard/public bindings retain the loopback-only policy.
  const bound = new URL(baseUrl)
  const tailnet =
    bound.protocol === "http:" &&
    bound.host === host &&
    tailscaleAddress(bound.hostname.replace(/^\[|\]$/g, "")) &&
    tailscaleAddress(req.socket.remoteAddress)
  return (
    (local || tailnet) &&
    (!req.headers.origin || req.headers.origin === `http://${host}`) &&
    !["cross-site", "same-site"].includes(req.headers["sec-fetch-site"])
  )
}
async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 4096) throw Object.assign(new Error("Request too large"), { status: 413 })
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}
export function createPptxJobs({ cwd, getBaseUrl, run, now = () => Date.now() }) {
  const token = randomBytes(32).toString("hex"),
    jobs = new Map(),
    pending = new Set()
  let closed = false
  let starting = false
  const directory = mkdtemp(join(tmpdir(), "promptslide-pptx-"))
  async function remove(job) {
    jobs.delete(job.id)
    job.controller.abort(new DOMException("Export cancelled", "AbortError"))
    // DELETE completes only after the browser and temporary output are closed.
    await job.task
    await rm(join(await directory, job.id), { recursive: true, force: true })
  }
  async function prune() {
    for (const job of jobs.values())
      if (TERMINAL.has(job.status) && now() - job.updated > expiresMs) await remove(job)
  }
  const timer = setInterval(() => {
    void prune().catch(() => {})
  }, 60000)
  timer.unref()
  const summary = job => ({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    issues: job.report?.issues || [],
    metrics: job.report?.metrics,
    hasFile: !!job.file
  })
  function authorized(req) {
    const supplied = req.headers["x-promptslide-export"]
    return (
      typeof supplied === "string" &&
      /^[a-f0-9]{64}$/.test(supplied) &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
    )
  }
  const middleware = async (req, res, next) => {
    let reserved = false
    const path = req.url?.split("?")[0]
    if (!path?.startsWith(PREFIX)) return next()
    const send = (status, data) => {
      res.statusCode = status
      res.setHeader("Cache-Control", "no-store")
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify(data))
    }
    if (!studioRequest(req, getBaseUrl()) || closed)
      return send(403, {
        error: "PowerPoint exports require local Studio or an explicitly bound Tailscale interface."
      })
    if (path === PREFIX && req.method === "GET")
      return send(200, {
        supported: true,
        token,
        modes: ["balanced", "strict"],
        buildModes: ["final", "slides", "native"]
      })
    if (!authorized(req)) return send(403, { error: "Invalid export session." })
    try {
      await prune()
      if (path === PREFIX + "/pptx" && req.method === "POST") {
        if (
          req.headers.origin !== `http://${req.headers.host}` ||
          !req.headers["content-type"]?.startsWith("application/json")
        )
          return send(403, { error: "Invalid export origin or content type." })
        if (starting || pending.size || [...jobs.values()].some(j => !TERMINAL.has(j.status)))
          return send(409, { error: "An export is already running." })
        starting = true
        reserved = true
        const options = validateOptions(await readJson(req))
        while (jobs.size >= 4) await remove([...jobs.values()].find(j => TERMINAL.has(j.status)))
        const id = randomUUID(),
          job = {
            id,
            controller: new AbortController(),
            status: "running",
            updated: now(),
            progress: { phase: "preparing", completed: 0, total: 1 },
            report: null,
            file: null
          }
        jobs.set(id, job)
        const { mkdir } = await import("node:fs/promises")
        const output = join(await directory, id)
        try {
          await mkdir(output, { mode: 0o700 })
        } catch (error) {
          jobs.delete(id)
          throw error
        }
        send(202, { jobId: id })
        const task = (async () => {
          try {
            const execute = run || (await import("./export.mjs")).exportDeckPptx
            const result = await execute({
              cwd,
              baseUrl: getBaseUrl(),
              ...options,
              signal: job.controller.signal,
              onProgress: progress => {
                job.progress = progress
                job.updated = now()
              }
            })
            if (job.controller.signal.aborted || !jobs.has(id)) return
            job.report = result.report
            await writeFile(
              join(output, "report.json"),
              JSON.stringify(result.report, null, 2) + "\n",
              { mode: 0o600 }
            )
            if (result.pptx) {
              await writeFile(join(output, "slides.pptx"), result.pptx, { mode: 0o600 })
              job.file = join(output, "slides.pptx")
            }
            job.status = result.report.status
          } catch (error) {
            job.status = job.controller.signal.aborted ? "cancelled" : "failed"
            job.report = error.report || {
              status: job.status,
              issues: [{ code: "EXPORT_FAILED", severity: "error", message: error.message }]
            }
          } finally {
            job.updated = now()
            if (!jobs.has(id)) await rm(output, { recursive: true, force: true })
          }
        })()
        job.task = task
        pending.add(task)
        void task.then(
          () => pending.delete(task),
          () => pending.delete(task)
        )
        return
      }
      const match = new RegExp(`^${PREFIX}/([a-f0-9-]{36})(?:/(file|report))?$`).exec(path)
      if (!match) return send(404, { error: "Unknown export endpoint." })
      const job = jobs.get(match[1])
      if (!job) return send(404, { error: "Export expired or was removed." })
      if (!match[2] && req.method === "DELETE") {
        await remove(job)
        return send(200, { status: "cancelled" })
      }
      if (req.method !== "GET") return send(405, { error: "Method not allowed." })
      if (match[2] === "report")
        return job.report ? send(200, job.report) : send(409, { error: "Report is not ready." })
      if (match[2] === "file") {
        if (!job.file || !["succeeded", "succeeded-with-issues"].includes(job.status))
          return send(409, { error: "PowerPoint file is not available." })
        const bytes = await readFile(job.file)
        res.statusCode = 200
        res.setHeader("Cache-Control", "no-store")
        res.setHeader("Content-Type", PPTX_MIME)
        res.setHeader("Content-Disposition", 'attachment; filename="slides.pptx"')
        res.end(bytes)
        return
      }
      return send(200, summary(job))
    } catch (error) {
      return send(error.status || 400, { error: error.message })
    } finally {
      if (reserved) starting = false
    }
  }
  async function close() {
    closed = true
    clearInterval(timer)
    await Promise.all([...jobs.values()].map(remove))
    await Promise.allSettled([...pending])
    await rm(await directory, { recursive: true, force: true })
  }
  return { middleware, close, whenIdle: () => Promise.allSettled([...pending]) }
}
