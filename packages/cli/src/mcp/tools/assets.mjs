/**
 * MCP Asset tools: upload_asset, delete_asset
 */

import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"

export function registerAssetTools(server, context) {
  const { deckRoot } = context

  // ─── upload_asset ───
  server.tool(
    "upload_asset",
    `Upload an image or file to the deck's assets directory. ` +
    `Returns an asset:// URL that can be used in slide HTML (e.g. <img src="asset://logo.svg" />). ` +
    `The framework resolves asset:// to the correct path at render time.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().describe("Asset filename (e.g. 'logo.svg', 'hero-bg.jpg')"),
      data: z.string().describe("Base64-encoded file content")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, name, data }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const assetsDir = join(deckPath, "assets")
      mkdirSync(assetsDir, { recursive: true })

      const buffer = Buffer.from(data, "base64")
      writeFileSync(join(assetsDir, name), buffer)

      return { content: [{ type: "text", text: JSON.stringify({ url: `asset://${name}`, message: `Asset uploaded. Use src="asset://${name}" in your HTML.` }) }] }
    }
  )

  // ─── delete_asset ───
  server.tool(
    "delete_asset",
    `Remove an asset file from the deck.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().describe("Asset filename to delete")
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ deck, name }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const assetPath = join(deckPath, "assets", name)
      if (!existsSync(assetPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Asset not found: ${name}` }) }] }
      }

      unlinkSync(assetPath)
      return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Asset deleted: ${name}` }) }] }
    }
  )
}
