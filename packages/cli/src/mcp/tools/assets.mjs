/**
 * MCP Asset tools: import_asset, list_assets, publish_asset, delete_asset
 */

import { copyFileSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from "node:fs"
import { join, basename, extname, dirname } from "node:path"
import { randomUUID } from "node:crypto"
import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"

/** Pending presigned uploads: upload_id → metadata */
const pendingUploads = new Map()

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

export function registerAssetTools(server, context) {
  const { deckRoot } = context

  // ─── import_asset ───
  server.tool(
    "import_asset",
    `Import a local file into the deck. Copies the file from a local path into the deck's public/ directory. ` +
    `Returns a browser-usable reference (e.g. /images/logo.png) for use in slides. ` +
    `No binary data flows through the conversation — only file paths. ` +
    `For assets that need to render in slides, always use destination "public".`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      source_path: z.string().describe("Absolute path to the local file (e.g. /Users/name/Desktop/logo.png)"),
      target_path: z.string().describe("Target path relative to destination dir (e.g. 'images/logo.png', 'logo.svg')"),
      destination: z.enum(["public", "assets"]).default("public").describe("Target directory: 'public' (browser-accessible, publishable) or 'assets' (local-only)")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, source_path, target_path, destination }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      if (!existsSync(source_path)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Source file not found: ${source_path}` }) }] }
      }

      const destDir = join(deckPath, destination)
      const fullTarget = join(destDir, target_path)

      // Security: prevent path traversal
      if (!fullTarget.startsWith(destDir)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }] }
      }

      // Create target directory
      mkdirSync(dirname(fullTarget), { recursive: true })

      // Copy file
      copyFileSync(source_path, fullTarget)
      const stat = statSync(fullTarget)

      const reference = destination === "public" ? `/${target_path}` : `asset://${target_path}`

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            path: `${destination}/${target_path}`,
            reference,
            mimeType: getMimeType(target_path),
            size: stat.size,
            message: destination === "public"
              ? `Asset imported. Use src="${reference}" in your slides.`
              : `Asset imported to assets/. Use src="asset://${target_path}" (local-only, not publishable).`
          })
        }]
      }
    }
  )

  // ─── import_from_url ───
  server.tool(
    "import_from_url",
    `Download a file from a URL and save it as a deck asset. The MCP server fetches the file — ` +
    `no binary data flows through the conversation. Works for images, fonts, videos, or any file accessible via HTTP(S). ` +
    `Use this when an agent has generated an image via an API and has the resulting URL.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      url: z.string().url().describe("HTTP(S) URL to download (e.g. 'https://example.com/photo.jpg')"),
      target_path: z.string().describe("Target path relative to public/ (e.g. 'images/hero.png', 'fonts/custom.woff2')"),
      destination: z.enum(["public", "assets"]).default("public").describe("Target directory: 'public' (browser-accessible) or 'assets' (local-only)")
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async ({ deck, url, target_path, destination }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const destDir = join(deckPath, destination)
      const fullTarget = join(destDir, target_path)

      if (!fullTarget.startsWith(destDir)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }] }
      }

      // Download the file
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

      const reference = destination === "public" ? `/${target_path}` : `asset://${target_path}`
      const contentType = response.headers.get("content-type") || getMimeType(target_path)

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            path: `${destination}/${target_path}`,
            reference,
            mimeType: contentType,
            size: stat.size,
            message: `Downloaded and saved. Use src="${reference}" in your slides.`
          })
        }]
      }
    }
  )

  // ─── list_assets ───
  server.tool(
    "list_assets",
    `List all assets in the deck. Scans both public/ (browser-accessible, publishable) and assets/ (local-only) directories.`,
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

      const publicFiles = walkDir(join(deckPath, "public")).map(f => ({
        ...f,
        location: "public",
        reference: `/${f.path}`,
        publishable: true
      }))

      const assetFiles = walkDir(join(deckPath, "assets")).map(f => ({
        ...f,
        location: "assets",
        reference: `asset://${f.path}`,
        publishable: false
      }))

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            public: publicFiles,
            assets: assetFiles,
            total: publicFiles.length + assetFiles.length
          }, null, 2)
        }]
      }
    }
  )

  // ─── publish_asset ───
  server.tool(
    "publish_asset",
    `Publish a deck asset to the PromptSlide registry using presigned upload URLs. ` +
    `Accepts either an existing public/ file path, or a local source_path (which is imported first). ` +
    `Binary files (images, fonts) are uploaded directly to blob storage — no base64 in payloads. ` +
    `Requires authentication (promptslide login).`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      path: z.string().optional().describe("Deck-relative path of an existing public/ asset (e.g. 'public/images/logo.png')"),
      source_path: z.string().optional().describe("Local file path to import and publish in one step"),
      target_path: z.string().optional().describe("Target path in public/ when using source_path (e.g. 'images/logo.png')")
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async ({ deck, path: assetPath, source_path, target_path }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      // Resolve the deck slug from the deck path
      const deckSlug = basename(deckPath)

      // Determine the file to publish
      let fullPath, relativePath

      if (source_path) {
        // Import first, then publish
        if (!target_path) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "target_path is required when using source_path" }) }] }
        }
        if (!existsSync(source_path)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Source file not found: ${source_path}` }) }] }
        }

        const destDir = join(deckPath, "public")
        fullPath = join(destDir, target_path)
        if (!fullPath.startsWith(destDir)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }] }
        }

        mkdirSync(dirname(fullPath), { recursive: true })
        copyFileSync(source_path, fullPath)
        relativePath = target_path
      } else if (assetPath) {
        // Publish an existing file
        const normalized = assetPath.replace(/^public\//, "")
        fullPath = join(deckPath, "public", normalized)
        relativePath = normalized

        if (!existsSync(fullPath)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Asset not found: ${assetPath}. Import it first with import_asset.` }) }] }
        }
      } else {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Provide either 'path' (existing public/ asset) or 'source_path' + 'target_path' (import and publish)" }) }] }
      }

      // Load auth
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

      // Import registry functions
      const { publishToRegistry, requestUploadTokens, uploadBinaryToBlob, assetFileToSlug } = await import("../../utils/registry.mjs")

      const assetSlug = assetFileToSlug(deckSlug, relativePath)
      const fileName = basename(fullPath)
      const ext = extname(fullPath).toLowerCase()
      const contentType = getMimeType(fullPath)
      const dirPart = relativePath.includes("/")
        ? "public/" + relativePath.substring(0, relativePath.lastIndexOf("/") + 1)
        : "public/"

      let files

      if (isBinary(fullPath)) {
        // Binary: use presigned upload
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
            // Fall back to inline data URI
            files = [{ path: fileName, target: dirPart, content: `data:${contentType};base64,${buffer.toString("base64")}` }]
          }
        } else {
          files = [{ path: fileName, target: dirPart, content: `data:${contentType};base64,${buffer.toString("base64")}` }]
        }
      } else {
        // Text file: inline content
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
              reference: `/${relativePath}`,
              message: `Asset published as ${assetSlug} (v${result.version})`
            })
          }]
        }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Publish failed: ${err.message}` }) }] }
      }
    }
  )

  // ─── request_asset_upload ───
  server.tool(
    "request_asset_upload",
    `Request a presigned upload URL for direct binary upload to blob storage. ` +
    `Use this when the client/host has binary data (images, videos, fonts) that cannot pass through MCP text arguments. ` +
    `Flow: 1) call this tool to get an upload_url, 2) PUT the binary data to that URL with the provided headers, ` +
    `3) call confirm_asset_upload with the upload_id and the blob_url from the PUT response. ` +
    `Requires authentication (promptslide login).`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      filename: z.string().describe("File name with extension (e.g. 'hero.png', 'logo.svg')"),
      content_type: z.string().describe("MIME type (e.g. 'image/png', 'video/mp4')"),
      size: z.number().describe("File size in bytes")
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ deck, filename, content_type, size }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const deckSlug = basename(deckPath)

      // Load auth
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

      const { requestUploadTokens, assetFileToSlug } = await import("../../utils/registry.mjs")

      // Generate a deterministic slug for this asset
      const assetSlug = assetFileToSlug(deckSlug, filename)

      let tokens
      try {
        tokens = await requestUploadTokens(
          assetSlug,
          [{ path: filename, contentType: content_type, size }],
          auth
        )
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Failed to get upload token: ${err.message}` }) }] }
      }

      if (!tokens || tokens.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Registry did not return upload tokens. Presigned uploads may not be supported by this registry version." }) }] }
      }

      const token = tokens[0]
      const uploadId = randomUUID()

      // Store pending upload for confirm step
      pendingUploads.set(uploadId, {
        deckSlug,
        deckPath,
        assetSlug,
        filename,
        contentType: content_type,
        pathname: token.pathname,
        clientToken: token.clientToken,
        createdAt: Date.now()
      })

      // Clean up stale pending uploads (older than 1 hour)
      const oneHour = 60 * 60 * 1000
      for (const [id, meta] of pendingUploads) {
        if (Date.now() - meta.createdAt > oneHour) pendingUploads.delete(id)
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            upload_id: uploadId,
            upload_url: `https://blob.vercel-storage.com/${token.pathname}`,
            upload_method: "PUT",
            upload_headers: {
              "Authorization": `Bearer ${token.clientToken}`,
              "x-content-type": content_type,
              "x-api-version": "7",
              "x-vercel-blob-access": "private"
            },
            expires_in: "1 hour",
            message: `PUT your binary data to upload_url with the provided headers. ` +
              `The response JSON will contain a "url" field — pass that as blob_url to confirm_asset_upload.`
          })
        }]
      }
    }
  )

  // ─── confirm_asset_upload ───
  server.tool(
    "confirm_asset_upload",
    `Confirm a completed presigned upload and register the asset in the deck. ` +
    `Call this after successfully uploading binary data to the URL from request_asset_upload. ` +
    `Optionally publishes the asset to the registry and/or saves it locally.`,
    {
      upload_id: z.string().describe("Upload ID returned by request_asset_upload"),
      blob_url: z.string().describe("The blob URL returned by the storage service after the PUT upload (the 'url' field from the response)"),
      target_path: z.string().describe("Target path in public/ (e.g. 'images/hero.png')"),
      publish: z.boolean().default(true).describe("Register the asset in the PromptSlide registry"),
      save_locally: z.boolean().default(false).describe("Also download the file to the local deck's public/ directory for preview")
    },
    { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async ({ upload_id, blob_url, target_path, publish, save_locally }) => {
      const pending = pendingUploads.get(upload_id)
      if (!pending) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Upload ID not found or expired. Call request_asset_upload again." }) }] }
      }

      pendingUploads.delete(upload_id)

      const { deckSlug, deckPath, assetSlug, filename, contentType } = pending
      const reference = `/${target_path}`

      const dirPart = target_path.includes("/")
        ? "public/" + target_path.substring(0, target_path.lastIndexOf("/") + 1)
        : "public/"

      // Optionally download to local deck
      if (save_locally) {
        try {
          const destDir = join(deckPath, "public")
          const fullTarget = join(destDir, target_path)
          if (fullTarget.startsWith(destDir)) {
            mkdirSync(dirname(fullTarget), { recursive: true })
            const resp = await fetch(blob_url, { signal: AbortSignal.timeout(60_000) })
            if (resp.ok) {
              writeFileSync(fullTarget, Buffer.from(await resp.arrayBuffer()))
            }
          }
        } catch {
          // Non-fatal — local save is optional
        }
      }

      // Publish to registry
      if (publish) {
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

        const { publishToRegistry } = await import("../../utils/registry.mjs")
        const files = [{ path: basename(target_path), target: dirPart, storageUrl: blob_url, contentType }]

        try {
          const result = await publishToRegistry({ type: "asset", slug: assetSlug, title: filename, files }, auth)
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                slug: assetSlug,
                version: result.version,
                blob_url,
                reference,
                message: `Asset uploaded and published as ${assetSlug} (v${result.version}). Use src="${reference}" in slides.`
              })
            }]
          }
        } catch (err) {
          return { content: [{ type: "text", text: JSON.stringify({ error: `Publish failed: ${err.message}` }) }] }
        }
      }

      // No publish — just confirm the upload
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            blob_url,
            reference,
            message: `Upload confirmed. Asset available at blob storage. Use src="${reference}" in slides.`
          })
        }]
      }
    }
  )

  // ─── delete_asset ───
  server.tool(
    "delete_asset",
    `Remove an asset file from the deck. Accepts a path relative to the deck root (e.g. 'public/images/logo.png' or 'assets/logo.svg').`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      path: z.string().describe("Asset path relative to deck root (e.g. 'public/images/logo.png', 'assets/logo.svg')")
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ deck, path: assetPath }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const fullPath = join(deckPath, assetPath)

      // Security: prevent path traversal
      if (!fullPath.startsWith(deckPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }] }
      }

      if (!existsSync(fullPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Asset not found: ${assetPath}` }) }] }
      }

      unlinkSync(fullPath)
      return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Asset deleted: ${assetPath}` }) }] }
    }
  )
}
