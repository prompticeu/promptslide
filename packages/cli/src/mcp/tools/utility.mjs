/**
 * MCP Utility tools: open_preview
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
}
