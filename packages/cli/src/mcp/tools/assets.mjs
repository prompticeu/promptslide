/**
 * MCP Asset tools: upload_asset OR (request_asset_upload + confirm_asset_upload),
 *                  list_assets, delete_asset
 *
 * Assets are stored in src/assets/ and referenced via Vite imports:
 *   import heroImg from "@/assets/images/hero.png"
 *
 * Upload tools are registered based on the environment:
 * - Local (stdio or http://): upload_asset — agent passes source_path, server copies directly
 * - Remote (https://): request_asset_upload + confirm_asset_upload — presigned Vercel Blob flow
 */

import { randomUUID } from "node:crypto"
import {
  existsSync,
  readFileSync,
  unlinkSync,
  readdirSync,
  statSync,
  mkdirSync,
  writeFileSync
} from "node:fs"
import { join, basename, extname, dirname } from "node:path"

import { z } from "zod"

import { loadAuth } from "../../utils/auth.mjs"
import { requestUploadTokens } from "../../utils/registry.mjs"
import { resolveDeckPath } from "../deck-resolver.mjs"

const MIME_MAP = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".txt": "text/plain",
  ".html": "text/html"
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
      results.push({
        name: entry.name,
        path: rel,
        size: stat.size,
        mimeType: getMimeType(entry.name)
      })
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

/** Build the success response after saving an asset */
function assetSavedResponse(targetPath, size) {
  const varName = toVarName(targetPath)
  const importPath = `@/assets/${targetPath}`
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          success: true,
          path: `src/assets/${targetPath}`,
          importPath,
          importStatement: `import ${varName} from "${importPath}"`,
          usage: `<img src={${varName}} />`,
          size,
          message: `Asset saved. Add this import to your slide/layout, then use src={${varName}}.`
        })
      }
    ]
  }
}

/** Resolve target path and validate against traversal */
function resolveAssetTarget(deckPath, targetPath) {
  const assetsDir = join(deckPath, "src", "assets")
  const fullTarget = join(assetsDir, targetPath)
  if (!fullTarget.startsWith(assetsDir)) {
    return { error: "Path traversal not allowed" }
  }
  return { assetsDir, fullTarget }
}

export function registerAssetTools(server, context) {
  const { deckRoot, uploadEndpoint } = context
  const isLocalEnv = !uploadEndpoint || uploadEndpoint.startsWith("http://")

  if (isLocalEnv) {
    // ─── upload_asset (local only) ───
    server.tool(
      "upload_asset",
      `Upload a binary asset into the deck. ` +
        `Provide the absolute path to the file on disk — the server copies it directly into src/assets/. ` +
        `Returns the Vite import statement to use in your slides.`,
      {
        deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
        path: z.string().describe("Target path relative to src/assets/ (e.g. 'images/glow.png')"),
        source_path: z.string().describe("Absolute path to the file on disk")
      },
      { readOnlyHint: false },
      async ({ deck, path: targetPath, source_path }) => {
        let deckPath
        try {
          deckPath = resolveDeckPath(deckRoot, deck)
        } catch (err) {
          return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
        }

        const target = resolveAssetTarget(deckPath, targetPath)
        if (target.error) {
          return { content: [{ type: "text", text: JSON.stringify({ error: target.error }) }] }
        }

        if (!existsSync(source_path)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Source file not found: ${source_path}` })
              }
            ]
          }
        }

        const buffer = readFileSync(source_path)
        mkdirSync(dirname(target.fullTarget), { recursive: true })
        writeFileSync(target.fullTarget, buffer)

        return assetSavedResponse(targetPath, buffer.length)
      }
    )
  } else {
    // ─── request_asset_upload (remote only) ───
    const pendingUploads = new Map()

    server.tool(
      "request_asset_upload",
      `Request a presigned upload URL for a binary asset. ` +
        `Returns a Vercel Blob URL to PUT your file to. After uploading, call confirm_asset_upload to save it into the deck. ` +
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

        const target = resolveAssetTarget(deckPath, targetPath)
        if (target.error) {
          return { content: [{ type: "text", text: JSON.stringify({ error: target.error }) }] }
        }

        const auth = loadAuth()
        if (!auth) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error:
                    "Not authenticated. The user must run `promptslide login` first to enable presigned uploads."
                })
              }
            ]
          }
        }

        try {
          const tokens = await requestUploadTokens(
            "mcp-assets",
            [{ path: targetPath, contentType: content_type, size }],
            auth
          )

          if (!tokens.length) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: "Registry does not support presigned uploads."
                  })
                }
              ]
            }
          }

          const { clientToken, pathname } = tokens[0]
          const uploadUrl = `https://blob.vercel-storage.com/${pathname}`

          const uploadId = randomUUID()
          pendingUploads.set(uploadId, { targetPath, deckPath, auth })

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  uploadId,
                  uploadUrl,
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${clientToken}`,
                    "x-content-type": content_type,
                    "x-api-version": "7",
                    "x-vercel-blob-access": "private"
                  },
                  example: `curl -X PUT "${uploadUrl}" -H "Authorization: Bearer ${clientToken}" -H "x-content-type: ${content_type}" -H "x-api-version: 7" -H "x-vercel-blob-access: private" --data-binary @/path/to/file`,
                  next_step: `After uploading, call confirm_asset_upload with uploadId="${uploadId}" to save the file into the deck.`
                })
              }
            ]
          }
        } catch (err) {
          return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
        }
      }
    )

    // ─── confirm_asset_upload (remote only) ───
    server.tool(
      "confirm_asset_upload",
      `Confirm a presigned blob upload and save the file into the deck. ` +
        `Call this after uploading a file via the URL from request_asset_upload. ` +
        `The MCP server will fetch the file from Vercel Blob and save it to src/assets/.`,
      {
        upload_id: z.string().describe("The uploadId returned by request_asset_upload"),
        blob_url: z
          .string()
          .describe("The blob URL returned after your PUT upload (from the response body)")
      },
      { readOnlyHint: false },
      async ({ upload_id, blob_url }) => {
        const pending = pendingUploads.get(upload_id)
        if (!pending) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error:
                    "Upload not found. The uploadId may have expired or is invalid. Call request_asset_upload again."
                })
              }
            ]
          }
        }

        const { targetPath, deckPath, auth } = pending

        try {
          const downloadUrl = `${auth.registry}/api/storage/download?url=${encodeURIComponent(blob_url)}`
          const res = await fetch(downloadUrl, {
            headers: {
              Authorization: `Bearer ${auth.token}`,
              ...(auth.organizationId && { "X-Organization-Id": auth.organizationId })
            }
          })

          if (!res.ok) {
            throw new Error(`Failed to download via registry (${res.status}): ${await res.text()}`)
          }

          const buffer = Buffer.from(await res.arrayBuffer())

          const target = resolveAssetTarget(deckPath, targetPath)
          if (target.error) {
            return { content: [{ type: "text", text: JSON.stringify({ error: target.error }) }] }
          }

          mkdirSync(dirname(target.fullTarget), { recursive: true })
          writeFileSync(target.fullTarget, buffer)
          pendingUploads.delete(upload_id)

          return assetSavedResponse(targetPath, buffer.length)
        } catch (err) {
          return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
        }
      }
    )
  }

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
        content: [
          {
            type: "text",
            text: JSON.stringify({ assets: files, total: files.length }, null, 2)
          }
        ]
      }
    }
  )

  // ─── delete_asset ───
  server.tool(
    "delete_asset",
    `Remove an asset file from the deck's src/assets/ directory.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      path: z
        .string()
        .describe(
          "Path relative to src/assets/ (e.g. 'images/logo.png') or full deck-relative path (e.g. 'src/assets/images/logo.png')"
        )
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
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }]
        }
      }

      if (!existsSync(fullPath)) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Asset not found: src/assets/${normalized}` })
            }
          ]
        }
      }

      unlinkSync(fullPath)
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: `Asset deleted: src/assets/${normalized}`
            })
          }
        ]
      }
    }
  )
}
