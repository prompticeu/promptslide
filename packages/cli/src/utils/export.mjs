import { execSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { createServer } from "vite"

import { createViteConfig } from "../vite/config.mjs"
import { projectIdentity, readStudioServer } from "./studio-discovery.mjs"
import { ensureTsConfig } from "./tsconfig.mjs"

/**
 * Check if Playwright is available.
 * @returns {Promise<boolean>}
 */
export async function isPlaywrightAvailable() {
  try {
    await import("playwright")
    return true
  } catch {
    return false
  }
}

/**
 * Ensure the Chromium browser binary is installed.
 * Attempts a launch and auto-installs if the binary is missing.
 * @param {import("playwright").BrowserType} chromium
 */
async function ensureChromium(chromium) {
  try {
    const browser = await chromium.launch({ headless: true })
    await browser.close()
  } catch (err) {
    if (err.message && err.message.includes("Executable doesn't exist")) {
      const pwIndex = fileURLToPath(import.meta.resolve("playwright"))
      const cliPath = join(dirname(pwIndex), "cli.js")
      execSync(`node "${cliPath}" install chromium`, { stdio: "inherit" })
    } else {
      throw err
    }
  }
}

/** Find a Studio process serving this project; other projects must not be reused. */
async function findStudioServer(cwd, preferredPort) {
  const candidates = preferredPort
    ? [`http://127.0.0.1:${preferredPort}`, `http://localhost:${preferredPort}`]
    : [
        readStudioServer(cwd),
        ...Array.from({ length: 11 }, (_, i) => `http://127.0.0.1:${5173 + i}`)
      ]
  const results = await Promise.all(
    candidates.filter(Boolean).map(async baseUrl => {
      try {
        const response = await fetch(`${baseUrl}/__promptslide_info`, {
          signal: AbortSignal.timeout(350)
        })
        if (!response.ok) return null
        const info = await response.json()
        return info.projectId === projectIdentity(cwd) ? baseUrl : null
      } catch {
        return null
      }
    })
  )
  return results.find(Boolean) || null
}

async function getCaptureServer(cwd, preferredPort) {
  const studio = await findStudioServer(cwd, preferredPort)
  if (studio) return { baseUrl: studio, close: async () => {} }

  ensureTsConfig(cwd)
  const config = createViteConfig({ cwd, mode: "development" })
  const server = await createServer({
    ...config,
    server: { port: 0, strictPort: true },
    logLevel: "silent"
  })
  await server.listen()
  const address = server.httpServer.address()
  const port = typeof address === "object" ? address.port : 0
  return { baseUrl: `http://127.0.0.1:${port}`, close: () => server.close() }
}

async function waitForExport(page, errors) {
  try {
    const handle = await page.waitForFunction(
      () => {
        const overlay = document.querySelector("vite-error-overlay")
        if (overlay) {
          const root = overlay.shadowRoot
          return {
            error:
              root?.querySelector(".message-body")?.textContent ||
              root?.textContent ||
              "Vite compilation failed"
          }
        }
        if (document.querySelector("[data-export-ready='true']")) return { ready: true }
        return false
      },
      null,
      { timeout: 15000 }
    )
    const result = await handle.jsonValue()
    if (result.error) throw new Error(`Slide compile error: ${result.error.trim()}`)
  } catch (err) {
    if (errors.length) throw new Error(`${err.message}\nBrowser errors:\n  ${errors.join("\n  ")}`)
    throw err
  }
}

/**
 * Capture a screenshot of a specific slide.
 * @param {{ cwd: string, slidePath: string, width?: number, height?: number }} opts
 * @returns {Promise<Buffer | null>} PNG buffer, or null if Playwright is not installed
 */
export async function captureSlideScreenshot({
  cwd,
  slidePath,
  width = 1280,
  height = 720,
  studioPort
}) {
  let chromium
  try {
    const pw = await import("playwright")
    chromium = pw.chromium
  } catch {
    return null
  }

  await ensureChromium(chromium)

  const server = await getCaptureServer(cwd, studioPort)
  const url = `${server.baseUrl}/?export=true&slidePath=${encodeURIComponent(slidePath)}`

  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width, height } })

    const errors = []
    page.on("pageerror", err => errors.push(err.message))

    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
    if (!response?.ok())
      throw new Error(`Slide export failed: ${response?.status()} ${await response?.text()}`)
    await waitForExport(page, errors)

    const element = await page.$("[data-export-ready='true']")
    const screenshot = await element.screenshot({ type: "png" })

    return screenshot
  } finally {
    if (browser) await browser.close().catch(() => {})
    await server.close()
  }
}

/**
 * Create a reusable capture session that shares a single Vite server and browser
 * instance across multiple screenshot captures.
 *
 * @param {{ cwd: string, width?: number, height?: number }} opts
 * @returns {Promise<{ capture: (slidePath: string) => Promise<string | null>, close: () => Promise<void> } | null>}
 *   null if Playwright is not available
 */
export async function createCaptureSession({ cwd, width = 1280, height = 720, studioPort }) {
  let chromium
  try {
    const pw = await import("playwright")
    chromium = pw.chromium
  } catch {
    return null
  }

  await ensureChromium(chromium)
  const server = await getCaptureServer(cwd, studioPort)
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width, height } })
  let pending = Promise.resolve()

  async function captureOne(slidePath) {
    const url = `${server.baseUrl}/?export=true&slidePath=${encodeURIComponent(slidePath)}`
    const errors = []
    const onPageError = err => errors.push(err.message)
    page.on("pageerror", onPageError)
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
      if (!response?.ok())
        throw new Error(`Slide export failed: ${response?.status()} ${await response?.text()}`)
      await waitForExport(page, errors)

      const element = await page.$("[data-export-ready='true']")
      const screenshot = await element.screenshot({ type: "png" })
      return `data:image/png;base64,${screenshot.toString("base64")}`
    } catch (err) {
      console.error(`  Screenshot error: ${err.message}`)
      return null
    } finally {
      page.off("pageerror", onPageError)
    }
  }

  function capture(slidePath) {
    const result = pending.then(() => captureOne(slidePath))
    pending = result.then(
      () => {},
      () => {}
    )
    return result
  }

  async function close() {
    await pending
    await page.close().catch(() => {})
    await browser.close().catch(() => {})
    await server.close()
  }

  return { capture, close }
}

/**
 * Capture a slide and return as base64 data URI.
 * Returns null if Playwright is not available or capture fails.
 * @param {{ cwd: string, slidePath: string }} opts
 * @returns {Promise<string | null>}
 */
export async function captureSlideAsDataUri({ cwd, slidePath }) {
  try {
    const buffer = await captureSlideScreenshot({ cwd, slidePath })
    if (!buffer) return null
    return `data:image/png;base64,${buffer.toString("base64")}`
  } catch (err) {
    console.error(`  Screenshot error: ${err.message}`)
    return null
  }
}

/** Render the whole deck at its design size through an existing Studio server. */
export async function captureDeckPdfFromServer(baseUrl) {
  const { chromium } = await import("playwright")
  await ensureChromium(chromium)
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    const errors = []
    page.on("pageerror", error => errors.push(error.message))
    const response = await page.goto(`${baseUrl}/?pdf=true`, {
      waitUntil: "domcontentloaded",
      timeout: 15000
    })
    if (!response?.ok()) throw new Error(`Deck PDF export failed: ${response?.status()}`)
    try {
      await page.waitForSelector("[data-pdf-ready='true']", { timeout: 15000 })
    } catch (error) {
      if (errors.length)
        throw new Error(`${error.message}\nBrowser errors:\n  ${errors.join("\n  ")}`)
      throw error
    }
    return await page.pdf({
      width: "1280px",
      height: "720px",
      printBackground: true,
      preferCSSPageSize: true
    })
  } finally {
    await browser.close()
  }
}

export async function captureDeckPdf({ cwd, studioPort }) {
  const server = await getCaptureServer(cwd, studioPort)
  try {
    return await captureDeckPdfFromServer(server.baseUrl)
  } finally {
    await server.close()
  }
}
