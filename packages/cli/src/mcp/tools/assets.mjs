/**
 * MCP Asset tools: get_upload_endpoint, request_asset_upload, confirm_asset_upload,
 *                  list_assets, delete_asset
 *
 * Assets are stored in src/assets/ and referenced via Vite imports:
 *   import heroImg from "@/assets/images/hero.png"
 *
 * Upload flows:
 * 1. Direct HTTP POST to /assets/upload (for agents with network access to MCP server)
 * 2. Presigned Blob upload (for sandboxed agents like ChatGPT):
 *    - request_asset_upload → returns presigned Vercel Blob upload URL
 *    - Agent uploads binary to Blob
 *    - confirm_asset_upload → MCP server fetches from Blob, saves to src/assets/
 */

import { existsSync, unlinkSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs"
import { join, basename, extname, dirname } from "node:path"
import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"
import { loadAuth } from "../../utils/auth.mjs"
import { requestUploadTokens } from "../../utils/registry.mjs"

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

/** Pending blob uploads: uploadId → { blobUrl, targetPath, deckPath, clientToken } */
const pendingUploads = new Map()

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

  // ─── request_asset_upload ───
  // For sandboxed agents that can't reach the HTTP upload endpoint directly.
  // Returns a presigned Vercel Blob URL the agent can upload to.
  server.tool(
    "request_asset_upload",
    `Request a presigned upload URL for a binary asset. Use this when you CANNOT reach the HTTP upload endpoint directly (e.g. sandboxed environments like ChatGPT). ` +
    `Returns a presigned Vercel Blob URL you can PUT your binary file to. After uploading, call confirm_asset_upload to save it into the deck. ` +
    `Requires the user to be logged in (promptslide login).`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      path: z.string().describe("Target path relative to src/assets/ (e.g. 'images/glow.png')"),
      content_type: z.string().describe("MIME type of the file (e.g. 'image/png')"),
      size: z.number().describe("File size in bytes")
    },
    { readOnlyHint: true },
    async ({ deck, path: targetPath, content_type, size }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const auth = loadAuth()
      if (!auth) {
        return {
          content: [{ type: "text", text: JSON.stringify({
            error: "Not authenticated. The user must run `promptslide login` first to enable presigned uploads."
          }) }]
        }
      }

      try {
        const tokens = await requestUploadTokens("mcp-asset-upload", [
          { path: targetPath, contentType: content_type, size }
        ], auth)

        if (!tokens.length) {
          return {
            content: [{ type: "text", text: JSON.stringify({
              error: "Registry does not support presigned uploads. Use get_upload_endpoint for direct HTTP upload instead."
            }) }]
          }
        }

        const { clientToken, pathname } = tokens[0]
        const uploadUrl = `https://blob.vercel-storage.com/${pathname}`

        // Store pending upload for confirm step
        const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        pendingUploads.set(uploadId, { targetPath, deckPath, clientToken })

        return {
          content: [{ type: "text", text: JSON.stringify({
            uploadId,
            uploadUrl,
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${clientToken}`,
              "x-content-type": content_type,
              "x-api-version": "7",
              "x-vercel-blob-access": "private"
            },
            example: `curl -X PUT "${uploadUrl}" -H "Authorization: Bearer ${clientToken}" -H "x-content-type: ${content_type}" -H "x-api-version: 7" -H "x-vercel-blob-access: public" --data-binary @/path/to/file`,
            next_step: `After uploading, call confirm_asset_upload with uploadId="${uploadId}" to save the file into the deck.`
          }) }]
        }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }
    }
  )

  // ─── confirm_asset_upload ───
  // Fetches the uploaded file from Blob and saves it to the deck's src/assets/.
  server.tool(
    "confirm_asset_upload",
    `Confirm a presigned blob upload and save the file into the deck. ` +
    `Call this after uploading a file via the URL from request_asset_upload. ` +
    `The MCP server will fetch the file from Vercel Blob and save it to src/assets/.`,
    {
      upload_id: z.string().describe("The uploadId returned by request_asset_upload"),
      blob_url: z.string().describe("The blob URL returned after your PUT upload (from the response body)")
    },
    { readOnlyHint: false },
    async ({ upload_id, blob_url }) => {
      const pending = pendingUploads.get(upload_id)
      if (!pending) {
        return {
          content: [{ type: "text", text: JSON.stringify({
            error: "Upload not found. The uploadId may have expired or is invalid. Call request_asset_upload again."
          }) }]
        }
      }

      const { targetPath, deckPath, clientToken } = pending

      try {
        // Fetch from Blob (with auth for private blobs)
        const res = await fetch(blob_url, {
          headers: { Authorization: `Bearer ${clientToken}` }
        })

        if (!res.ok) {
          throw new Error(`Failed to fetch from blob (${res.status}): ${await res.text()}`)
        }

        const buffer = Buffer.from(await res.arrayBuffer())

        // Save to src/assets/
        const assetsDir = join(deckPath, "src", "assets")
        const fullTarget = join(assetsDir, targetPath)

        if (!fullTarget.startsWith(assetsDir)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }] }
        }

        mkdirSync(dirname(fullTarget), { recursive: true })
        writeFileSync(fullTarget, buffer)
        pendingUploads.delete(upload_id)

        const varName = toVarName(targetPath)
        const importPath = `@/assets/${targetPath}`

        return {
          content: [{ type: "text", text: JSON.stringify({
            success: true,
            path: `src/assets/${targetPath}`,
            importPath,
            importStatement: `import ${varName} from "${importPath}"`,
            usage: `<img src={${varName}} />`,
            size: buffer.length,
            message: `Asset saved. Add this import to your slide/layout, then use src={${varName}}.`
          }) }]
        }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
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
