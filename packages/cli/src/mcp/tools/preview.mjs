/**
 * MCP App preview tool: preview_deck
 *
 * Registers an MCP App that renders the live slide deck directly in the
 * host conversation (e.g. Claude). The app embeds the Vite dev server in
 * an iframe, giving full animation/transition support.
 *
 * Uses @modelcontextprotocol/ext-apps helpers for correct MCP Apps protocol.
 */

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server"

import { resolveDeckPath } from "../deck-resolver.mjs"
import { parseDeckManifest } from "../../utils/deck-manifest.mjs"

const RESOURCE_URI = "ui://promptslide/viewer.html"

/**
 * Self-contained viewer HTML.
 *
 * Loaded by the MCP host as an app resource. Uses the ext-apps App class
 * (loaded from esm.sh CDN) to receive the tool result, then embeds the
 * Vite dev server URL in an iframe for a live, interactive preview.
 */
const VIEWER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PromptSlide</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    body {
      background: #0a0a0a;
      color: #e5e5e5;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
    }
    #loading {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    #loading .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.1);
      border-top-color: #6b7280;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loading p { color: #6b7280; font-size: 13px; }
    #viewer {
      flex: 1;
      display: none;
      flex-direction: column;
      min-height: 0;
    }
    #viewer iframe {
      flex: 1;
      width: 100%;
      border: none;
      min-height: 0;
    }
    #bar {
      display: none;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: #111315;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 12px;
      color: #6b7280;
      flex-shrink: 0;
    }
    #bar a {
      color: #9ca3af;
      text-decoration: none;
      font-size: 11px;
    }
    #bar a:hover { color: #e5e5e5; }
    #error {
      display: none;
      flex: 1;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    #error .box {
      max-width: 400px;
      background: #17191d;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 20px 24px;
    }
    #error h2 { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
    #error p { font-size: 13px; color: #9ca3af; line-height: 1.5; }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <p>Starting preview\u2026</p>
  </div>
  <div id="viewer">
    <iframe id="frame"></iframe>
  </div>
  <div id="bar">
    <span id="info"></span>
    <a id="open-link" href="#" target="_blank">Open in browser \u2197</a>
  </div>
  <div id="error">
    <div class="box">
      <h2>Preview unavailable</h2>
      <p id="error-msg"></p>
    </div>
  </div>

  <script type="module">
    import { App } from "https://esm.sh/@modelcontextprotocol/ext-apps@latest"

    const app = new App({ name: "PromptSlide Viewer", version: "1.0.0" })
    app.connect()

    app.ontoolresult = (result) => {
      const textContent = result.content?.find(c => c.type === "text")
      if (!textContent?.text) return showError("No data received from server.")

      let data
      try {
        data = JSON.parse(textContent.text)
      } catch {
        return showError("Invalid response from server.")
      }

      if (data.error) return showError(data.error)
      if (!data.url) return showError("No preview URL received.")

      document.getElementById("loading").style.display = "none"
      document.getElementById("viewer").style.display = "flex"
      document.getElementById("bar").style.display = "flex"
      document.getElementById("frame").src = data.url
      document.getElementById("info").textContent =
        data.name + " \\u00b7 " + data.slides + " slide" + (data.slides !== 1 ? "s" : "")
      document.getElementById("open-link").href = data.url
    }

    function showError(msg) {
      document.getElementById("loading").style.display = "none"
      document.getElementById("error").style.display = "flex"
      document.getElementById("error-msg").textContent = msg
    }
  </script>
</body>
</html>`

export function registerPreviewTools(server, context) {
  const { deckRoot } = context

  // ─── Register the UI resource ───
  registerAppResource(
    server,
    "promptslide-viewer",
    RESOURCE_URI,
    {},
    async () => ({
      contents: [{
        uri: RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: VIEWER_HTML
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
        `Shows the live deck with full animations, transitions, and keyboard navigation. ` +
        `Click inside the preview and use arrow keys or click to navigate slides.`,
      inputSchema: {
        deck: z.string().optional().describe("Deck slug (optional if only one deck exists)")
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
      _meta: {
        ui: {
          resourceUri: RESOURCE_URI,
          csp: {
            connectDomains: ["https://esm.sh"],
            resourceDomains: ["https://esm.sh"],
            frameDomains: ["http://localhost:*"]
          }
        }
      }
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

      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ root: deckRoot })

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              url: `http://localhost:${port}/${deckSlug}`,
              name: manifest.name,
              slides: manifest.slides.length
            })
          }]
        }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Dev server failed: ${err.message}` }) }] }
      }
    }
  )
}
