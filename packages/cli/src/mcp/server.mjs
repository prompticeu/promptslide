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

import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join, basename, extname, dirname } from "node:path"
import { resolveDeckPath } from "./deck-resolver.mjs"
import { completeUserUpload } from "./upload-bridge.mjs"

import { registerReadTools } from "./tools/read.mjs"
import { registerWriteTools } from "./tools/write.mjs"
import { registerDeleteTools } from "./tools/delete.mjs"
import { registerAssetTools } from "./tools/assets.mjs"
import { registerThemeTools } from "./tools/themes.mjs"
import { registerAnnotationTools } from "./tools/annotations.mjs"
import { registerUtilityTools } from "./tools/utility.mjs"
import { registerPreviewTools } from "./tools/preview.mjs"

function createMcpServer() {
  return new McpServer({
    name: "Promptslide",
    version: "1.0.0",
    description: `PromptSlide — Create slide deck presentations.
Slides are React/TSX components with Tailwind CSS. The framework provides
Animated, AnimatedGroup, Morph components for animations, layout components
for consistent structure, and SlideDeck for presentation mode.

Use get_deck_info to see current state.
Use get_guide("framework") for a comprehensive reference.
Use get_guide("design-recipes") for code snippets and patterns.`
  })
}

function registerTools(server, context) {
  registerReadTools(server, context)
  registerWriteTools(server, context)
  registerDeleteTools(server, context)
  registerAssetTools(server, context)
  registerThemeTools(server, context)
  registerAnnotationTools(server, context)
  registerUtilityTools(server, context)
  registerPreviewTools(server, context)
}

/**
 * Handle direct asset upload via HTTP POST.
 *
 * Agents can POST binary data directly instead of going through MCP tools:
 *   POST /assets/upload?deck=my-deck&path=images/glow.png
 *   Content-Type: image/png
 *   Body: <raw binary>
 *
 * This is the simplest way for sandboxed agents (ChatGPT, Claude) to get
 * generated binary assets into a deck — just curl the file.
 */
async function handleAssetUpload(req, res, url, deckRoot) {
  const deck = url.searchParams.get("deck") || undefined
  const targetPath = url.searchParams.get("path")

  if (!targetPath) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Missing 'path' query parameter (e.g. ?path=images/hero.png)" }))
    return
  }

  let deckPath
  try {
    deckPath = resolveDeckPath(deckRoot, deck)
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: err.message }))
    return
  }

  const assetsDir = join(deckPath, "src", "assets")
  const fullTarget = join(assetsDir, targetPath)

  // Security: prevent path traversal
  if (!fullTarget.startsWith(assetsDir)) {
    res.writeHead(400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "Path traversal not allowed" }))
    return
  }

  // Collect request body (raw binary)
  const chunks = []
  let totalSize = 0
  const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

  for await (const chunk of req) {
    totalSize += chunk.length
    if (totalSize > MAX_SIZE) {
      res.writeHead(413, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: `File too large (max ${MAX_SIZE / 1024 / 1024} MB)` }))
      return
    }
    chunks.push(chunk)
  }

  const buffer = Buffer.concat(chunks)

  mkdirSync(dirname(fullTarget), { recursive: true })
  writeFileSync(fullTarget, buffer)

  // Generate import info
  const varName = basename(targetPath, extname(targetPath))
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[^a-zA-Z]/, "_$&")
  const importPath = `@/assets/${targetPath}`

  const result = {
    path: `src/assets/${targetPath}`,
    importPath,
    importStatement: `import ${varName} from "${importPath}"`,
    usage: `<img src={${varName}} />`,
    size: buffer.length,
    message: `Asset saved. Add this import to your slide/layout, then use src={${varName}}.`
  }

  console.log(`[MCP HTTP] Asset uploaded: ${targetPath} (${buffer.length} bytes) → ${fullTarget}`)

  // If this upload was triggered by request_user_upload, resolve the waiting tool call
  const uploadId = url.searchParams.get("uploadId")
  if (uploadId) {
    completeUserUpload(uploadId, result)
  }
  res.writeHead(200, { "Content-Type": "application/json" })
  res.end(JSON.stringify(result))
}

/** Generate the HTML for the drag-and-drop upload page */
function getUploadPageHtml({ uploadEndpoint, targetPath, uploadId, deck, message }) {
  const qs = new URLSearchParams()
  if (targetPath) qs.set("path", targetPath)
  if (uploadId) qs.set("uploadId", uploadId)
  if (deck) qs.set("deck", deck)
  const actionUrl = `${uploadEndpoint}?${qs.toString()}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Upload Asset — PromptSlide</title>
<style>
  * { margin: 0; box-sizing: border-box; }
  body { min-height: 100vh; display: grid; place-items: center; background: #111315; color: #f5f5f5; font-family: ui-sans-serif, system-ui, sans-serif; padding: 24px; }
  .card { width: min(480px, 100%); background: #17191d; border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 32px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #8a8f98; font-size: 13px; margin-bottom: 24px; }
  .target { color: #60a5fa; font-family: ui-monospace, monospace; }
  .drop { border: 2px dashed rgba(255,255,255,0.15); border-radius: 12px; padding: 48px 24px; text-align: center; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .drop:hover, .drop.over { border-color: #60a5fa; background: rgba(96,165,250,0.05); }
  .drop input { display: none; }
  .drop p { color: #b5bcc7; font-size: 14px; }
  .drop .icon { font-size: 32px; margin-bottom: 12px; }
  .status { margin-top: 16px; font-size: 14px; min-height: 20px; }
  .status.ok { color: #4ade80; }
  .status.err { color: #f87171; }
  .status.uploading { color: #facc15; }
</style>
</head>
<body>
<div class="card">
  <h1>Upload Asset</h1>
  ${message ? `<p class="sub" style="color: #e2e8f0; font-size: 14px; margin-bottom: 12px;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : ""}
  <p class="sub">${targetPath ? `Target: <span class="target">src/assets/${targetPath}</span>` : "Drop a file to upload it to the deck."}</p>
  <div class="drop" id="drop">
    <input type="file" id="file">
    <div class="icon">&#128206;</div>
    <p>Drop file here or click to browse</p>
  </div>
  <div class="status" id="status"></div>
</div>
<script>
  const drop = document.getElementById("drop")
  const fileInput = document.getElementById("file")
  const status = document.getElementById("status")
  const actionUrl = ${JSON.stringify(actionUrl)}
  const hasTargetPath = ${JSON.stringify(!!targetPath)}

  drop.addEventListener("click", () => fileInput.click())
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over") })
  drop.addEventListener("dragleave", () => drop.classList.remove("over"))
  drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); upload(e.dataTransfer.files[0]) })
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) upload(fileInput.files[0]) })

  async function upload(file) {
    if (!file) return
    status.className = "status uploading"
    status.textContent = "Uploading " + file.name + "..."

    // If no target path was specified, use the filename
    let url = actionUrl
    if (!hasTargetPath) {
      const sep = url.includes("?") ? "&" : "?"
      url += sep + "path=" + encodeURIComponent(file.name)
    }

    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText) }
      const data = await res.json()
      status.className = "status ok"
      status.textContent = "Uploaded. Use: " + data.importStatement
    } catch (err) {
      status.className = "status err"
      status.textContent = "Error: " + err.message
    }
  }
</script>
</body>
</html>`
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

  const uploadEndpoint = `http://127.0.0.1:${mcpPort}/assets/upload`

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

    // Serve the upload page for user-initiated uploads
    if (url.pathname === "/assets/upload-page" && req.method === "GET") {
      const targetPath = url.searchParams.get("path") || ""
      const uploadId = url.searchParams.get("uploadId") || ""
      const deck = url.searchParams.get("deck") || ""
      const message = url.searchParams.get("message") || ""
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(getUploadPageHtml({ uploadEndpoint, targetPath, uploadId, deck, message }))
      return
    }

    if (url.pathname === "/assets/upload" && req.method === "POST") {
      handleAssetUpload(req, res, url, deckRoot).catch(err => {
        console.error("[MCP HTTP] Upload error:", err)
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

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
      registerTools(server, { deckRoot, uploadEndpoint })

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
