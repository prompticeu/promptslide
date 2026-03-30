/**
 * MCP Utility tools: open_preview, export_pdf
 */

import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"

export function registerUtilityTools(server, context) {
  const { deckRoot } = context

  // ─── open_preview ───
  server.tool(
    "open_preview",
    `Open the deck in the browser for live preview. ` +
    `Starts the dev server automatically if not already running. ` +
    `Changes to slides appear instantly via hot module replacement.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.number().optional().describe("Slide number to jump to (1-indexed, optional)")
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ deck }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ deckRoot })
        const deckSlug = deckPath.split("/").pop()
        const url = `http://localhost:${port}/${deckSlug}`

        try {
          const { exec } = await import("node:child_process")
          const { platform } = await import("node:os")
          const os = platform()
          const openCmd = os === "darwin" ? "open" : os === "win32" ? "start" : "xdg-open"
          exec(`${openCmd} "${url}"`)
        } catch {
          // Silently fail — the URL is still returned
        }

        return { content: [{ type: "text", text: JSON.stringify({ url, message: `Preview opened at ${url}` }) }] }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to start dev server: ${err.message}` }) }] }
      }
    }
  )

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
        const port = await ensureDevServer({ deckRoot })
        const deckSlug = deckPath.split("/").pop()

        const { exportPdf } = await import("../pdf-export.mjs")
        const pdfPath = await exportPdf({
          deckRoot: deckPath,
          deckSlug,
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
}
