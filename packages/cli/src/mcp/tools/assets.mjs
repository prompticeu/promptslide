/**
 * MCP Asset tools: get_upload_endpoint, list_assets, delete_asset
 *
 * Assets are stored in src/assets/ and referenced via Vite imports:
 *   import heroImg from "@/assets/images/hero.png"
 *
 * Upload flow: POST binary data to /assets/upload endpoint.
 * The server handles storage (local filesystem or blob storage).
 */

import { existsSync, unlinkSync, readdirSync, statSync } from "node:fs"
import { join, basename, extname } from "node:path"
import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"

const MIME_MAP = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2",
  ".mp4": "video/mp4", ".webm": "video/webm", ".pdf": "application/pdf",
  ".css": "text/css", ".js": "application/javascript", ".json": "application/json",
  ".txt": "text/plain", ".html": "text/html"
}

function getMimeType(filePath) {
  return MIME_MAP[extname(filePath).toLowerCase()] || "application/octet-stream"
}

/** Recursively list files in a directory, returning relative paths */
function walkDir(dir, prefix = "") {
  if (!existsSync(dir)) return []
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...walkDir(join(dir, entry.name), rel))
    } else {
      const stat = statSync(join(dir, entry.name))
      results.push({ name: entry.name, path: rel, size: stat.size, mimeType: getMimeType(entry.name) })
    }
  }
  return results
}

/** Generate a camelCase variable name from a filename */
function toVarName(filename) {
  return basename(filename, extname(filename))
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[^a-zA-Z]/, "_$&")
}

export function registerAssetTools(server, context) {
  const { deckRoot, uploadEndpoint } = context

  // ─── get_upload_endpoint ───
  server.tool(
    "get_upload_endpoint",
    `Get the HTTP upload endpoint URL for direct binary file uploads. ` +
    `Agents that can execute code (curl, Python requests, etc.) can POST files directly. ` +
    `This is the way to upload images, videos, fonts, or other binary assets into a deck. ` +
    `Returns null if the MCP server is running in stdio mode (use local filesystem instead).`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)")
    },
    { readOnlyHint: true },
    async ({ deck }) => {
      if (!uploadEndpoint) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              endpoint: null,
              message: "HTTP upload not available in stdio mode. Copy files directly to the deck's src/assets/ directory instead."
            })
          }]
        }
      }

      try {
        resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const deckParam = deck ? `&deck=${encodeURIComponent(deck)}` : ""
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            endpoint: uploadEndpoint,
            method: "POST",
            example: `curl -X POST "${uploadEndpoint}?path=images/hero.png${deckParam}" --data-binary @/tmp/hero.png -H "Content-Type: image/png"`,
            message: `POST binary data to this URL with ?path=<target_path> query parameter. The file will be saved to src/assets/<target_path>. Use import x from "@/assets/<target_path>" in your slides.`
          })
        }]
      }
    }
  )

  // ─── list_assets ───
  server.tool(
    "list_assets",
    `List all assets in the deck's src/assets/ directory. Returns file info and the Vite import statement for each asset.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)")
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const files = walkDir(join(deckPath, "src", "assets")).map(f => ({
        ...f,
        importPath: `@/assets/${f.path}`,
        importStatement: `import ${toVarName(f.path)} from "@/assets/${f.path}"`
      }))

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ assets: files, total: files.length }, null, 2)
        }]
      }
    }
  )

  // ─── delete_asset ───
  server.tool(
    "delete_asset",
    `Remove an asset file from the deck's src/assets/ directory.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      path: z.string().describe("Path relative to src/assets/ (e.g. 'images/logo.png') or full deck-relative path (e.g. 'src/assets/images/logo.png')")
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ deck, path: assetPath }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const normalized = assetPath.replace(/^src\/assets\//, "")
      const fullPath = join(deckPath, "src", "assets", normalized)

      if (!fullPath.startsWith(join(deckPath, "src", "assets"))) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }] }
      }

      if (!existsSync(fullPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Asset not found: src/assets/${normalized}` }) }] }
      }

      unlinkSync(fullPath)
      return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Asset deleted: src/assets/${normalized}` }) }] }
    }
  )
}
