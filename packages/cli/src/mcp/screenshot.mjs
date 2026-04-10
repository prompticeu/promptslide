/**
 * Screenshot service for MCP.
 *
 * Uses Playwright to render slides in a headless browser and capture screenshots.
 * Leverages the embed route (/:deckSlug/embed) which loads all slides and exposes
 * window.__promptslide for fast in-page slide navigation.
 *
 * The browser instance is lazy-initialized and reused across requests.
 * Slide swaps happen via JS (no page.goto per screenshot), cutting latency from
 * ~1-3s to ~200-400ms per capture.
 *
 * Waits on data-slide-ready attribute (double-rAF) instead of hardcoded timeouts.
 * Detects Vite error overlays on compile failures for actionable error messages.
 */

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { parseDeckManifest } from "../utils/deck-manifest.mjs"

let browser = null
let browserPromise = null

// Persistent embed pages keyed by "{deckSlug}:{port}:{scale}"
const embedPages = new Map()
// Mutex locks per page key
const pageLocks = new Map()

// Persistent page for HTML capture (still uses export route)
let capturePage = null
let captureLock = Promise.resolve()

function resolveSlidePath(deckRoot, slideId) {
  const candidates = [
    `src/slides/${slideId}.tsx`,
    `src/slides/${slideId}.jsx`,
    `src/slides/slide-${slideId}.tsx`,
    `src/slides/slide-${slideId}.jsx`
  ]
  for (const candidate of candidates) {
    if (existsSync(join(deckRoot, candidate))) return candidate
  }
  return `src/slides/slide-${slideId}.tsx`
}

/**
 * Resolve a slide id to its 0-based index in the deck manifest.
 */
function resolveSlideIndex(deckRoot, slideId) {
  const manifestPath = join(deckRoot, "deck.json")
  if (!existsSync(manifestPath)) return 0
  const manifest = parseDeckManifest(readFileSync(manifestPath, "utf-8"))
  const normalized = slideId.replace(/\.(tsx|jsx)$/, "").replace(/^slide-/, "")
  const index = manifest.slides.findIndex(s => s.id === normalized)
  return index >= 0 ? index : 0
}

/**
 * Get or create the shared browser instance.
 */
async function getBrowser() {
  if (browser) return browser
  if (browserPromise) return browserPromise

  browserPromise = (async () => {
    try {
      const pw = await import("playwright")
      browser = await pw.chromium.launch({ headless: true })
      return browser
    } catch (err) {
      browserPromise = null
      throw new Error(
        `Playwright is required for screenshots. Install it with: bun add playwright && bunx playwright install chromium\n` +
        `Original error: ${err.message}`
      )
    }
  })()

  return browserPromise
}

/**
 * Acquire a mutex lock for a given key. Returns a release function.
 */
function acquireLock(key) {
  const prev = pageLocks.get(key) || Promise.resolve()
  let release
  const next = new Promise(r => { release = r })
  pageLocks.set(key, next)
  return prev.then(() => release)
}

/**
 * Get or create a persistent embed page for a deck.
 * The embed route loads all slides and exposes window.__promptslide for navigation.
 */
async function getEmbedPage({ deckSlug, devServerPort, scale = 1 }) {
  const key = `${deckSlug}:${devServerPort}:${scale}`
  const existing = embedPages.get(key)
  if (existing && !existing.isClosed()) return { page: existing, key }

  const b = await getBrowser()
  const page = await b.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: scale
  })

  // Collect console errors for diagnostics
  const consoleErrors = []
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })
  page.on("pageerror", err => {
    consoleErrors.push(err.message || String(err))
  })

  const embedUrl = `http://localhost:${devServerPort}/${deckSlug}/embed?screenshot=true`
  console.error(`[screenshot] Loading embed: ${embedUrl}`)
  await page.goto(embedUrl, { waitUntil: "networkidle", timeout: 15000 })

  // Wait for initial render or detect Vite compile errors
  const result = await waitForSlideOrError(page)
  if (result.status === "error") {
    console.error(`[screenshot] Embed error: ${result.message}`)
    await page.close()
    throw new Error(`Slide render failed: ${result.message}`)
  }
  if (result.status === "timeout") {
    const diagnostics = await getPageDiagnostics(page, consoleErrors)
    console.error(`[screenshot] Embed timeout. Diagnostics: ${diagnostics}`)
    await page.close()
    throw new Error(`Slide render timed out. ${diagnostics}`)
  }

  console.error(`[screenshot] Embed page ready for ${deckSlug}`)
  embedPages.set(key, page)
  return { page, key }
}

/**
 * Gather diagnostic info from a page for error reporting.
 * Extracts console errors, Vite overlay text, and page state.
 */
async function getPageDiagnostics(page, consoleErrors = []) {
  const parts = []

  try {
    const info = await page.evaluate(() => {
      const result = {}

      // Check for Vite error overlay
      const overlay = document.querySelector("vite-error-overlay")
      if (overlay) {
        const root = overlay.shadowRoot
        result.viteError = root?.querySelector(".message-body")?.textContent
          || root?.querySelector(".message")?.textContent
          || "Unknown Vite error"
      }

      // Check runtime
      result.hasRuntime = !!window.__promptslide

      // Check data-slide-ready
      const readyEl = document.querySelector("[data-slide-ready]")
      result.readyState = readyEl ? readyEl.getAttribute("data-slide-ready") : "not found"

      // Get visible page content (helps identify blank pages vs error states)
      const body = document.body
      result.bodyText = body ? body.innerText.slice(0, 300) : "no body"
      result.bodyChildCount = body ? body.children.length : 0

      // Check if #root exists and has content
      const root = document.getElementById("root")
      result.rootHtml = root ? root.innerHTML.slice(0, 200) : "no #root"

      return result
    })

    if (info.viteError) parts.push(`Vite error: ${info.viteError.trim()}`)
    if (!info.hasRuntime) parts.push("Slide runtime did not initialize")
    if (info.readyState !== "true") parts.push(`data-slide-ready=${info.readyState}`)

    // If root is empty, the JS module failed to load
    if (info.rootHtml === "" || info.rootHtml === "no #root") {
      parts.push("React did not mount — the embed module likely failed to load")
    } else if (info.rootHtml && info.rootHtml.length > 0 && info.rootHtml !== "no #root") {
      parts.push(`#root content: ${info.rootHtml}`)
    }

    if (info.bodyText && info.bodyText.trim()) {
      parts.push(`Page text: ${info.bodyText.trim().slice(0, 150)}`)
    }
  } catch (err) {
    parts.push(`Diagnostics failed: ${err.message}`)
  }

  // Include collected console errors
  if (consoleErrors.length > 0) {
    const relevant = consoleErrors.filter(e =>
      e.includes("Failed to") || e.includes("Error") || e.includes("Cannot") ||
      e.includes("import") || e.includes("resolve") || e.includes("404") ||
      e.includes("Uncaught") || e.includes("TypeError") || e.includes("ReferenceError")
    )
    const errors = relevant.length > 0 ? relevant : consoleErrors
    parts.push(`Console errors: ${errors.slice(0, 5).join(" | ")}`)
  }

  return parts.length > 0 ? parts.join(". ") : "No diagnostic info available — check server logs."
}

/**
 * Wait for either the slide to be ready or a Vite error overlay to appear.
 * Returns { status: "ready" }, { status: "error", message }, or { status: "timeout" }.
 */
async function waitForSlideOrError(page, timeout = 10000) {
  try {
    const result = await page.evaluate((timeout) => {
      return new Promise((resolve) => {
        let settled = false
        let observer = null

        const done = (val) => {
          if (settled) return
          settled = true
          clearTimeout(deadline)
          if (observer) observer.disconnect()
          resolve(val)
        }

        const deadline = setTimeout(() => done({ status: "timeout" }), timeout)

        const check = () => {
          if (document.querySelector("[data-slide-ready='true']")) {
            return done({ status: "ready" })
          }
          const overlay = document.querySelector("vite-error-overlay")
          if (overlay) {
            const root = overlay.shadowRoot
            const msg = root?.querySelector(".message-body")?.textContent
              || root?.querySelector(".message")?.textContent
              || "Unknown Vite error"
            return done({ status: "error", message: msg.trim() })
          }
        }

        // Check immediately before setting up observer
        check()
        if (settled) return

        observer = new MutationObserver(check)
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
      })
    }, timeout)

    return result
  } catch {
    return { status: "timeout" }
  }
}

/**
 * Navigate to a slide index within the embed page and wait for render.
 *
 * Waits for any pending Vite HMR updates to land before capturing.
 * When the agent edits a file and immediately calls get_screenshot,
 * Vite pushes an HMR update via websocket. We reset the ready signal,
 * wait for network to settle (HMR module fetches), then wait for the
 * component to re-render and signal readiness.
 *
 * If a Vite compile error occurs (syntax error, missing import, etc.),
 * detects the error overlay and throws with the error message instead
 * of hanging until timeout.
 */
async function navigateToSlide(page, slideIndex) {
  // Check for existing Vite error overlay (from a previous HMR failure)
  const existingError = await page.evaluate(() => {
    const overlay = document.querySelector("vite-error-overlay")
    if (!overlay) return null
    const root = overlay.shadowRoot
    return root?.querySelector(".message-body")?.textContent
      || root?.querySelector(".message")?.textContent
      || "Unknown Vite error"
  })
  if (existingError) {
    throw new Error(`Slide compile error: ${existingError.trim()}`)
  }

  // Check if __promptslide exists. If not, the page may be mid-reload
  // (deck.json changes trigger full-reload). Wait for reload to finish.
  const hasRuntime = await page.evaluate(() => !!window.__promptslide?.goToSlide)
  if (!hasRuntime) {
    console.error("[screenshot] Runtime missing, waiting for page reload to complete...")
    // Wait for the page to finish loading (full-reload in progress)
    await page.waitForLoadState("load", { timeout: 5000 }).catch(() => {})
    await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {})

    // Now wait for the slide runtime to initialize
    const result = await waitForSlideOrError(page)
    if (result.status === "error") {
      throw new Error(`Slide compile error: ${result.message}`)
    }
    if (result.status === "timeout") {
      const diagnostics = await getPageDiagnostics(page)
      throw new Error(`Slide render timed out after reload. ${diagnostics}`)
    }
  }

  // Check current slide state
  const currentSlide = await page.evaluate(() => {
    return JSON.parse(window.__promptslide.getState()).currentSlide
  })

  if (currentSlide === slideIndex) {
    // Already on the correct slide. Wait for any pending HMR to settle,
    // then check if already ready (don't reset the attribute — goToSlide
    // to the same index is a no-op and won't re-trigger the ready signal)
    await page.waitForLoadState("networkidle").catch(() => {})
    const ready = await page.evaluate(() =>
      document.querySelector("[data-slide-ready]")?.getAttribute("data-slide-ready") === "true"
    )
    if (ready) return
    // Not ready yet (HMR just happened) — wait for it
    const result = await waitForSlideOrError(page)
    if (result.status === "error") throw new Error(`Slide compile error: ${result.message}`)
    if (result.status === "timeout") {
      const diagnostics = await getPageDiagnostics(page)
      throw new Error(`Slide render timed out. ${diagnostics}`)
    }
    return
  }

  // Different slide — navigate and wait for render
  await page.evaluate((idx) => {
    document.querySelector("[data-slide-ready]")?.setAttribute("data-slide-ready", "false")
    window.__promptslide.goToSlide(idx)
  }, slideIndex)

  // Wait for any in-flight HMR module fetches to complete
  await page.waitForLoadState("networkidle").catch(() => {})

  // Race: slide renders successfully vs Vite error overlay appears
  const result = await waitForSlideOrError(page)

  if (result.status === "error") {
    throw new Error(`Slide compile error: ${result.message}`)
  }
  if (result.status === "timeout") {
    const diagnostics = await getPageDiagnostics(page)
    throw new Error(`Slide render timed out. ${diagnostics}`)
  }
}

/**
 * Capture a screenshot of the page. Returns a base64-encoded PNG string.
 */
async function captureScreenshot(page) {
  const buffer = await page.screenshot({ type: "png" })
  return buffer.toString("base64")
}

/**
 * Take a screenshot of a single slide.
 *
 * Uses the embed route with persistent page + JS-based slide navigation.
 * Waits for data-slide-ready (double-rAF) instead of hardcoded timeouts.
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Deck directory path (specific deck)
 * @param {string} options.deckSlug - Deck slug for URL routing
 * @param {string} options.slideId - Slide id (e.g. "hero" or "slide-hero")
 * @param {number} options.devServerPort - Vite dev server port
 * @param {number} [options.scale=1] - Screenshot scale
 * @returns {Promise<string>} Base64-encoded PNG
 */
export async function takeScreenshot({ deckRoot, deckSlug, slideId, devServerPort, scale = 1 }) {
  const slideIndex = resolveSlideIndex(deckRoot, slideId)
  const { page, key } = await getEmbedPage({ deckSlug, devServerPort, scale })

  const release = await acquireLock(key)
  try {
    await navigateToSlide(page, slideIndex)
    return await captureScreenshot(page)
  } catch (err) {
    // Invalidate cached page so next call gets a fresh one after the agent fixes the error
    embedPages.delete(key)
    await page.close().catch(() => {})
    throw err
  } finally {
    release()
  }
}

/**
 * Capture a slide's rendered DOM as self-contained HTML.
 *
 * Still uses the export route (per-slide) since it needs a clean single-slide DOM
 * without the embed shell.
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Deck directory path
 * @param {string} options.deckSlug - Deck slug for URL routing
 * @param {string} options.slideId - Slide id
 * @param {number} options.devServerPort - Vite dev server port
 * @returns {Promise<string>} Self-contained HTML string
 */
export async function captureSlideHtml({ deckRoot, deckSlug, slideId, devServerPort }) {
  const b = await getBrowser()
  const slidePath = resolveSlidePath(deckRoot, slideId)
  const url = `http://localhost:${devServerPort}/${deckSlug}?export=true&slidePath=${slidePath}`

  // Mutex: serialize HTML captures to prevent concurrent navigation on same page
  let resolve
  const prev = captureLock
  captureLock = new Promise(r => { resolve = r })
  await prev

  try {
    if (!capturePage || capturePage.isClosed()) {
      capturePage = await b.newPage({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1
      })
    }
    const page = capturePage

    await page.evaluate(() => {
      const el = document.querySelector("[data-export-ready]")
      if (el) el.setAttribute("data-export-ready", "false")
    }).catch(() => {})

    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 })

    // Race: export view renders vs Vite error overlay
    const exportResult = await page.evaluate((timeout) => {
      return new Promise((resolve) => {
        let settled = false
        let observer = null

        const done = (val) => {
          if (settled) return
          settled = true
          clearTimeout(deadline)
          if (observer) observer.disconnect()
          resolve(val)
        }

        const deadline = setTimeout(() => done({ status: "timeout" }), timeout)

        const check = () => {
          if (document.querySelector("[data-export-ready='true']")) {
            return done({ status: "ready" })
          }
          const overlay = document.querySelector("vite-error-overlay")
          if (overlay) {
            const root = overlay.shadowRoot
            const msg = root?.querySelector(".message-body")?.textContent
              || root?.querySelector(".message")?.textContent
              || "Unknown Vite error"
            return done({ status: "error", message: msg.trim() })
          }
        }

        check()
        if (settled) return

        observer = new MutationObserver(check)
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
      })
    }, 10000)

    if (exportResult.status === "error") {
      throw new Error(`Slide render failed: ${exportResult.message}`)
    }
    if (exportResult.status === "timeout") {
      throw new Error("Slide render timed out — the slide may have compile errors or unresolved dependencies")
    }

    const html = await page.evaluate(async () => {
      // Convert a URL to a base64 data URI so the HTML is self-contained
      async function urlToDataUri(url) {
        try {
          const resp = await fetch(url)
          if (!resp.ok) return url
          const blob = await resp.blob()
          return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = () => resolve(url)
            reader.readAsDataURL(blob)
          })
        } catch {
          return url
        }
      }

      // Inline all url() references in a CSS string (skip data: and # refs)
      async function inlineCssUrls(css) {
        const urlRe = /url\(["']?(?!data:|#)([^"')]+)["']?\)/g
        const matches = [...css.matchAll(urlRe)]
        if (matches.length === 0) return css
        let result = css
        for (const m of matches) {
          const dataUri = await urlToDataUri(m[1])
          if (dataUri !== m[1]) {
            result = result.replace(m[0], `url("${dataUri}")`)
          }
        }
        return result
      }

      const el = document.querySelector("[data-export-ready]")
      if (!el) return null

      // Inline <img> src attributes
      await Promise.all([...el.querySelectorAll("img[src]")].map(async (img) => {
        if (img.src && !img.src.startsWith("data:")) {
          img.src = await urlToDataUri(img.src)
        }
      }))

      // Inline background-image in inline styles
      await Promise.all([...el.querySelectorAll("*")].map(async (e) => {
        const bg = e.style?.backgroundImage
        if (bg && bg.includes("url(") && !bg.includes("data:")) {
          e.style.backgroundImage = await inlineCssUrls(bg)
        }
      }))

      // Collect CSS rules and inline url() references in stylesheets
      const styles = []
      for (const sheet of document.styleSheets) {
        try {
          const rules = []
          for (const rule of sheet.cssRules) {
            const text = rule.cssText
            if (text.includes("url(") && !/url\(["']?data:/.test(text)) {
              rules.push(await inlineCssUrls(text))
            } else {
              rules.push(text)
            }
          }
          styles.push(rules.join("\n"))
        } catch {}
      }

      return `<!DOCTYPE html>
<html lang="en" class="${document.documentElement.className}">
<head><meta charset="UTF-8"><style>${styles.join("\n")}</style>
<style>html,body{margin:0;padding:0;overflow:hidden;width:1280px;height:720px;background:transparent}</style></head>
<body>${el.outerHTML}</body></html>`
    })

    if (!html) throw new Error("Export element not found")
    return html
  } finally {
    resolve()
  }
}

/**
 * Take an overview grid of all slides in the deck.
 * Captures each slide individually and composites them into a grid.
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Deck directory path
 * @param {string} options.deckSlug - Deck slug for URL routing
 * @param {number} options.devServerPort - Vite dev server port
 * @returns {Promise<string>} Base64-encoded PNG
 */
export async function takeDeckOverview({ deckRoot, deckSlug, devServerPort }) {
  const MAX_OVERVIEW_SLIDES = 16

  const manifestPath = join(deckRoot, "deck.json")
  if (!existsSync(manifestPath)) {
    throw new Error("No deck.json found")
  }

  const manifest = parseDeckManifest(readFileSync(manifestPath, "utf-8"))
  const slideCount = manifest.slides.length

  if (slideCount === 0) {
    throw new Error("Deck has no slides")
  }

  if (slideCount > MAX_OVERVIEW_SLIDES) {
    throw new Error(
      `Deck has ${slideCount} slides — too many for an overview grid. ` +
      `Use get_screenshot to capture individual slides instead.`
    )
  }

  // Use the embed page to capture each slide, then composite into a grid
  const { page, key } = await getEmbedPage({ deckSlug, devServerPort, scale: 1 })
  const release = await acquireLock(key)

  try {
    const thumbs = []
    for (let i = 0; i < slideCount; i++) {
      await navigateToSlide(page, i)
      const buffer = await page.screenshot({ type: "png" })
      thumbs.push(buffer)
    }

    // Composite thumbnails into a grid using a temporary page
    const b = await getBrowser()
    const thumbWidth = 320
    const thumbHeight = 180
    const gap = 4
    const cols = Math.min(slideCount, 4)
    const rows = Math.ceil(slideCount / cols)
    const gridWidth = cols * thumbWidth + (cols - 1) * gap
    const gridHeight = rows * thumbHeight + (rows - 1) * gap

    const gridPage = await b.newPage({
      viewport: { width: gridWidth, height: gridHeight }
    })

    try {
      // Build grid HTML with base64 images and slide labels
      const cards = thumbs.map((buf, i) => {
        const b64 = buf.toString("base64")
        const slide = manifest.slides[i]
        const label = slide.title ? `${i + 1}. ${slide.title}` : `${i + 1}. ${slide.id}`
        return `<div class="card">` +
          `<img src="data:image/png;base64,${b64}" />` +
          `<div class="label">${label}</div>` +
          `</div>`
      }).join("")

      const gridHtml = `<!doctype html><html><head><style>
        body { margin:0; background:#0a0a0a; display:flex; flex-wrap:wrap; gap:${gap}px; font-family:system-ui,sans-serif; }
        .card { position:relative; width:${thumbWidth}px; height:${thumbHeight}px; border-radius:4px; overflow:hidden; }
        .card img { width:100%; height:100%; object-fit:cover; display:block; }
        .label { position:absolute; bottom:0; left:0; right:0; padding:4px 8px; font-size:11px; color:#fff; background:rgba(0,0,0,0.7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      </style></head><body>${cards}</body></html>`

      await gridPage.setContent(gridHtml, { waitUntil: "load" })
      await gridPage.waitForTimeout(100)

      const buffer = await gridPage.screenshot({ type: "png", fullPage: true })
      return buffer.toString("base64")
    } finally {
      await gridPage.close()
    }
  } finally {
    release()
  }
}
