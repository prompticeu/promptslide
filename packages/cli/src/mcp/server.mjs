/**
 * PromptSlide MCP Server.
 *
 * Lightweight MCP server that manages slide decks on disk.
 * Spawns a Vite dev server as a child process when preview/screenshots are needed.
 *
 * Supports two transport modes:
 * - stdio (default): for CLI integration (e.g. Claude Desktop, Cursor)
 * - http: Streamable HTTP transport for desktop app / network access
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

import { registerCoreTools } from "./tools/core.mjs"
import { registerGuideTools } from "./tools/read.mjs"
import { registerPreviewTools } from "./tools/preview.mjs"

function createMcpServer() {
  return new McpServer({
    name: "Promptslide",
    version: "1.0.0",
    description: `PromptSlide — Create slide deck presentations.
Slides are React/TSX components with Tailwind CSS, built-in animations,
and PDF export.

Before writing slide code, confirm the visual direction with the user:
theme colors, fonts, brand constraints, and overall style. Then plan each
slide around its content. Do not default to generic cards and grids when a
stronger composition fits better.

Use inspect for semantic summaries and runtime state.
Use show_tree for filesystem orientation.
Use read and search for targeted file access.
Use apply for structured file and manifest changes.
Use validate before render when debugging a deck.
Use get_guide("framework") for a comprehensive reference.
Use get_guide("design-recipes") for code snippets and patterns.`
  })
}

function registerTools(server, context) {
  registerCoreTools(server, context)
  registerGuideTools(server, context)
  registerPreviewTools(server, context)
}

/**
 * Start the MCP server with stdio transport.
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Path to the deck directory
 */
export async function startMcpServer({ deckRoot }) {
  const server = createMcpServer()
  registerTools(server, { deckRoot })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

/**
 * Start the MCP server with Streamable HTTP transport.
 *
 * Starts an HTTP server that handles MCP protocol over HTTP.
 * Clients connect via POST/GET to the /mcp endpoint.
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Path to the deck directory
 * @param {number} [options.mcpPort=29170] - Port for the HTTP MCP server
 * @returns {Promise<import("node:http").Server>} The HTTP server instance
 */
export async function startMcpHttpServer({ deckRoot, mcpPort = 29170 }) {
  const { createServer: createHttpServer } = await import("node:http")
  const { randomUUID } = await import("node:crypto")
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  )

  // Track active transports by session ID
  /** @type {Map<string, { transport: StreamableHTTPServerTransport, server: McpServer }>} */
  const sessions = new Map()

  const httpServer = createHttpServer((req, res) => {
    // CORS headers for local app access
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id")
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id")

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url, `http://127.0.0.1:${mcpPort}`)
    if (url.pathname !== "/mcp") {
      res.writeHead(404)
      res.end("Not found")
      return
    }

    handleMcpRequest(req, res).catch(err => {
      console.error("[MCP HTTP] Request error:", err)
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Internal server error" }))
      }
    })
  })

  async function handleMcpRequest(req, res) {
    // Check for existing session
    const sessionId = req.headers["mcp-session-id"]
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)
      await session.transport.handleRequest(req, res)
      return
    }

    // New session (initialization request)
    if (req.method === "POST" && !sessionId) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      })

      // Create a fresh server instance per session
      const server = createMcpServer()
      registerTools(server, { deckRoot })

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId)
        }
      }

      await server.connect(transport)

      // Handle the request first, then store the session
      await transport.handleRequest(req, res)
      if (transport.sessionId) {
        sessions.set(transport.sessionId, { transport, server })
      }
      return
    }

    // Session not found or GET without session
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Bad request — no valid session" }))
  }

  return new Promise((resolve, reject) => {
    httpServer.listen(mcpPort, "127.0.0.1", () => {
      resolve(httpServer)
    })
    httpServer.on("error", reject)
  })
}
