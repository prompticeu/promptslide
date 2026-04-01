import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

import { bold, dim } from "../utils/ansi.mjs"
import { ensureTsConfig } from "../utils/tsconfig.mjs"

/** Default directory for MCP-managed decks */
const DEFAULT_DECK_ROOT = join(homedir(), ".promptslide", "decks")

export async function studio(args) {
  const portArg = args.find(a => a.startsWith("--port="))
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : 5173
  const isMcp = args.includes("--mcp")
  const deckRootArg = args.find(a => a.startsWith("--deck-root="))
  const transportArg = args.find(a => a.startsWith("--transport="))
  const transport = transportArg ? transportArg.split("=")[1] : "stdio"
  const mcpPortArg = args.find(a => a.startsWith("--mcp-port="))
  const mcpPort = mcpPortArg ? parseInt(mcpPortArg.split("=")[1], 10) : 29170
  const hasHost = args.includes("--host") || args.some(a => a.startsWith("--host="))
  const hostArg = args.find(a => a.startsWith("--host="))
  const host = hasHost ? (hostArg ? hostArg.split("=")[1] || "0.0.0.0" : "0.0.0.0") : undefined

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

  // Only require tsconfig for non-MCP mode (MCP creates decks dynamically)
  if (!isMcp) {
    ensureTsConfig(cwd)
  }

  if (isMcp) {
    if (transport === "http") {
      // HTTP transport mode: MCP over HTTP + Vite dev server
      // Used by the desktop app — both servers start together
      const { startMcpHttpServer } = await import("../mcp/server.mjs")
      const { createServer } = await import("vite")
      const { createViteConfig } = await import("../vite/config.mjs")

      const config = createViteConfig({ cwd, mode: "development" })
      const viteServer = await createServer({
        ...config,
        server: { ...config.server, port, strictPort: false }
      })

      await viteServer.listen()

      // Get the actual port Vite is listening on (may differ from requested if port was taken)
      const actualPort = viteServer.httpServer.address().port

      // Register the already-running dev server so MCP tools reuse it
      const { registerExternalDevServer } = await import("../mcp/dev-server.mjs")
      registerExternalDevServer(actualPort, cwd)

      const mcpHttpServer = await startMcpHttpServer({ deckRoot: cwd, mcpPort })

      console.log()
      console.log(`  ${bold("promptslide")} ${dim("studio")} ${dim("(app mode)")}`)
      console.log()
      console.log(`  ${dim("→")} Dev server:  ${bold(`http://localhost:${actualPort}`)}`)
      console.log(`  ${dim("→")} MCP server:  ${bold(`http://localhost:${mcpPort}/mcp`)}`)
      console.log()

      // Write connection info for the Tauri app to parse
      if (args.includes("--json")) {
        const info = {
          devServer: `http://localhost:${actualPort}`,
          mcpServer: `http://localhost:${mcpPort}/mcp`
        }
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
    console.log(`  ${bold("promptslide")} ${dim("studio")}`)
    console.log()

    const config = createViteConfig({ cwd, mode: "development" })
    const server = await createServer({
      ...config,
      server: { ...config.server, port, strictPort: false, ...(host && { host, allowedHosts: true }) }
    })

    await server.listen()
    server.printUrls()
    server.bindCLIShortcuts({ print: true })
  }
}
