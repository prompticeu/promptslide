import { initializeHarfBuzz } from "harfbuzzjs"

import { abortable } from "../core/export/abort.ts"
import { extractScene } from "../core/export/measure.mjs"
import { DEFAULT_LIMITS, validateOptions, unionArea } from "../utils/pptx/options.mjs"
import { outlineSvgText } from "../utils/pptx/outlines.mjs"
import { prepareTextFonts } from "../utils/pptx/text-planning.mjs"
import { writePresentation } from "../utils/pptx/writer.mjs"
import { resolvePictures } from "./capture.mjs"
import { browserFonts } from "./fonts.mjs"

let exportSerial = 0
const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0))

/** Existing scene/font/OOXML engines, running against a caller-owned export root. */
export async function exportBrowserPptx({
  manifest,
  render,
  theme = {},
  adapters = [],
  fontSources = [],
  signal,
  onProgress = () => {},
  ...input
}) {
  const options = validateOptions(input)
  const scopeId = String(++exportSerial)
  let measuredRoot
  if (!manifest?.length || manifest.length > DEFAULT_LIMITS.slides)
    throw new Error("LIMIT_EXCEEDED: export supports 1–100 slides")
  if (new Set(manifest.map(s => s.id)).size !== manifest.length)
    throw new Error("Slide IDs must be unique")
  if (manifest.some(s => !Number.isInteger(s.steps) || s.steps < 0 || s.steps > 100))
    throw new Error("Invalid slide build step count")
  const total = manifest.reduce((n, s) => n + (options.buildMode === "slides" ? s.steps + 1 : 1), 0)
  if (total > 500) throw new Error("LIMIT_EXCEEDED: build states exceed 500 slides")
  const controller = new AbortController()
  const cancel = () => controller.abort(signal.reason)
  signal?.addEventListener("abort", cancel, { once: true })
  if (signal?.aborted) cancel()
  const timer = setTimeout(
    () => controller.abort(new Error("EXPORT_TIMEOUT: Browser export timed out")),
    options.timeout * 1000
  )
  const abort = controller.signal,
    started = performance.now()
  const report = {
    schemaVersion: 1,
    engineVersion: "1.0.0",
    status: "failed",
    mode: options.mode,
    profile: options.profile,
    buildMode: options.buildMode,
    sourceRevision: "",
    renderer: { browser: navigator.userAgent, platform: navigator.platform },
    qualification: { visualFidelity: "not-evaluated", microsoftPowerPoint: "not-qualified" },
    slides: [],
    issues: [],
    metrics: {},
    timings: {}
  }
  const frames = []
  let fontState,
    nodeCount = 0,
    pixels = 0
  try {
    abort.throwIfAborted()
    await abortable(initializeHarfBuzz(), abort)
    onProgress({ phase: "preparing", completed: 0, total })
    for (let index = 0; index < manifest.length; index++) {
      const meta = manifest[index]
      const steps =
        options.buildMode === "slides"
          ? Array.from({ length: meta.steps + 1 }, (_, n) => n)
          : [meta.steps]
      for (const step of steps) {
        abort.throwIfAborted()
        const root = await abortable(
          render(index, step, options.buildMode !== "slides", abort),
          abort
        )
        if (!root || root.ownerDocument !== document)
          throw new Error("Export renderer must return a root in the current document")
        if (root.querySelector("[data-slide-error]"))
          throw new Error(root.querySelector("[data-slide-error]").getAttribute("data-slide-error"))
        if (options.buildMode === "native" && root.querySelector("[data-ps-morph]"))
          throw new Error(
            "Native animation does not support Morph; use final visible state or one slide per state"
          )
        fontState = await abortable(
          browserFonts(root, {
            sources: fontSources,
            signal: abort,
            policy: options.fontPolicy,
            onIssue: i => report.issues.push(i),
            state: fontState
          }),
          abort
        )
        const scene = await abortable(
          extractScene(root, { slideId: meta.id, adapters, signal: abort }),
          abort
        )
        nodeCount += scene.nodes.reduce(
          (count, n) =>
            count +
            1 +
            (n.payload.fill?.kind === "elliptical"
              ? n.payload.fill.layers
              : n.kind === "table"
                ? n.payload.rows.reduce((s, row) => s + row.length, 0)
                : n.kind === "chart"
                  ? n.payload.series.reduce((s, series) => s + series.values.length, 0)
                  : 0),
          0
        )
        if (nodeCount > DEFAULT_LIMITS.nodes) throw new Error("LIMIT_EXCEEDED: scene nodes")
        measuredRoot = root
        root.setAttribute("data-ps-browser-export-root", scopeId)
        await abortable(
          prepareTextFonts(
            scene,
            fontState.fonts,
            { evaluate: async (fn, args) => fn(args) },
            `[data-ps-browser-export-root="${scopeId}"]`
          ),
          abort
        )
        await abortable(outlineSvgText(scene, fontState.fonts), abort)
        await abortable(
          resolvePictures(root, scene, {
            fontCss: fontState.css,
            signal: abort,
            scale: options.rasterScale
          }),
          abort
        )
        for (const node of scene.nodes)
          if (node.kind === "fallback" || node.kind === "picture")
            pixels +=
              Math.ceil(node.box.width * options.rasterScale) *
              Math.ceil(node.box.height * options.rasterScale)
        if (pixels > DEFAULT_LIMITS.decodedPixels)
          throw new Error("LIMIT_EXCEEDED: decoded image pixels")
        const frame = { ...scene, ...meta, slideId: meta.id, stateId: `${meta.id}:${step}`, step }
        frames.push(frame)
        report.slides.push({
          id: meta.id,
          stateId: frame.stateId,
          title: meta.title,
          step,
          sourceObjects: scene.nodes.length,
          fallbackObjects: scene.nodes
            .filter(n => n.kind === "fallback")
            .map(n => ({
              source: n.source,
              box: n.box,
              reason: n.payload.reason,
              textCharacters: n.payload.textCharacters
            }))
        })
        report.issues.push(...scene.issues)
        onProgress({ phase: "rendering", completed: frames.length, total, slideId: meta.id })
        await yieldTask()
      }
    }
    abort.throwIfAborted()
    report.timings.renderingMs = Math.round(performance.now() - started)
    const result = await abortable(
      writePresentation(frames, {
        fonts: fontState.fonts,
        theme,
        buildMode: options.buildMode,
        signal: abort,
        onProgress,
        outputType: "uint8array"
      }),
      abort
    )
    abort.throwIfAborted()
    const all = frames.flatMap(f => f.nodes),
      fallback = all.filter(n => n.kind === "fallback")
    report.objectMap = result.objectMap
    report.fonts = result.fonts
    report.metrics = {
      nativeEligibleObjects: all.filter(n => n.kind !== "picture").length,
      nativeExactObjects:
        result.objectMap.filter(o => o.representation === "native").length -
        all.filter(n => n.kind === "picture").length,
      nativeApproximateObjects: result.objectMap.filter(
        o => o.representation === "native-approximation"
      ).length,
      editableTextCharacters: all
        .filter(n => n.kind === "text" || n.kind === "table")
        .reduce((s, n) => s + (n.payload.textCharacters || 0), 0),
      sourceTextCharacters: all.reduce((s, n) => s + (n.payload.textCharacters || 0), 0),
      svgFallbackObjects: 0,
      rasterFallbackObjects: fallback.length,
      fallbackAreaRatio:
        frames.reduce(
          (s, f) =>
            s +
            unionArea(f.nodes.filter(n => n.kind === "fallback").map(n => n.box)) / (1280 * 720),
          0
        ) / frames.length,
      semanticChartsRetained: all.filter(n => n.kind === "chart").length,
      semanticTablesRetained: all.filter(n => n.kind === "table").length
    }
    const allowed =
      options.profile === "extended" ? new Set(["GRADIENT_INTERPOLATION_APPROXIMATED"]) : new Set()
    const rejected =
      options.mode === "strict" &&
      (fallback.length ||
        report.issues.some(
          i => (i.severity === "warning" && !allowed.has(i.code)) || i.severity === "error"
        ))
    report.status = rejected
      ? "rejected"
      : report.issues.some(i => i.severity === "warning")
        ? "succeeded-with-issues"
        : "succeeded"
    report.timings.totalMs = Math.round(performance.now() - started)
    onProgress({ phase: "completed", completed: total, total })
    return { pptx: rejected ? undefined : result.buffer, report }
  } catch (error) {
    report.status = abort.aborted && abort.reason?.name === "AbortError" ? "cancelled" : "failed"
    report.issues.push({
      code: report.status === "cancelled" ? "CANCELLED" : String(error.message).split(":")[0],
      severity: "error",
      message: error.message
    })
    error.report = report
    throw error
  } finally {
    if (measuredRoot?.getAttribute("data-ps-browser-export-root") === scopeId)
      measuredRoot.removeAttribute("data-ps-browser-export-root")
    clearTimeout(timer)
    signal?.removeEventListener("abort", cancel)
  }
}
