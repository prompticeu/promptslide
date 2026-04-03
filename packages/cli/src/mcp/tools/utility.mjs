/**
 * MCP Utility tools: export_pdf
 */

import { exec } from "node:child_process"
import { platform } from "node:os"
import { z } from "zod"

import { withLegacyNotice } from "../services/legacy.mjs"
import { renderArtifact } from "../services/render.mjs"
import { ensureRuntimeContext } from "../services/runtime.mjs"
import { validateWorkspaceTarget } from "../services/validate.mjs"
import { resolveDeckContext } from "../services/workspace.mjs"
import { errorResponse, jsonResponse } from "./responses.mjs"

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
      try {
        const { deckSlug } = resolveDeckContext(deckRoot, deck)
        const validation = await validateWorkspaceTarget({
          deckRoot,
          deck: deckSlug,
          scope: "deck",
          includeRuntime: true,
        })
        const runtime = await ensureRuntimeContext({ deckRoot, deck: deckSlug })
        const result = await renderArtifact({
          deckRoot,
          deck: deckSlug,
          port: runtime.port,
          format: "pdf",
          outputPath: output_path,
          staticDiagnostics: validation.diagnostics,
        })

        if (!result.ok || !result.data?.path) {
          return jsonResponse(result)
        }

        const pdfPath = result.data.path

        // Auto-open the PDF
        try {
          const os = platform()
          const openCmd = os === "darwin" ? "open" : os === "win32" ? "start" : "xdg-open"
          exec(`${openCmd} "${pdfPath}"`)
        } catch {
          // Silently fail
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(withLegacyNotice({
              path: pdfPath,
              message: `PDF exported to ${pdfPath}`,
            }, {
              tool: "export_pdf",
              preferred: "render { format: \"pdf\" }",
              note: "Legacy tool `export_pdf` is still supported during migration. Prefer `render` for new agent workflows.",
            }))
          }]
        }
      } catch (error) {
        return errorResponse(error)
      }
    }
  )
}
