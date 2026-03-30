import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

import { bold, dim } from "../utils/ansi.mjs"
import { ensureTsConfig } from "../utils/tsconfig.mjs"
import { isHtmlDeck } from "../html/vite-plugin.mjs"

/** Default directory for MCP-managed decks */
const DEFAULT_DECK_ROOT = join(homedir(), ".promptslide", "decks")

export async function studio(args) {
  const portArg = args.find(a => a.startsWith("--port="))
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : 5173
  const isMcp = args.includes("--mcp")
  const deckRootArg = args.find(a => a.startsWith("--deck-root="))
  const forceHtml = args.includes("--html")

  // Determine working directory
  let cwd
  if (deckRootArg) {
    cwd = deckRootArg.split("=")[1]
  } else if (isMcp) {
    cwd = DEFAULT_DECK_ROOT
  } else {
    cwd = process.cwd()
  }

  if (!existsSync(cwd)) {
    mkdirSync(cwd, { recursive: true })
  }

  const htmlMode = isMcp || forceHtml || isHtmlDeck(cwd)

  // Only require tsconfig for React/TSX mode
  if (!htmlMode && !isMcp) {
    ensureTsConfig(cwd)
  }

  if (isMcp) {
    // MCP mode: lightweight server on stdio, spawns Vite as child when needed
    const { startMcpServer } = await import("../mcp/server.mjs")
    await startMcpServer({ deckRoot: cwd })
  } else {
    // Normal studio: start Vite dev server directly
    const { createServer } = await import("vite")
    const { createViteConfig } = await import("../vite/config.mjs")

    console.log()
    console.log(`  ${bold("promptslide")} ${dim("studio")} ${htmlMode ? dim("(HTML mode)") : ""}`)
    console.log()

    const config = createViteConfig({ cwd, mode: "development", forceHtmlMode: htmlMode })
    const server = await createServer({
      ...config,
      server: { ...config.server, port, strictPort: false }
    })

    await server.listen()
    server.printUrls()
    server.bindCLIShortcuts({ print: true })
  }
}
