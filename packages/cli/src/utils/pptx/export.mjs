import { createHash } from "node:crypto"
import { readFile, readdir, realpath, stat } from "node:fs/promises"
import { join, resolve, relative } from "node:path"

import { chromium } from "playwright"

import { getCaptureServer, launchChromium } from "../export.mjs"
import { installFontRetries } from "./font-network.mjs"
import { decodeFont, FontResolver } from "./fonts.mjs"
import { DEFAULT_LIMITS, validateOptions, assertNotAborted, unionArea } from "./options.mjs"
import { outlineSvgText } from "./outlines.mjs"
import { prepareTextFonts } from "./text-planning.mjs"
import { writePresentation } from "./writer.mjs"

const hash = value => createHash("sha256").update(value).digest("hex")
// Snapshot metadata avoids reading large media twice. Include ctime as well as
// mtime/size so same-size writes with a restored mtime still invalidate capture.
export async function projectRevision(cwd) {
  const digest = createHash("sha256")
  async function walk(path, ancestors = new Set(), depth = 0) {
    if (depth > 20) throw new Error("Source directory nesting limit exceeded")
    let target, info
    try {
      target = await realpath(path)
      info = await stat(target, { bigint: true })
    } catch (error) {
      if (depth === 0 && error.code === "ENOENT") return
      throw error
    }
    digest.update(
      JSON.stringify([
        relative(cwd, path),
        target,
        String(info.size),
        String(info.mtimeNs),
        String(info.ctimeNs),
        String(info.ino),
        String(info.dev)
      ])
    )
    if (!info.isDirectory()) return
    if (ancestors.has(target)) throw new Error("Source/asset symlink cycle detected")
    const nested = new Set([...ancestors, target])
    for (const name of (await readdir(path)).sort()) {
      if (name === "node_modules" || name.startsWith(".")) continue
      await walk(join(path, name), nested, depth + 1)
    }
  }
  await walk(join(cwd, "src"))
  await walk(join(cwd, "public"))
  return digest.digest("hex")
}

function issueReport(report, issue) {
  report.issues.push(issue)
}
async function actualFonts(page, scene) {
  const session = await page.context().newCDPSession(page)
  try {
    await session.send("DOM.enable")
    await session.send("CSS.enable")
    const { root } = await session.send("DOM.getDocument")
    const targets = scene.nodes.flatMap(node =>
      node.kind === "text" || node.kind === "chart"
        ? [
            {
              target: node,
              id: node.source.elementId || node.source.objectId.replace(/:text$/, "")
            }
          ]
        : node.kind === "table"
          ? node.payload.rows
              .flat()
              .filter(cell => cell.elementId)
              .map(cell => ({ target: cell, id: cell.elementId }))
          : []
    )
    for (const { target, id } of targets) {
      const selector = await page.evaluate(
        elementId => `[data-ps-pptx-object="${CSS.escape(elementId)}"]`,
        id
      )
      const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector })
      if (nodeId)
        target.actualFonts = (await session.send("CSS.getPlatformFontsForNode", { nodeId })).fonts
    }
  } finally {
    await session.detach()
  }
}

async function resolvePictures(page, scene, scale, signal, pixels) {
  for (const node of [...scene.nodes]) {
    assertNotAborted(signal)
    if (!["fallback", "picture"].includes(node.kind)) continue
    if (node.kind === "picture") {
      let bytes, type
      if (node.payload.url.startsWith("data:")) {
        const data = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(node.payload.url)
        if (!data) throw new Error("Invalid image data URL")
        type = data[1]
        bytes = data[2] ? Buffer.from(data[3], "base64") : Buffer.from(decodeURIComponent(data[3]))
      } else {
        const response = await page.request.get(node.payload.url, {
          timeout: 30000,
          failOnStatusCode: true
        })
        bytes = await response.body()
        type = response.headers()["content-type"]?.split(";")[0] || "image/png"
      }
      if (bytes.length > DEFAULT_LIMITS.assetBytes) throw new Error("LIMIT_EXCEEDED: picture asset")
      if (!/^image\/(png|jpeg|gif|svg\+xml|webp|avif)/.test(type))
        throw new Error("Unsupported picture media type")
      pixels.count += node.payload.naturalWidth * node.payload.naturalHeight
      if (pixels.count > DEFAULT_LIMITS.decodedPixels)
        throw new Error("LIMIT_EXCEEDED: decoded picture size")
      // PowerPoint cannot display WebP/AVIF consistently; preserve as a localized PNG.
      if (/svg/.test(type)) {
        // Keep vector data and supply a real browser-generated PNG compatibility image.
        const svg = bytes.toString("utf8")
        if (
          !/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:)|url\(\s*["']?https?:/i.test(
            svg
          )
        ) {
          try {
            const width = Math.max(
              1,
              Math.ceil(
                node.payload.naturalWidth *
                  Math.max(
                    1,
                    (node.box.width * scale) / node.payload.naturalWidth,
                    (node.box.height * scale) / node.payload.naturalHeight
                  )
              )
            )
            const height = Math.max(
              1,
              Math.ceil((width * node.payload.naturalHeight) / node.payload.naturalWidth)
            )
            pixels.count += width * height
            if (pixels.count > DEFAULT_LIMITS.decodedPixels)
              throw new Error("LIMIT_EXCEEDED: SVG compatibility image size")
            const png = await page.evaluate(
              ({ elementId, width: pixelWidth, height: pixelHeight }) => {
                const image = [...document.querySelectorAll("[data-ps-pptx-object]")].find(
                  e => e.getAttribute("data-ps-pptx-object") === elementId
                )
                const canvas = document.createElement("canvas")
                canvas.width = pixelWidth
                canvas.height = pixelHeight
                canvas.getContext("2d").drawImage(image, 0, 0, pixelWidth, pixelHeight)
                return canvas.toDataURL("image/png")
              },
              { elementId: node.source.elementId, width, height }
            )
            node.payload.svgData = svg
            node.payload.data = png
            node.payload.assetHash = hash(bytes)
            continue
          } catch {
            /* Tainted/external SVGs retain their displayed appearance below. */
          }
        }
      }
      if (/webp|avif|svg/.test(type)) {
        node.kind = "fallback"
        node.payload = {
          ...node.payload,
          scope: "subtree",
          elementId: node.source.elementId || node.source.objectId,
          reason: "IMAGE_FORMAT_NORMALIZED",
          textCharacters: 0
        }
        scene.issues.push({
          code: "IMAGE_FORMAT_NORMALIZED",
          severity: "warning",
          source: node.source,
          message:
            "Image retained as its displayed PNG because the source format cannot be embedded portably."
        })
      } else {
        node.payload.data = `${type};base64,${bytes.toString("base64")}`
        node.payload.assetHash = hash(bytes)
        continue
      }
    }
    let bytes
    try {
      await page.evaluate(object => {
        if (object.payload.scope === "paint") window.__promptslidePptx.paint(object)
        else window.__promptslidePptx.isolate(object)
      }, node)
      // Capture the isolated slide, then trim alpha: element boxes exclude shadows,
      // pseudo-elements and overflowing descendants. Keep their full painted extent.
      const screenshot = await page.screenshot({
        type: "png",
        omitBackground: true,
        scale: "device",
        animations: "disabled"
      })
      const cropped = await page.evaluate(
        async ({ data, pixelScale }) => {
          const image = new Image()
          image.src = data
          await image.decode()
          const canvas = document.createElement("canvas")
          canvas.width = image.width
          canvas.height = image.height
          const context = canvas.getContext("2d", { willReadFrequently: true })
          context.drawImage(image, 0, 0)
          const rgba = context.getImageData(0, 0, image.width, image.height).data
          let left = image.width,
            top = image.height,
            right = -1,
            bottom = -1
          for (let y = 0; y < image.height; y++)
            for (let x = 0; x < image.width; x++)
              if (rgba[(y * image.width + x) * 4 + 3]) {
                left = Math.min(left, x)
                top = Math.min(top, y)
                right = Math.max(right, x)
                bottom = Math.max(bottom, y)
              }
          if (right < left) return null
          const result = document.createElement("canvas")
          result.width = right - left + 1
          result.height = bottom - top + 1
          result
            .getContext("2d")
            .drawImage(
              canvas,
              left,
              top,
              result.width,
              result.height,
              0,
              0,
              result.width,
              result.height
            )
          return {
            data: result.toDataURL("image/png"),
            box: {
              x: left / pixelScale,
              y: top / pixelScale,
              width: result.width / pixelScale,
              height: result.height / pixelScale
            }
          }
        },
        { data: `data:image/png;base64,${screenshot.toString("base64")}`, pixelScale: scale }
      )
      if (!cropped) {
        scene.nodes.splice(scene.nodes.indexOf(node), 1)
        scene.issues = scene.issues.filter(
          issue =>
            issue.code !== node.payload.reason || issue.source?.elementId !== node.source.elementId
        )
        continue
      }
      bytes = Buffer.from(cropped.data.split(",")[1], "base64")
      node.box = cropped.box
      if (node.payload.scope === "subtree") node.opacity = 1
    } finally {
      await page.evaluate(() => window.__promptslidePptx.restorePaint()).catch(() => {})
    }
    pixels.count += Math.ceil(node.box.width * scale) * Math.ceil(node.box.height * scale)
    if (pixels.count > DEFAULT_LIMITS.decodedPixels || bytes.length > DEFAULT_LIMITS.assetBytes)
      throw new Error("LIMIT_EXCEEDED: fallback image budget")
    node.payload.data = `image/png;base64,${bytes.toString("base64")}`
    node.payload.assetHash = hash(bytes)
  }
}

/** Same deterministic pipeline for Studio jobs and CLI. Never requires an LLM. */
export async function exportDeckPptx({
  cwd,
  studioPort,
  baseUrl,
  signal,
  onProgress = () => {},
  onFrame = async () => {},
  browserExecutable = process.env.PROMPTSLIDE_CHROMIUM_PATH,
  ...input
}) {
  const options = validateOptions(input),
    started = performance.now()
  const timeout = AbortSignal.timeout(options.timeout * 1000)
  const controller = new AbortController()
  const cancel = () =>
    controller.abort(
      signal?.reason || timeout.reason || new DOMException("Cancelled", "AbortError")
    )
  signal?.addEventListener("abort", cancel, { once: true })
  timeout.addEventListener("abort", cancel, { once: true })
  if (signal?.aborted) cancel()
  const abort = controller.signal
  let browser, server, page
  const report = {
    schemaVersion: 1,
    engineVersion: "1.0.0",
    status: "failed",
    mode: options.mode,
    profile: options.profile,
    buildMode: options.buildMode,
    sourceRevision: "",
    renderer: {},
    qualification: { visualFidelity: "not-evaluated", microsoftPowerPoint: "not-qualified" },
    slides: [],
    issues: [],
    metrics: {},
    timings: {}
  }
  const frames = [],
    assets = [],
    fontDownloads = [],
    pixels = { count: 0 }
  const closeBrowser = () => {
    void browser?.close().catch(() => {})
  }
  abort.addEventListener("abort", closeBrowser, { once: true })
  try {
    assertNotAborted(abort)
    onProgress({ phase: "preparing", completed: 0, total: 1 })
    const revision = await projectRevision(cwd)
    report.sourceRevision = revision
    const launch = {
      headless: true,
      ...(browserExecutable ? { executablePath: browserExecutable } : {})
    }
    server = baseUrl ? { baseUrl, close: async () => {} } : await getCaptureServer(cwd, studioPort)
    assertNotAborted(abort)
    browser = await launchChromium(chromium, launch, abort)
    assertNotAborted(abort)
    page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: options.rasterScale
    })
    const capturedFonts = new Map()
    const captureFont = async (response, url) => {
      try {
        const bytes = await response.body()
        if (bytes.length > DEFAULT_LIMITS.assetBytes) throw new Error("Font asset too large")
        const identity = hash(bytes)
        if (!capturedFonts.has(identity))
          capturedFonts.set(
            identity,
            (async () => {
              assets.push({ url, bytes: await decodeFont(bytes) })
            })()
          )
        await capturedFonts.get(identity)
      } catch (error) {
        issueReport(report, {
          code: "FONT_ASSET_UNAVAILABLE",
          severity: "warning",
          message: error.message
        })
      }
    }
    await installFontRetries(page, issue => issueReport(report, issue), captureFont)
    report.renderer = {
      browser: browser.version(),
      platform: process.platform,
      fontManifestHash: ""
    }
    page.on("response", response => {
      const type = response.headers()["content-type"] || ""
      if (
        response.ok() &&
        (/font|woff|opentype|truetype/.test(type) ||
          /\.(woff2?|ttf|otf)(?:\?|$)/i.test(response.url()))
      )
        fontDownloads.push(captureFont(response, response.url()))
    })
    const errors = []
    page.on("pageerror", error => errors.push(error.message))
    const response = await page.goto(`${server.baseUrl}/?pptx=true`, {
      waitUntil: "networkidle",
      timeout: 30000
    })
    if (!response?.ok()) throw new Error(`Export view failed: HTTP ${response?.status()}`)
    const ready = await page
      .waitForFunction(
        () => {
          const overlay = document.querySelector("vite-error-overlay")
          if (overlay)
            return {
              error:
                overlay.shadowRoot?.querySelector(".message-body")?.textContent ||
                "Slide compilation failed"
            }
          return window.__promptslidePptx?.available ? { ready: true } : false
        },
        null,
        { timeout: 30000 }
      )
      .catch(error => {
        throw new Error(errors.join("\n") || error.message)
      })
    const readiness = await ready.jsonValue()
    if (readiness.error) throw new Error(readiness.error)
    const { manifest, theme } = await page.evaluate(() => ({
      manifest: window.__promptslidePptx.manifest,
      theme: window.__promptslidePptx.theme
    }))
    if (!manifest.length || manifest.length > DEFAULT_LIMITS.slides)
      throw new Error("LIMIT_EXCEEDED: export supports 1–100 source slides")
    if (new Set(manifest.map(s => s.id)).size !== manifest.length)
      throw new Error("Slide IDs must be unique")
    const total = manifest.reduce(
      (n, s) => n + (options.buildMode === "slides" ? s.steps + 1 : 1),
      0
    )
    if (total > 500) throw new Error("LIMIT_EXCEEDED: build states exceed 500 slides")
    const configured = []
    for (const font of theme.pptx?.fonts || []) {
      const path = await realpath(resolve(cwd, font.path)),
        projectRoot = await realpath(cwd)
      if (!path.startsWith(projectRoot + "/") && !path.startsWith(projectRoot + "\\"))
        throw new Error("Configured font must be inside the project")
      const bytes = await readFile(path)
      configured.push({
        ...font,
        path,
        bytes: await decodeFont(bytes),
        sourceFileHash: hash(bytes)
      })
    }
    const fonts = new FontResolver({
      assets,
      configured,
      policy: options.fontPolicy,
      onIssue: issue => issueReport(report, issue)
    })
    let nodeCount = 0
    for (let i = 0; i < manifest.length; i++) {
      const meta = manifest[i]
      if (!Number.isInteger(meta.steps) || meta.steps < 0 || meta.steps > 100)
        throw new Error("Invalid slide build step count")
      if (meta.legacy)
        issueReport(report, {
          code: "LEGACY_SLIDE_ID",
          severity: "info",
          source: { slideId: meta.id },
          message: "Index-based legacy ID changes when slides are reordered."
        })
      const steps =
        options.buildMode === "slides"
          ? Array.from({ length: meta.steps + 1 }, (_, n) => n)
          : [meta.steps]
      for (const step of steps) {
        assertNotAborted(abort)
        await page.evaluate(
          ({ index, step: frameStep, showAll }) =>
            window.__promptslidePptx.render(index, frameStep, showAll),
          { index: i, step, showAll: options.buildMode !== "slides" }
        )
        if (errors.length) throw new Error(errors.join("\n"))
        const scene = await page.evaluate(() => window.__promptslidePptx.measure())
        await page.evaluate(
          () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
        )
        const settled = await page.evaluate(() => window.__promptslidePptx.measure())
        if (hash(JSON.stringify(scene)) !== hash(JSON.stringify(settled)))
          throw new Error("UNSTABLE_CONTENT: slide changed during measurement")
        if (options.buildMode === "native" && (await page.locator("[data-ps-morph]").count()))
          throw new Error(
            "Native animation does not support Morph; use --builds=final or --builds=slides"
          )
        nodeCount += scene.nodes.reduce(
          (count, node) =>
            count +
            1 +
            (node.payload.fill?.kind === "elliptical"
              ? node.payload.fill.layers
              : node.kind === "table"
                ? node.payload.rows.reduce((sum, row) => sum + row.length, 0)
                : node.kind === "chart"
                  ? node.payload.series.reduce((sum, series) => sum + series.values.length, 0)
                  : 0),
          0
        )
        if (nodeCount > DEFAULT_LIMITS.nodes) throw new Error("LIMIT_EXCEEDED: scene nodes")
        await actualFonts(page, scene)
        await Promise.all(fontDownloads)
        await prepareTextFonts(scene, fonts, page)
        await outlineSvgText(scene, fonts)
        await resolvePictures(page, scene, options.rasterScale, abort, pixels)
        const frame = { ...scene, ...meta, slideId: meta.id, stateId: `${meta.id}:${step}`, step }
        await onFrame(frame, page)
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
        for (const issue of scene.issues) issueReport(report, issue)
        onProgress({ phase: "rendering", completed: frames.length, total, slideId: meta.id })
      }
    }
    await Promise.all(fontDownloads)
    // Unreadable cross-origin stylesheets may declare fonts not yet requested; loaded font responses are authoritative.
    report.timings.renderingMs = Math.round(performance.now() - started)
    const result = await writePresentation(frames, {
      fonts,
      theme,
      buildMode: options.buildMode,
      signal: abort,
      onProgress
    })
    assertNotAborted(abort)
    if ((await projectRevision(cwd)) !== revision)
      throw new Error(
        "SOURCE_CHANGED: source/assets changed during export; retry with a stable saved deck"
      )
    for (const font of configured)
      if (hash(await readFile(font.path)) !== font.sourceFileHash)
        throw new Error("SOURCE_CHANGED: configured font changed during export")
    const all = frames.flatMap(f => f.nodes),
      fallback = all.filter(n => n.kind === "fallback")
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
    report.objectMap = result.objectMap
    report.fonts = result.fonts
    report.renderer.fontManifestHash = hash(JSON.stringify(result.fonts))
    report.timings.totalMs = Math.round(performance.now() - started)
    const allowedApproximations =
      options.profile === "extended" ? new Set(["GRADIENT_INTERPOLATION_APPROXIMATED"]) : new Set()
    const rejected =
      options.mode === "strict" &&
      (fallback.length ||
        report.issues.some(
          i =>
            (i.severity === "warning" && !allowedApproximations.has(i.code)) ||
            i.severity === "error"
        ))
    report.status = rejected
      ? "rejected"
      : report.issues.some(i => i.severity === "warning")
        ? "succeeded-with-issues"
        : "succeeded"
    onProgress({ phase: "completed", completed: total, total })
    return { pptx: rejected ? undefined : result.buffer, report }
  } catch (error) {
    const timedOut = timeout.aborted && abort.reason === timeout.reason
    const failure = timedOut
      ? new Error(
          `EXPORT_TIMEOUT: Export exceeded ${options.timeout} seconds. Try a higher --timeout value (maximum 600 seconds) or reduce slide complexity.`,
          { cause: error }
        )
      : error
    report.status = abort.aborted && !timedOut ? "cancelled" : "failed"
    report.issues.push({
      code: abort.aborted && !timedOut ? "CANCELLED" : String(failure.message).split(":")[0],
      severity: "error",
      message: failure.message
    })
    report.timings.totalMs = Math.round(performance.now() - started)
    failure.report = report
    throw failure
  } finally {
    signal?.removeEventListener("abort", cancel)
    timeout.removeEventListener("abort", cancel)
    abort.removeEventListener("abort", closeBrowser)
    await browser?.close().catch(() => {})
    await server?.close().catch(() => {})
  }
}
