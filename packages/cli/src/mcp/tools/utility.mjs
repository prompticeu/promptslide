/**
 * MCP Utility tools: export_pdf
 */

import { basename } from "node:path"
import { z } from "zod"

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
          deckSlug: basename(deckPath),
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
