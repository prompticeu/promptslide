/**
 * MCP Asset tools: import_asset, import_from_url, list_assets, publish_asset,
 * request_asset_upload, confirm_asset_upload, delete_asset
 *
 * Assets are stored in src/assets/ and referenced via Vite imports:
 *   import heroImg from "@/assets/images/hero.png"
 * This works in all modes (single-deck, multi-deck, production, PDF export)
 * because Vite's module resolver handles path resolution.
 */

import { copyFileSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from "node:fs"
import { join, basename, extname, dirname } from "node:path"
import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"

const BINARY_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".svg", ".woff", ".woff2", ".mp4", ".webm", ".pdf"])

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

function isBinary(filePath) {
  return BINARY_EXTS.has(extname(filePath).toLowerCase())
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
    `Agents that can execute code (curl, Python requests, etc.) can POST files directly ` +
    `instead of using MCP tool arguments. This is the simplest way to upload generated images, ` +
    `videos, or other binary assets. Returns null if the MCP server is running in stdio mode (local only).`,
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
              message: "HTTP upload not available in stdio mode. Use import_asset with a local file path instead."
            })
          }]
        }
      }

      // Validate deck exists
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
            message: `POST binary data to this URL with ?path=<target_path> query parameter. The file will be saved to src/assets/<target_path>.`
          })
        }]
      }
    }
  )

  // ─── import_asset ───
  server.tool(
    "import_asset",
    `Import a local file into the deck's src/assets/ directory. ` +
    `Returns a Vite import statement to use in slides: import img from "@/assets/images/hero.png". ` +
    `No binary data flows through the conversation — only file paths.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      source_path: z.string().describe("Absolute path to the local file (e.g. /Users/name/Desktop/logo.png)"),
      target_path: z.string().describe("Target path relative to src/assets/ (e.g. 'images/logo.png', 'logo.svg')")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, source_path, target_path }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      if (!existsSync(source_path)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Source file not found: ${source_path}` }) }] }
      }

      const assetsDir = join(deckPath, "src", "assets")
      const fullTarget = join(assetsDir, target_path)

      if (!fullTarget.startsWith(assetsDir)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }] }
      }

      mkdirSync(dirname(fullTarget), { recursive: true })
      copyFileSync(source_path, fullTarget)
      const stat = statSync(fullTarget)

      const importPath = `@/assets/${target_path}`
      const varName = toVarName(target_path)

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            path: `src/assets/${target_path}`,
            importPath,
            importStatement: `import ${varName} from "${importPath}"`,
            usage: `<img src={${varName}} />`,
            mimeType: getMimeType(target_path),
            size: stat.size,
            message: `Asset imported. Add this import to your slide/layout, then use src={${varName}}.`
          })
        }]
      }
    }
  )

  // ─── import_from_url ───
  server.tool(
    "import_from_url",
    `Download a file from a URL and save it to the deck's src/assets/ directory. ` +
    `The MCP server fetches the file — no binary data flows through the conversation. ` +
    `Returns a Vite import statement. Use this when an agent has generated an image via an API and has the resulting URL.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      url: z.string().url().describe("HTTP(S) URL to download (e.g. 'https://example.com/photo.jpg')"),
      target_path: z.string().describe("Target path relative to src/assets/ (e.g. 'images/hero.png', 'fonts/custom.woff2')")
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async ({ deck, url, target_path }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const assetsDir = join(deckPath, "src", "assets")
      const fullTarget = join(assetsDir, target_path)

      if (!fullTarget.startsWith(assetsDir)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }] }
      }

      let response
      try {
        response = await fetch(url, {
          headers: { "User-Agent": "PromptSlide-MCP/1.0" },
          redirect: "follow",
          signal: AbortSignal.timeout(60_000)
        })
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Download failed: ${err.message}` }) }] }
      }

      if (!response.ok) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Download failed: HTTP ${response.status} ${response.statusText}` }) }] }
      }

      const buffer = Buffer.from(await response.arrayBuffer())

      mkdirSync(dirname(fullTarget), { recursive: true })
      writeFileSync(fullTarget, buffer)
      const stat = statSync(fullTarget)

      const importPath = `@/assets/${target_path}`
      const varName = toVarName(target_path)

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            path: `src/assets/${target_path}`,
            importPath,
            importStatement: `import ${varName} from "${importPath}"`,
            usage: `<img src={${varName}} />`,
            mimeType: response.headers.get("content-type") || getMimeType(target_path),
            size: stat.size,
            message: `Downloaded and saved. Add this import to your slide/layout, then use src={${varName}}.`
          })
        }]
      }
    }
  )

  // ─── list_assets ───
  server.tool(
    "list_assets",
    `List all assets in the deck's src/assets/ directory.`,
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

  // ─── publish_asset ───
  server.tool(
    "publish_asset",
    `Publish a deck asset to the PromptSlide registry using presigned upload URLs. ` +
    `Accepts a path relative to the deck root (e.g. 'src/assets/images/logo.png'). ` +
    `Binary files are uploaded directly to blob storage — no base64 in payloads. ` +
    `Requires authentication (promptslide login).`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      path: z.string().describe("Deck-relative path of the asset (e.g. 'src/assets/images/logo.png')")
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async ({ deck, path: assetPath }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const deckSlug = basename(deckPath)
      const fullPath = join(deckPath, assetPath)

      if (!fullPath.startsWith(deckPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }] }
      }

      if (!existsSync(fullPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Asset not found: ${assetPath}. Import it first with import_asset.` }) }] }
      }

      // Relative path within src/assets/ for slug generation
      const relativePath = assetPath.replace(/^src\/assets\//, "")

      let auth
      try {
        const { loadAuth } = await import("../../utils/auth.mjs")
        auth = loadAuth()
        if (!auth) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Not authenticated. Run `promptslide login` first." }) }] }
        }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Auth error: ${err.message}` }) }] }
      }

      const { publishToRegistry, requestUploadTokens, uploadBinaryToBlob, assetFileToSlug } = await import("../../utils/registry.mjs")

      const assetSlug = assetFileToSlug(deckSlug, relativePath)
      const fileName = basename(fullPath)
      const contentType = getMimeType(fullPath)
      const dirPart = relativePath.includes("/")
        ? "src/assets/" + relativePath.substring(0, relativePath.lastIndexOf("/") + 1)
        : "src/assets/"

      let files

      if (isBinary(fullPath)) {
        const buffer = readFileSync(fullPath)
        let tokens = []
        try {
          tokens = await requestUploadTokens(
            assetSlug,
            [{ path: fileName, contentType, size: buffer.length }],
            auth
          )
        } catch {
          // Fall back to inline
        }

        if (tokens.length > 0) {
          const token = tokens[0]
          try {
            const blobUrl = await uploadBinaryToBlob(buffer, token.pathname, contentType, token.clientToken)
            files = [{ path: fileName, target: dirPart, storageUrl: blobUrl, contentType }]
          } catch {
            files = [{ path: fileName, target: dirPart, content: `data:${contentType};base64,${buffer.toString("base64")}` }]
          }
        } else {
          files = [{ path: fileName, target: dirPart, content: `data:${contentType};base64,${buffer.toString("base64")}` }]
        }
      } else {
        const content = readFileSync(fullPath, "utf-8")
        files = [{ path: fileName, target: dirPart, content }]
      }

      try {
        const result = await publishToRegistry({ type: "asset", slug: assetSlug, title: fileName, files }, auth)
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              slug: assetSlug,
              version: result.version,
              importPath: `@/assets/${relativePath}`,
              message: `Asset published as ${assetSlug} (v${result.version})`
            })
          }]
        }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Publish failed: ${err.message}` }) }] }
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

      // Normalize: accept both "images/logo.png" and "src/assets/images/logo.png"
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
