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
 * Waits on data-slide-ready attribute (fonts + rAF) instead of hardcoded timeouts.
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
  return { page, key, consoleErrors }
}

/**
 * Gather diagnostic info from a page for error reporting.
 * Extracts console errors, Vite overlay text, and page state.
 */
async function getPageDiagnostics(page, consoleErrors = []) {
  const parts = []

  // Check for Vite error overlay (might have appeared after our check)
  try {
    const overlayText = await page.evaluate(() => {
      const overlay = document.querySelector("vite-error-overlay")
      if (!overlay) return null
      const root = overlay.shadowRoot
      return root?.querySelector(".message-body")?.textContent
        || root?.querySelector(".message")?.textContent
        || null
    })
    if (overlayText) parts.push(`Vite error: ${overlayText.trim()}`)
  } catch {}

  // Include collected console errors (filter to most relevant)
  const relevantErrors = consoleErrors.filter(e =>
    e.includes("Failed to") || e.includes("Error") || e.includes("Cannot") ||
    e.includes("import") || e.includes("resolve") || e.includes("404")
  )
  if (relevantErrors.length > 0) {
    parts.push(relevantErrors.slice(0, 3).join(" | "))
  } else if (consoleErrors.length > 0) {
    parts.push(consoleErrors.slice(0, 3).join(" | "))
  }

  // Check if __promptslide exists
  try {
    const hasRuntime = await page.evaluate(() => !!window.__promptslide)
    if (!hasRuntime) parts.push("Slide runtime did not initialize")
  } catch {}

  // Check for data-slide-ready attribute state
  try {
    const readyState = await page.evaluate(() => {
      const el = document.querySelector("[data-slide-ready]")
      return el ? el.getAttribute("data-slide-ready") : "attribute not found"
    })
    if (readyState !== "true") parts.push(`data-slide-ready=${readyState}`)
  } catch {}

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

  // Reset ready signal and navigate — guard against __promptslide being
  // undefined (React may have unmounted due to an HMR module error)
  const navError = await page.evaluate((idx) => {
    document.querySelector("[data-slide-ready]")?.setAttribute("data-slide-ready", "false")
    if (!window.__promptslide?.goToSlide) {
      return "Slide runtime not available — the slide may have a compile error that broke the module"
    }
    window.__promptslide.goToSlide(idx)
    return null
  }, slideIndex)
  if (navError) {
    throw new Error(navError)
  }

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
 * Waits for data-slide-ready (fonts + rAF) instead of hardcoded timeouts.
 * Uses CDP Page.captureScreenshot for lower overhead.
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
 * without the embed shell. Uses font-ready signal instead of hardcoded timeout.
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
        const deadline = setTimeout(() => resolve({ status: "timeout" }), timeout)
        const check = () => {
          if (document.querySelector("[data-export-ready='true']")) {
            clearTimeout(deadline)
            return resolve({ status: "ready" })
          }
          const overlay = document.querySelector("vite-error-overlay")
          if (overlay) {
            clearTimeout(deadline)
            const root = overlay.shadowRoot
            const msg = root?.querySelector(".message-body")?.textContent
              || root?.querySelector(".message")?.textContent
              || "Unknown Vite error"
            return resolve({ status: "error", message: msg.trim() })
          }
        }
        check()
        const observer = new MutationObserver(check)
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
        const origResolve = resolve
        resolve = (val) => { observer.disconnect(); origResolve(val) }
      })
    }, 10000)

    if (exportResult.status === "error") {
      throw new Error(`Slide render failed: ${exportResult.message}`)
    }
    if (exportResult.status === "timeout") {
      throw new Error("Slide render timed out — the slide may have compile errors or unresolved dependencies")
    }

    const html = await page.evaluate(() => {
      const styles = []
      for (const sheet of document.styleSheets) {
        try {
          const rules = []
          for (const rule of sheet.cssRules) rules.push(rule.cssText)
          styles.push(rules.join("\n"))
        } catch {}
      }
      const el = document.querySelector("[data-export-ready]")
      if (!el) return null
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
  const manifestPath = join(deckRoot, "deck.json")
  if (!existsSync(manifestPath)) {
    throw new Error("No deck.json found")
  }

  const manifest = parseDeckManifest(readFileSync(manifestPath, "utf-8"))
  const slideCount = manifest.slides.length

  if (slideCount === 0) {
    throw new Error("Deck has no slides")
  }

  const b = await getBrowser()

  if (slideCount <= 8) {
    // Capture each slide individually at smaller scale
    const thumbWidth = 320
    const thumbHeight = 180
    const cols = Math.min(slideCount, 4)
    const rows = Math.ceil(slideCount / cols)
    const gridWidth = cols * thumbWidth
    const gridHeight = rows * thumbHeight

    const page = await b.newPage({
      viewport: { width: gridWidth, height: gridHeight }
    })

    try {
      // Build an HTML page with all slides as iframes in export mode
      const iframes = manifest.slides.map((s) => {
        const slidePath = resolveSlidePath(deckRoot, s.id)
        return `<iframe src="http://localhost:${devServerPort}/${deckSlug}?export=true&slidePath=${slidePath}" ` +
          `style="width:${thumbWidth}px;height:${thumbHeight}px;border:1px solid #333;` +
          `transform-origin:top left;" frameborder="0"></iframe>`
      }).join("")

      const gridHtml = `<!doctype html><html><head><style>
        body { margin:0; background:#0a0a0a; display:flex; flex-wrap:wrap; }
        iframe { display:block; }
      </style></head><body>${iframes}</body></html>`

      await page.setContent(gridHtml, { waitUntil: "networkidle", timeout: 20000 })
      await page.waitForTimeout(2000) // Wait for iframes to load

      const buffer = await page.screenshot({ type: "png", fullPage: true })
      return buffer.toString("base64")
    } finally {
      await page.close()
    }
  } else {
    // For larger decks, use the framework's grid view
    const page = await b.newPage({
      viewport: { width: 1280, height: 720 }
    })

    try {
      await page.goto(`http://localhost:${devServerPort}/${deckSlug}`, { waitUntil: "networkidle", timeout: 15000 })
      await page.waitForTimeout(500)

      // Press 'g' to open grid view (keyboard shortcut in SlideDeck)
      await page.keyboard.press("g")
      await page.waitForTimeout(500)

      const buffer = await page.screenshot({ type: "png", fullPage: true })
      return buffer.toString("base64")
    } finally {
      await page.close()
    }
  }
}
