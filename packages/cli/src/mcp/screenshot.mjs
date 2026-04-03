/**
 * Screenshot service for MCP.
 *
 * Uses Playwright to render slides in a headless browser and capture screenshots.
 * Leverages the framework's built-in export mode (?export=true&slidePath=...) which
 * renders a single slide at exact 1280x720 with all animations shown.
 *
 * The browser instance is lazy-initialized and reused across requests.
 *
 * In the shared host runtime, decks are served via `/:deckSlug`.
 * Export mode is triggered via ?export=true&slidePath=src/slides/slide-name.tsx
 */

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { parseDeckManifest } from "../utils/deck-manifest.mjs"

let browser = null
let browserPromise = null
let reusablePage = null
let reusablePageQueue = Promise.resolve()

function trackPageDiagnostics(page) {
  const messages = []
  const push = (message) => {
    if (!message) return
    messages.push(String(message))
  }

  const onPageError = (err) => {
    push(`Page error: ${err.message}`)
  }

  const onConsole = (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      push(`Console ${msg.type()}: ${msg.text()}`)
    }
  }

  const onRequestFailed = (req) => {
    push(`Request failed: ${req.url()} (${req.failure()?.errorText || "unknown error"})`)
  }

  const onResponse = (res) => {
    if (res.status() >= 400) {
      push(`HTTP ${res.status()}: ${res.url()}`)
    }
  }

  page.on("pageerror", onPageError)
  page.on("console", onConsole)
  page.on("requestfailed", onRequestFailed)
  page.on("response", onResponse)

  return {
    messages,
    dispose() {
      page.off("pageerror", onPageError)
      page.off("console", onConsole)
      page.off("requestfailed", onRequestFailed)
      page.off("response", onResponse)
    }
  }
}

function limitText(text, maxLength = 1200) {
  if (!text) return ""
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}...`
}

function getSetupHint(diagnostics) {
  const joined = diagnostics.join("\n")
  if (joined.includes("/src/globals.css")) {
    return "globals.css failed to load. Read `src/globals.css` and `tsconfig.json`, make sure `@/*` is the only custom path alias, and confirm any `/images/...` asset you reference actually exists."
  }
  if (joined.includes("/images/")) {
    return "A public asset may be missing. Check that `/images/...` references point to files that exist under the deck's public assets setup."
  }
  return null
}

async function waitForExportReady(page, { timeout = 10000, diagnostics = [] } = {}) {
  try {
    await page.waitForSelector("[data-export-ready='true']", { timeout })
  } catch (error) {
    const bodyText = await page.locator("body").innerText().catch(() => "")
    const rootHtml = await page.locator("#root").innerHTML().catch(() => "")
    const details = []

    if (diagnostics.length) {
      details.push(`Browser diagnostics:\n    ${diagnostics.join("\n    ")}`)
    }

    const setupHint = getSetupHint(diagnostics)
    if (setupHint) {
      details.push(`Setup hint:\n    ${setupHint}`)
    }

    if (bodyText.trim()) {
      details.push(`Body text:\n    ${limitText(bodyText)}`)
    } else if (rootHtml.trim()) {
      details.push(`Root HTML:\n    ${limitText(rootHtml)}`)
    }

    throw new Error([
      error.message,
      ...details,
    ].join("\n"))
  }
}

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

async function withReusablePage(task) {
  const run = reusablePageQueue.catch(() => {}).then(async () => {
    const b = await getBrowser()
    if (!reusablePage || reusablePage.isClosed()) {
      reusablePage = await b.newPage({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1
      })
    }

    return task(reusablePage)
  })

  reusablePageQueue = run.catch(() => {})
  return run
}

/**
 * Take a screenshot of a single slide.
 *
 * Uses the framework's export mode which renders at exact 1280x720
 * with all animations visible and no UI chrome.
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Deck directory path (specific deck, e.g. ~/.promptslide/decks/my-pitch)
 * @param {string} options.deckSlug - Deck slug for URL routing
 * @param {string} options.slideId - Slide id (e.g. "hero" or "slide-hero")
 * @param {number} options.devServerPort - Vite dev server port
 * @param {number} [options.scale=1] - Screenshot scale
 * @returns {Promise<string>} Base64-encoded PNG
 */
export async function takeScreenshot({ deckRoot, deckSlug, slideId, devServerPort, scale = 1 }) {
  const slidePath = resolveSlidePath(deckRoot, slideId)
  const url = `http://localhost:${devServerPort}/${deckSlug}?export=true&slidePath=${slidePath}`

  // Reuse a single page for scale=1 screenshots (the common preview case).
  // This avoids the ~500ms overhead of creating/closing pages on every call.
  if (scale === 1) {
    return withReusablePage(async (page) => {
      const { messages, dispose } = trackPageDiagnostics(page)

      try {
        // Clear the ready flag before navigating so we don't screenshot stale content
        await page.evaluate(() => {
          const el = document.querySelector("[data-export-ready]")
          if (el) el.setAttribute("data-export-ready", "false")
        }).catch(() => {})

        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 })
        await waitForExportReady(page, { timeout: 10000, diagnostics: messages })
        await page.waitForTimeout(200)

        const exportEl = await page.$("[data-export-ready]")
        const buffer = exportEl
          ? await exportEl.screenshot({ type: "png" })
          : await page.screenshot({ type: "png" })

        return buffer.toString("base64")
      } finally {
        dispose()
      }
    })
  }

  // Non-default scale: create a fresh page
  const b = await getBrowser()
  const page = await b.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: scale
  })
  const { messages, dispose } = trackPageDiagnostics(page)

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 })
    await waitForExportReady(page, { timeout: 10000, diagnostics: messages })
    await page.waitForTimeout(200)

    const exportEl = await page.$("[data-export-ready]")
    const buffer = exportEl
      ? await exportEl.screenshot({ type: "png" })
      : await page.screenshot({ type: "png" })

    return buffer.toString("base64")
  } finally {
    dispose()
    await page.close()
  }
}

/**
 * Capture a slide's rendered DOM as self-contained HTML.
 *
 * Navigates to the export route, waits for render, then extracts the
 * final DOM with all stylesheets inlined. Scripts are stripped since
 * the output is rendered as static content inside the MCP App widget.
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Deck directory path
 * @param {string} options.deckSlug - Deck slug for URL routing
 * @param {string} options.slideId - Slide id
 * @param {number} options.devServerPort - Vite dev server port
 * @returns {Promise<string>} Self-contained HTML string
 */
export async function captureSlideHtml({ deckRoot, deckSlug, slideId, devServerPort }) {
  const slidePath = resolveSlidePath(deckRoot, slideId)
  const url = `http://localhost:${devServerPort}/${deckSlug}?export=true&slidePath=${slidePath}`

  return withReusablePage(async (page) => {
    const { messages, dispose } = trackPageDiagnostics(page)

    try {
      // Clear ready flag so we wait for the NEW slide, not stale content
      await page.evaluate(() => {
        const el = document.querySelector("[data-export-ready]")
        if (el) el.setAttribute("data-export-ready", "false")
      }).catch(() => {})

      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 })
      await waitForExportReady(page, { timeout: 10000, diagnostics: messages })
      await page.waitForTimeout(200)

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
      dispose()
    }
  })
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
  const cols = slideCount <= 4 ? slideCount : slideCount <= 9 ? 3 : 4
  const thumbWidth = slideCount <= 4 ? 360 : slideCount <= 9 ? 320 : 280
  const thumbHeight = Math.round((thumbWidth / 16) * 9)
  const labelHeight = 30
  const gap = 16
  const rows = Math.ceil(slideCount / cols)
  const gridWidth = cols * thumbWidth + Math.max(0, cols - 1) * gap + 48
  const gridHeight = rows * (thumbHeight + labelHeight) + Math.max(0, rows - 1) * gap + 48

  const page = await b.newPage({
    viewport: { width: gridWidth, height: gridHeight }
  })

  try {
    const cards = manifest.slides.map((slide, index) => {
      const slidePath = resolveSlidePath(deckRoot, slide.id)
      const title = escapeHtml(slide.title || slide.id)
      const section = slide.section ? `<div class="section">${escapeHtml(slide.section)}</div>` : ""
      return `
        <div class="card">
          <iframe
            data-slide-id="${escapeHtml(slide.id)}"
            src="http://localhost:${devServerPort}/${deckSlug}?export=true&slidePath=${slidePath}"
            style="width:${thumbWidth}px;height:${thumbHeight}px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:#000;"
            frameborder="0"
          ></iframe>
          <div class="meta">
            <div class="index">${index + 1}</div>
            <div class="text">
              <div class="title">${title}</div>
              ${section}
            </div>
          </div>
        </div>`
    }).join("")

    const gridHtml = `<!doctype html><html><head><style>
      body { margin:0; padding:24px; background:#0a0a0a; color:#fff; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      .grid { display:grid; grid-template-columns: repeat(${cols}, ${thumbWidth}px); gap:${gap}px; align-items:start; }
      .card { display:flex; flex-direction:column; gap:8px; }
      iframe { display:block; }
      .meta { display:flex; align-items:flex-start; gap:8px; min-height:${labelHeight}px; }
      .index { color:rgba(255,255,255,0.45); font-size:11px; font-weight:600; min-width:20px; }
      .title { font-size:12px; font-weight:600; line-height:1.2; color:rgba(255,255,255,0.92); }
      .section { margin-top:2px; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.45); }
    </style></head><body><div class="grid">${cards}</div></body></html>`

    await page.setContent(gridHtml, { waitUntil: "networkidle", timeout: 20000 })
    await page.waitForFunction((expectedCount) => window.frames.length === expectedCount, slideCount, { timeout: 15000 })

    const frames = page.frames().filter(frame => frame !== page.mainFrame())
    await Promise.all(frames.map(frame => frame.waitForSelector("[data-export-ready='true']", { timeout: 15000 })))
    await page.waitForTimeout(250)

    const buffer = await page.screenshot({ type: "png", fullPage: true })
    return buffer.toString("base64")
  } finally {
    await page.close()
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
