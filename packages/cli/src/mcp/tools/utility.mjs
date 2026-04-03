/**
 * MCP Utility tools: export_pdf, validate_deck
 */

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { parseDeckManifest } from "../../utils/deck-manifest.mjs"
import { resolveDeckPath } from "../deck-resolver.mjs"

export function registerUtilityTools(server, context) {
  const { deckRoot } = context

  // ─── export_pdf ───
  server.tool(
    "export_pdf",
    `Export the deck as a PDF file with selectable text, vector graphics, and proper fonts. ` +
    `Saves to ~/.promptslide/exports/<slug>.pdf and auto-opens the file. ` +
    `Uses the list view with all animations completed.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      output_path: z.string().optional().describe("Custom output file path (optional, defaults to ~/.promptslide/exports/<slug>.pdf)")
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    async ({ deck, output_path }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ root: deckRoot })

        const { exportPdf } = await import("../pdf-export.mjs")
        const pdfPath = await exportPdf({
          deckRoot: deckPath,
          deckSlug: deckPath.split("/").pop(),
          devServerPort: port,
          outputPath: output_path
        })

        // Auto-open the PDF
        try {
          const { exec } = await import("node:child_process")
          const { platform } = await import("node:os")
          const os = platform()
          const openCmd = os === "darwin" ? "open" : os === "win32" ? "start" : "xdg-open"
          exec(`${openCmd} "${pdfPath}"`)
        } catch {
          // Silently fail
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              path: pdfPath,
              message: `PDF exported to ${pdfPath}`
            })
          }]
        }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `PDF export failed: ${err.message}` }) }] }
      }
    }
  )

  // ─── validate_deck ───
  server.tool(
    "validate_deck",
    `Validate that all slides in a deck compile and render without errors. ` +
    `Iterates through every slide, attempts to render each via the export view, ` +
    `and reports per-slide status. Use after creating multiple slides or before exporting.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)")
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const manifestPath = join(deckPath, "deck.json")
      if (!existsSync(manifestPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No deck.json found." }) }] }
      }

      const manifest = parseDeckManifest(readFileSync(manifestPath, "utf-8"))
      if (!manifest.slides.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Deck has no slides." }) }] }
      }

      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ root: deckRoot })
        const deckSlug = deckPath.split("/").pop()

        const pw = await import("playwright")
        const browser = await pw.chromium.launch({ headless: true })
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })

        const results = []

        for (const slide of manifest.slides) {
          const slidePath = resolveValidateSlidePath(deckPath, slide.id)
          const url = `http://localhost:${port}/${deckSlug}?export=true&slidePath=${slidePath}`

          try {
            await page.goto(url, { waitUntil: "networkidle", timeout: 10000 })
            await page.waitForSelector("[data-export-ready='true']", { timeout: 5000 })
            results.push({ id: slide.id, status: "ok" })
          } catch {
            // Try to capture error details
            let error = "Render failed or timed out"
            try {
              const viteError = await page.evaluate(() => {
                const overlay = document.querySelector('vite-error-overlay')
                if (overlay && overlay.shadowRoot) {
                  const msg = overlay.shadowRoot.querySelector('.message-body')
                  return msg?.textContent?.trim() || overlay.shadowRoot.textContent?.trim()?.slice(0, 300) || null
                }
                return null
              })
              if (viteError) error = viteError
            } catch { /* ignore */ }
            results.push({ id: slide.id, status: "error", error })
          }
        }

        await page.close()
        await browser.close()

        const errorCount = results.filter(r => r.status === "error").length
        return { content: [{ type: "text", text: JSON.stringify({
          total: results.length,
          ok: results.length - errorCount,
          errors: errorCount,
          results,
          message: errorCount === 0
            ? `All ${results.length} slides render successfully.`
            : `${errorCount} of ${results.length} slide(s) have errors.`
        }, null, 2) }] }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Validation failed: ${err.message}` }) }] }
      }
    }
  )
}

/** Resolve slide file path for validation */
function resolveValidateSlidePath(deckRoot, slideId) {
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
