/**
 * MCP App preview tool: preview_deck
 *
 * Registers an MCP App (Vite-bundled React app) that renders slide deck
 * previews directly in the host conversation (e.g. Claude).
 *
 * The app uses get_screenshot via callServerTool to render slides as PNGs
 * with full navigation, thumbnails, annotations, and keyboard support.
 *
 * Uses @modelcontextprotocol/ext-apps helpers for correct wire format.
 */

import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createServer as createHttpServer } from "node:http"
import { z } from "zod"
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server"

import { resolveDeckPath } from "../deck-resolver.mjs"
import { parseDeckManifest } from "../../utils/deck-manifest.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESOURCE_URI = "ui://promptslide/viewer.html"

// ─── Render API: tiny HTTP server that serves pre-rendered slide HTML ───
let renderServer = null
let renderServerPort = null

/**
 * Start the render API server. Uses Playwright to capture the final DOM
 * from the Vite dev server and serves it as static HTML (no scripts).
 *
 * GET /render/:deckSlug/:slideId → self-contained HTML
 */
async function ensureRenderServer(deckRoot) {
  if (renderServer) return renderServerPort

  // Find a free port
  renderServerPort = 29180
  const { createConnection } = await import("node:net")
  const isPortInUse = (port) => new Promise(resolve => {
    const conn = createConnection({ port, host: "localhost" })
    conn.on("connect", () => { conn.destroy(); resolve(true) })
    conn.on("error", () => resolve(false))
  })
  while (await isPortInUse(renderServerPort)) renderServerPort++

  renderServer = createHttpServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return }

    const url = new URL(req.url, `http://localhost:${renderServerPort}`)
    const match = url.pathname.match(/^\/render\/([^/]+)\/([^/]+)$/)
    if (!match) { res.writeHead(404); res.end("Not found"); return }

    const [, deckSlug, slideId] = match

    try {
      const deckPath = resolveDeckPath(deckRoot, deckSlug)
      const { ensureDevServer } = await import("../dev-server.mjs")
      const devPort = await ensureDevServer({ root: deckRoot })

      const { captureSlideHtml } = await import("../screenshot.mjs")
      const html = await captureSlideHtml({
        deckRoot: deckPath,
        deckSlug,
        slideId,
        devServerPort: devPort
      })

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(html)
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" })
      res.end(`Render failed: ${err.message}`)
    }
  })

  await new Promise((resolve, reject) => {
    renderServer.listen(renderServerPort, "127.0.0.1", () => resolve())
    renderServer.on("error", reject)
  })

  // Cleanup on exit
  const cleanup = () => { if (renderServer) renderServer.close() }
  process.on("exit", cleanup)
  process.on("SIGTERM", cleanup)

  return renderServerPort
}

/** Resolve path to the built MCP App HTML */
function getAppHtml() {
  // Built output from: npx vite build --config packages/cli/src/mcp/app/vite.config.ts
  const distPath = join(__dirname, "..", "..", "..", "dist", "mcp-app.html")
  if (existsSync(distPath)) {
    return readFileSync(distPath, "utf-8")
  }
  return `<!DOCTYPE html><html><body><p>MCP App not built. Run: npx vite build --config packages/cli/src/mcp/app/vite.config.ts</p></body></html>`
}

/**
 * Resolve slide file path for a given slide id.
 */
function resolveSlideFile(deckPath, slideId) {
  const slidesDir = join(deckPath, "src", "slides")
  const candidates = [
    `${slideId}.tsx`, `${slideId}.jsx`,
    `slide-${slideId}.tsx`, `slide-${slideId}.jsx`
  ]
  for (const candidate of candidates) {
    if (existsSync(join(slidesDir, candidate))) return candidate
  }
  return null
}

/** Detect max step from TSX source: step={N} */
function detectSteps(content) {
  const matches = content.matchAll(/step=\{(\d+)\}/g)
  let max = 0
  for (const m of matches) {
    const n = parseInt(m[1], 10)
    if (n > max) max = n
  }
  return max
}

export function registerPreviewTools(server, context) {
  const { deckRoot } = context

  // ─── Register the UI resource ───
  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{
        uri: RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: getAppHtml(),
      }]
    })
  )

  // ─── preview_deck ───
  registerAppTool(
    server,
    "preview_deck",
    {
      title: "Preview Deck",
      description:
        `Open an interactive slide deck preview directly in the conversation. ` +
        `Shows slide screenshots with navigation, thumbnails, annotations, and keyboard support. ` +
        `Call again after editing slides to refresh the preview with updated content.`,
      inputSchema: {
        deck: z.string().optional().describe("Deck slug (optional if only one deck exists)")
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
      _meta: { ui: {
        resourceUri: RESOURCE_URI,
        csp: {
          connectDomains: ["http://localhost:*"],
          resourceDomains: ["http://localhost:*"]
        }
      } }
    },
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
      const deckSlug = deckPath.split("/").pop()

      // Enrich slides with file info and step counts
      const slides = manifest.slides.map(s => {
        const file = resolveSlideFile(deckPath, s.id)
        let steps = 0
        if (file) {
          try {
            const source = readFileSync(join(deckPath, "src", "slides", file), "utf-8")
            steps = detectSteps(source)
          } catch {}
        }
        return {
          id: s.id,
          file,
          section: s.section,
          title: s.title,
          steps
        }
      })

      // Start render server (Playwright-backed, serves static HTML)
      let renderApi = null
      let devServerUrl = null
      try {
        console.error("[preview] Starting render server...")
        const renderPort = await ensureRenderServer(deckRoot)
        console.error(`[preview] Render server on port ${renderPort}`)
        renderApi = `http://localhost:${renderPort}`

        // Also start dev server for "open in browser"
        const { ensureDevServer } = await import("../dev-server.mjs")
        const devPort = await ensureDevServer({ root: deckRoot })
        devServerUrl = `http://localhost:${devPort}/${deckSlug}`
      } catch (err) {
        console.error(`[preview] Server startup failed: ${err.message}`)
      }

      console.error(`[preview] Returning renderApi=${renderApi}, devServerUrl=${devServerUrl}`)

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            name: manifest.name,
            slug: deckSlug,
            slides,
            renderApi,
            devServerUrl
          })
        }]
      }
    }
  )
}
