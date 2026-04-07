/**
 * PDF export service for MCP.
 *
 * Uses Playwright's page.pdf() to generate proper PDFs with selectable text,
 * vector graphics, and correct fonts. Renders the deck's list view which shows
 * all slides sequentially with all animations completed.
 */

import { existsSync, mkdirSync } from "node:fs"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join, basename, dirname } from "node:path"

import { parseDeckManifest } from "../utils/deck-manifest.mjs"

/** Default export directory */
const EXPORTS_DIR = join(homedir(), ".promptslide", "exports")

/**
 * Get or create the shared browser instance (reuses screenshot browser).
 */
async function getBrowser() {
  try {
    const pw = await import("playwright")
    return await pw.chromium.launch({ headless: true })
  } catch (err) {
    throw new Error(
      `Playwright is required for PDF export. Install it with: bun add playwright && bunx playwright install chromium\n` +
        `Original error: ${err.message}`
    )
  }
}

/**
 * Export a deck as PDF.
 *
 * Opens the deck in list view (all slides visible, all animations shown),
 * then uses Playwright's page.pdf() to generate a proper PDF with selectable text.
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Specific deck directory path
 * @param {string} options.deckSlug - Deck slug for URL routing
 * @param {number} options.devServerPort - Vite dev server port
 * @param {string} [options.outputPath] - Override output path (defaults to ~/.promptslide/exports/<slug>.pdf)
 * @returns {Promise<string>} Path to the generated PDF file
 */
export async function exportPdf({ deckRoot, deckSlug, devServerPort, outputPath }) {
  const manifestPath = join(deckRoot, "deck.json")
  if (!existsSync(manifestPath)) {
    throw new Error("No deck.json found")
  }

  const manifest = parseDeckManifest(readFileSync(manifestPath, "utf-8"))
  if (manifest.slides.length === 0) {
    throw new Error("Deck has no slides")
  }
  const effectiveDeckSlug = deckSlug || manifest.slug || basename(deckRoot)

  const browser = await getBrowser()

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 }
    })

    try {
      // Navigate to print view — renders all slides without chrome
      await page.goto(`http://localhost:${devServerPort}/${effectiveDeckSlug}?print=true`, {
        waitUntil: "networkidle",
        timeout: 15000
      })

      // Wait for React to render all slides
      await page.waitForSelector("[data-print-ready='true']", { timeout: 10000 })

      // Generate PDF — each slide is 1280×720 with pageBreakAfter
      const pdfBuffer = await page.pdf({
        width: "1280px",
        height: "720px",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      })

      // Determine output path
      if (!outputPath) {
        if (!existsSync(EXPORTS_DIR)) {
          mkdirSync(EXPORTS_DIR, { recursive: true })
        }
        outputPath = join(EXPORTS_DIR, `${effectiveDeckSlug}.pdf`)
      }

      const outputDir = dirname(outputPath)
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }

      // Write PDF
      const { writeFileSync } = await import("node:fs")
      writeFileSync(outputPath, pdfBuffer)

      return outputPath
    } finally {
      await page.close()
    }
  } finally {
    await browser.close()
  }
}

/**
 * Export a deck as PDF and return the buffer directly.
 * Used by the dev server's HTTP export endpoint.
 *
 * @param {Object} options
 * @param {string} options.deckSlug - Deck slug for URL routing
 * @param {number} options.devServerPort - Vite dev server port
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function exportPdfBuffer({ deckSlug, devServerPort }) {
  const browser = await getBrowser()

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 }
    })

    try {
      // Navigate to print view — renders all slides without chrome
      await page.goto(`http://localhost:${devServerPort}/${deckSlug}?print=true`, {
        waitUntil: "networkidle",
        timeout: 15000
      })

      // Wait for React to render all slides
      await page.waitForSelector("[data-print-ready='true']", { timeout: 10000 })

      const pdfBuffer = await page.pdf({
        width: "1280px",
        height: "720px",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      })

      return pdfBuffer
    } finally {
      await page.close()
    }
  } finally {
    await browser.close()
  }
}
