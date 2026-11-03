import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { createServer } from "vite"

import { createViteConfig } from "../vite/config.mjs"
import { normalizePdfTextPaint } from "./pdf-paint.mjs"
import { installFontRetries } from "./pptx/font-network.mjs"
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
export async function ensureChromium(chromium, signal) {
  try {
    const browser = await chromium.launch({ headless: true })
    await browser.close()
  } catch (err) {
    if (err.message && err.message.includes("Executable doesn't exist")) {
      const pwIndex = fileURLToPath(import.meta.resolve("playwright"))
      const cliPath = join(dirname(pwIndex), "cli.js")
      await new Promise((resolveInstall, rejectInstall) => {
        const child = spawn(process.execPath, [cliPath, "install", "chromium"], {
          stdio: "inherit",
          signal
        })
        child.once("error", rejectInstall)
        child.once("exit", code =>
          code === 0
            ? resolveInstall()
            : rejectInstall(new Error(`Chromium installation failed (${code})`))
        )
      })
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

export async function getCaptureServer(cwd, preferredPort) {
  const studio = await findStudioServer(cwd, preferredPort)
  if (studio) return { baseUrl: studio, close: async () => {} }

  ensureTsConfig(cwd)
  const config = createViteConfig({ cwd, mode: "development" })
  const cacheRoot = await mkdtemp(join(tmpdir(), "promptslide-capture-cache-"))
  const cacheDir = join(cacheRoot, "node_modules/.vite")
  let server
  try {
    server = await createServer({
      ...config,
      cacheDir,
      // Vite 6 treats port 0 as its default port. Permit its automatic next-port
      // selection so concurrent project exports do not fail on an occupied port.
      server: { port: 0, strictPort: false, host: "127.0.0.1" },
      logLevel: "silent"
    })
    await server.listen()
    const address = server.httpServer.address()
    const port = typeof address === "object" ? address.port : 0
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      close: async () => {
        await server.close()
        await rm(cacheRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
      }
    }
  } catch (error) {
    await server?.close().catch(() => {})
    await rm(cacheRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    throw error
  }
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
export async function captureDeckPdfFromServer(
  baseUrl,
  {
    browserExecutable = process.env.PROMPTSLIDE_CHROMIUM_PATH,
    onIssue = () => {},
    onReady = async () => {}
  } = {}
) {
  const { chromium } = await import("playwright")
  if (!browserExecutable) await ensureChromium(chromium)
  const browser = await chromium.launch({
    headless: true,
    ...(browserExecutable ? { executablePath: browserExecutable } : {})
  })
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2
    })
    await page.emulateMedia({ media: "screen", reducedMotion: "reduce" })
    const issues = []
    await installFontRetries(page, issue => {
      issues.push(issue)
      onIssue(issue)
    })
    const errors = []
    page.on("pageerror", error => errors.push(error.message))
    const response = await page.goto(`${baseUrl}/?pdf=true`, {
      waitUntil: "networkidle",
      timeout: 30000
    })
    if (!response?.ok()) throw new Error(`Deck PDF export failed: ${response?.status()}`)
    try {
      const ready = await page.waitForFunction(
        () => {
          const failed = document.querySelector("[data-pdf-error], [data-slide-error]")
          if (failed)
            return {
              error:
                failed.getAttribute("data-pdf-error") || failed.getAttribute("data-slide-error")
            }
          const overlay = document.querySelector("vite-error-overlay")
          if (overlay)
            return {
              error:
                overlay.shadowRoot?.querySelector(".message-body")?.textContent ||
                "Slide compilation failed"
            }
          return document.querySelector("[data-pdf-ready='true']") ? { ready: true } : false
        },
        null,
        { timeout: 60000 }
      )
      const result = await ready.jsonValue()
      if (result.error) throw new Error(result.error)
    } catch (error) {
      if (errors.length)
        throw new Error(`${error.message}\nBrowser errors:\n  ${errors.join("\n  ")}`)
      throw error
    }
    if (errors.length) throw new Error(`PDF content failed: ${errors.join("\n")}`)
    if (issues.some(issue => issue.code.endsWith("_DOWNLOAD_FAILED")))
      throw new Error(
        "A slide font or stylesheet could not be loaded. Check its source before exporting."
      )
    await onReady(page)
    const printOptions = {
      width: "1280px",
      height: "720px",
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    }
    const slideCount = await page.locator(".pdf-slide").count()
    if (!slideCount) throw new Error("There are no slides to export")
    if (slideCount === 1) {
      await normalizePdfTextPaint(page, 0, onIssue)
      return await page.pdf(printOptions)
    }
    // Chromium's paginated print compositor can drop transformed/clipped SVG
    // content on later pages. Print every slide at the viewport origin, then
    // copy native PDF pages, fonts, vectors and link annotations into one file.
    const { PDFDocument } = await import("pdf-lib")
    const document = await PDFDocument.create()
    document.setTitle("PromptSlide presentation")
    document.setCreator("PromptSlide")
    for (let index = 0; index < slideCount; index++) {
      await page.evaluate(active => {
        document.querySelectorAll(".pdf-slide").forEach((slide, position) => {
          slide.style.setProperty("display", position === active ? "block" : "none", "important")
          slide.style.setProperty("break-after", "auto", "important")
          slide.style.setProperty("page-break-after", "auto", "important")
        })
        window.scrollTo(0, 0)
        return new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))
      }, index)
      await page.evaluate(() => window.__promptslidePdf.prepare())
      await normalizePdfTextPaint(page, index, onIssue)
      const bytes = await page.pdf({ ...printOptions, tagged: false })
      const slide = await PDFDocument.load(bytes)
      if (slide.getPageCount() !== 1) throw new Error("A slide exceeded its PDF page boundary")
      const [copied] = await document.copyPages(slide, [0])
      document.addPage(copied)
    }
    return Buffer.from(await document.save())
  } finally {
    await browser.close()
  }
}

export async function captureDeckPdf({ cwd, studioPort, ...options }) {
  const server = await getCaptureServer(cwd, studioPort)
  try {
    return await captureDeckPdfFromServer(server.baseUrl, options)
  } finally {
    await server.close()
  }
}
