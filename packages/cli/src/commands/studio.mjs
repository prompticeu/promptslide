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
  const transportArg = args.find(a => a.startsWith("--transport="))
  const transport = transportArg ? transportArg.split("=")[1] : "stdio"
  const mcpPortArg = args.find(a => a.startsWith("--mcp-port="))
  const mcpPort = mcpPortArg ? parseInt(mcpPortArg.split("=")[1], 10) : 3001

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
    if (transport === "http") {
      // HTTP transport mode: MCP over HTTP + Vite dev server
      // Used by the desktop app — both servers start together
      const { startMcpHttpServer } = await import("../mcp/server.mjs")
      const { createServer } = await import("vite")
      const { createViteConfig } = await import("../vite/config.mjs")

      const config = createViteConfig({ cwd, mode: "development", forceHtmlMode: true })
      const viteServer = await createServer({
        ...config,
        server: { ...config.server, port, strictPort: false }
      })

      await viteServer.listen()

      // Register the already-running dev server so MCP tools reuse it
      const { registerExternalDevServer } = await import("../mcp/dev-server.mjs")
      registerExternalDevServer(viteServer.config.server.port)

      const mcpHttpServer = await startMcpHttpServer({ deckRoot: cwd, mcpPort })

      console.log()
      console.log(`  ${bold("promptslide")} ${dim("studio")} ${dim("(app mode)")}`)
      console.log()
      console.log(`  ${dim("→")} Dev server:  ${bold(`http://localhost:${viteServer.config.server.port}`)}`)
      console.log(`  ${dim("→")} MCP server:  ${bold(`http://localhost:${mcpPort}/mcp`)}`)
      console.log()

      // Write connection info to stdout as JSON for the Tauri app to parse
      if (args.includes("--json")) {
        const info = {
          devServer: `http://localhost:${viteServer.config.server.port}`,
          mcpServer: `http://localhost:${mcpPort}/mcp`
        }
        // Write to fd 3 if available (Tauri sidecar pipe), otherwise stderr
        try {
          process.stderr.write(`__PROMPTSLIDE_READY__${JSON.stringify(info)}\n`)
        } catch {
          // ignore
        }
      }
    } else {
      // Stdio transport mode (default): for CLI integration
      const { startMcpServer } = await import("../mcp/server.mjs")
      await startMcpServer({ deckRoot: cwd })
    }
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
