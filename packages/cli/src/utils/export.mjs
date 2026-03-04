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

    const errors = []
    page.on("pageerror", err => errors.push(err.message))

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
    await page.waitForSelector("[data-export-ready='true']", { timeout: 15000 }).catch(err => {
      if (errors.length) {
        throw new Error(`${err.message}\n  Browser errors:\n    ${errors.join("\n    ")}`)
      }
      throw err
    })
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
