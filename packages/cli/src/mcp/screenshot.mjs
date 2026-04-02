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
let screenshotPage = null
let capturePage = null
// Simple mutex to serialize access to each reusable page
let screenshotLock = Promise.resolve()
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
  const b = await getBrowser()
  const slidePath = resolveSlidePath(deckRoot, slideId)
  const url = `http://localhost:${devServerPort}/${deckSlug}?export=true&slidePath=${slidePath}`

  // Non-default scale: create a fresh page (no contention)
  if (scale !== 1) {
    const page = await b.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: scale
    })
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 })
      await page.waitForSelector("[data-export-ready='true']", { timeout: 10000 })
      await page.waitForTimeout(200)
      const exportEl = await page.$("[data-export-ready]")
      const buffer = exportEl
        ? await exportEl.screenshot({ type: "png" })
        : await page.screenshot({ type: "png" })
      return buffer.toString("base64")
    } finally {
      await page.close()
    }
  }

  // Scale=1: reuse page with mutex to prevent concurrent navigation
  let resolve
  const prev = screenshotLock
  screenshotLock = new Promise(r => { resolve = r })

  await prev // wait for previous screenshot to finish

  try {
    if (!screenshotPage || screenshotPage.isClosed()) {
      screenshotPage = await b.newPage({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1
      })
    }
    const page = screenshotPage

    await page.evaluate(() => {
      const el = document.querySelector("[data-export-ready]")
      if (el) el.setAttribute("data-export-ready", "false")
    }).catch(() => {})

    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 })
    await page.waitForSelector("[data-export-ready='true']", { timeout: 10000 })
    await page.waitForTimeout(200)

    const exportEl = await page.$("[data-export-ready]")
    const buffer = exportEl
      ? await exportEl.screenshot({ type: "png" })
      : await page.screenshot({ type: "png" })

    return buffer.toString("base64")
  } finally {
    resolve()
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
  await page.waitForSelector("[data-export-ready='true']", { timeout: 10000 })
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
