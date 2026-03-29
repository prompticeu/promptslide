/**
 * MCP Delete tools: delete_deck, delete_slide, delete_layout
 *
 * Destructive operations are isolated in this module for clarity.
 */

import { existsSync, unlinkSync, rmSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"

export function registerDeleteTools(server, context) {
  const { deckRoot } = context

  // ─── delete_deck ───
  server.tool(
    "delete_deck",
    `Delete an entire deck and all its contents (slides, themes, layouts, assets). This is irreversible.`,
    {
      deck: z.string().describe("Deck slug to delete")
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ deck }) => {
      const deckPath = join(deckRoot, deck)

      if (deckPath === deckRoot || !deckPath.startsWith(deckRoot + "/")) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Refusing to delete the deck root directory." }) }] }
      }

      if (!existsSync(deckPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Deck not found: ${deck}` }) }] }
      }

      rmSync(deckPath, { recursive: true, force: true })

      return { content: [{ type: "text", text: JSON.stringify({ success: true, deck, message: "Deck deleted." }) }] }
    }
  )

  // ─── delete_slide ───
  server.tool(
    "delete_slide",
    `Remove a slide from the deck. Deletes the .html file and removes it from the deck manifest.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide filename (e.g. 'hero.html' or 'hero')")
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ deck, slide }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const filename = slide.endsWith(".html") ? slide : `${slide}.html`
      const slidePath = join(deckPath, "slides", filename)

      if (existsSync(slidePath)) {
        unlinkSync(slidePath)
      }

      // Update deck.json
      const manifestPath = join(deckPath, "deck.json")
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
        manifest.slides = manifest.slides.filter(s => s.file !== filename)
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      }

      return { content: [{ type: "text", text: JSON.stringify({ success: true, file: filename, message: "Slide deleted." }) }] }
    }
  )

  // ─── delete_layout ───
  server.tool(
    "delete_layout",
    `Delete a slide master layout from the deck.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      layout: z.string().describe("Layout name to delete (e.g. 'master')")
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ deck, layout }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const filename = layout.endsWith(".html") ? layout : `${layout}.html`
      const layoutPath = join(deckPath, "layouts", filename)

      if (!existsSync(layoutPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Layout not found: ${filename}` }) }] }
      }

      unlinkSync(layoutPath)

      return { content: [{ type: "text", text: JSON.stringify({ success: true, layout: layout.replace(".html", ""), message: "Layout deleted." }) }] }
    }
  )
}
