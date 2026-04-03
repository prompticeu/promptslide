/**
 * MCP App preview tool: preview_deck
 *
 * Registers an MCP App (Vite-bundled React app) that renders slide deck
 * previews directly in the host conversation (e.g. Claude).
 *
 * The app uses render/read via callServerTool to render slides as HTML or PNGs
 * with navigation, thumbnails, and keyboard support.
 *
 * Uses @modelcontextprotocol/ext-apps helpers for correct wire format.
 */

import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createServer as createHttpServer } from "node:http"
import { z } from "zod"
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server"

import { renderArtifact } from "../services/render.mjs"
import { ensureRuntimeContext } from "../services/runtime.mjs"
import { getDeckSummary, resolveDeckContext, resolveSlideFile } from "../services/workspace.mjs"
import { errorResponse, jsonResponse } from "./responses.mjs"

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
      const runtime = await ensureRuntimeContext({ deckRoot, deck: deckSlug })
      const result = await renderArtifact({
        deckRoot,
        deck: runtime.deckSlug,
        port: runtime.port,
        format: "html",
        slide: slideId,
      })

      if (!result.ok || !result.data?.data) {
        throw new Error(result.diagnostics?.map(diagnostic => diagnostic.message).join("\n") || "Render failed")
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      res.end(result.data.data)
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
  const sourcePath = join(__dirname, "..", "app", "mcp-app.html")
  if (existsSync(sourcePath)) {
    return readFileSync(sourcePath, "utf-8")
  }

  // Built output from: npx vite build --config packages/cli/src/mcp/app/vite.config.ts
  const distPath = join(__dirname, "..", "..", "..", "dist", "mcp-app.html")
  if (existsSync(distPath)) {
    return readFileSync(distPath, "utf-8")
  }
  return `<!DOCTYPE html><html><body><p>MCP App not built. Run: npx vite build --config packages/cli/src/mcp/app/vite.config.ts</p></body></html>`
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
        `Shows rendered slides with navigation, thumbnails, and keyboard support. ` +
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
      try {
        const { deckPath, deckSlug } = resolveDeckContext(deckRoot, deck)
        const summary = getDeckSummary(deckPath)

        let renderApi = null
        let devServerUrl = null

        try {
          const renderPort = await ensureRenderServer(deckRoot)
          renderApi = `http://localhost:${renderPort}`

          const runtime = await ensureRuntimeContext({ deckRoot, deck: deckSlug })
          devServerUrl = `http://localhost:${runtime.port}/${deckSlug}`
        } catch {}

        return jsonResponse({
          name: summary.name,
          slug: deckSlug,
          slides: summary.slides.map(slideInfo => ({
            id: slideInfo.id,
            file: resolveSlideFile(deckPath, slideInfo.id)?.file || null,
            section: slideInfo.section,
            title: slideInfo.title,
            steps: slideInfo.steps,
          })),
          renderApi,
          devServerUrl,
        })
      } catch (error) {
        return errorResponse(error)
      }
    }
  )
}
