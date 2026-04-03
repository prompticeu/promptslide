import { execSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { createServer } from "vite"

import { ensureTsConfig } from "./tsconfig.mjs"
import { createViteConfig } from "../vite/config.mjs"

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

function trackPageDiagnostics(page) {
  const messages = []
  const push = (message) => {
    if (!message) return
    messages.push(String(message))
  }

  page.on("pageerror", err => {
    push(`Page error: ${err.message}`)
  })

  page.on("console", msg => {
    if (msg.type() === "error" || msg.type() === "warning") {
      push(`Console ${msg.type()}: ${msg.text()}`)
    }
  })

  page.on("requestfailed", req => {
    push(`Request failed: ${req.url()} (${req.failure()?.errorText || "unknown error"})`)
  })

  page.on("response", res => {
    if (res.status() >= 400) {
      push(`HTTP ${res.status()}: ${res.url()}`)
    }
  })

  return messages
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

async function waitForExportReady(page, diagnostics, timeout = 15000) {
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

/**
 * Capture a screenshot of a specific slide.
 * @param {{ cwd: string, slidePath: string, width?: number, height?: number }} opts
 * @returns {Promise<Buffer | null>} PNG buffer, or null if Playwright is not installed
 */
export async function captureSlideScreenshot({ cwd, slidePath, width = 1280, height = 720 }) {
  let chromium
  try {
    const pw = await import("playwright")
    chromium = pw.chromium
  } catch {
    return null
  }

  await ensureChromium(chromium)

  ensureTsConfig(cwd)

  const config = createViteConfig({ cwd, mode: "development" })
  const server = await createServer({
    ...config,
    server: { port: 0, strictPort: false },
    logLevel: "silent"
  })
  await server.listen()

  const address = server.httpServer.address()
  const port = typeof address === "object" ? address.port : 0
  const url = `http://localhost:${port}/?export=true&slidePath=${encodeURIComponent(slidePath)}`

  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width, height } })
    const diagnostics = trackPageDiagnostics(page)

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
    await waitForExportReady(page, diagnostics, 15000)
    await page.waitForTimeout(200)

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
export async function createCaptureSession({ cwd, width = 1280, height = 720 }) {
  let chromium
  try {
    const pw = await import("playwright")
    chromium = pw.chromium
  } catch {
    return null
  }

  await ensureChromium(chromium)
  ensureTsConfig(cwd)

  const config = createViteConfig({ cwd, mode: "development" })
  const server = await createServer({
    ...config,
    server: { port: 0, strictPort: false },
    logLevel: "silent"
  })
  await server.listen()

  const address = server.httpServer.address()
  const port = typeof address === "object" ? address.port : 0

  const browser = await chromium.launch({ headless: true })

  async function capture(slidePath) {
    const url = `http://localhost:${port}/?export=true&slidePath=${encodeURIComponent(slidePath)}`
    const page = await browser.newPage({ viewport: { width, height } })
    try {
      const diagnostics = trackPageDiagnostics(page)

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
      await waitForExportReady(page, diagnostics, 15000)
      await page.waitForTimeout(200)

      const element = await page.$("[data-export-ready='true']")
      const screenshot = await element.screenshot({ type: "png" })
      return `data:image/png;base64,${screenshot.toString("base64")}`
    } catch (err) {
      console.error(`  Screenshot error: ${err.message}`)
      return null
    } finally {
      await page.close().catch(() => {})
    }
  }

  async function close() {
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
