/**
 * MCP Delete tools: delete_deck, delete_slide, delete_layout, delete_component
 *
 * Destructive operations are isolated in this module for clarity.
 */

import { existsSync, unlinkSync, rmSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"

/**
 * Resolve slide file path for a given slide id.
 */
function resolveSlideFile(deckPath, slideId) {
  const slidesDir = join(deckPath, "src", "slides")
  const candidates = [
    `${slideId}.tsx`,
    `${slideId}.jsx`,
    `slide-${slideId}.tsx`,
    `slide-${slideId}.jsx`
  ]
  for (const candidate of candidates) {
    const fullPath = join(slidesDir, candidate)
    if (existsSync(fullPath)) return { file: candidate, fullPath }
  }
  return null
}

function normalizeSlideId(slideId) {
  return slideId.replace(/\.(tsx|jsx)$/, "").replace(/^slide-/, "")
}

export function registerDeleteTools(server, context) {
  const { deckRoot } = context

  // ─── delete_deck ───
  server.tool(
    "delete_deck",
    `Delete an entire deck and all its contents (slides, layouts, components, assets). This is irreversible.`,
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
    `Remove a slide from the deck. Deletes the .tsx file and removes it from deck.json.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero' or 'slide-hero')")
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ deck, slide }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const slideId = normalizeSlideId(slide)
      const resolved = resolveSlideFile(deckPath, slideId)
      if (resolved) {
        unlinkSync(resolved.fullPath)
      }

      // Update deck.json — remove by id
      const manifestPath = join(deckPath, "deck.json")
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
        manifest.slides = manifest.slides.filter(s => s.id !== slideId)
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      }

      return { content: [{ type: "text", text: JSON.stringify({ success: true, slide: slideId, message: "Slide deleted." }) }] }
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

      const layoutsDir = join(deckPath, "src", "layouts")
      const candidates = [
        join(layoutsDir, `${layout}.tsx`),
        join(layoutsDir, `${layout}.jsx`)
      ]
      const layoutPath = candidates.find(p => existsSync(p))

      if (!layoutPath) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Layout not found: ${layout}` }) }] }
      }

      unlinkSync(layoutPath)

      return { content: [{ type: "text", text: JSON.stringify({ success: true, layout, message: "Layout deleted." }) }] }
    }
  )

  // ─── delete_component ───
  server.tool(
    "delete_component",
    `Delete a reusable component from the deck.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      component: z.string().describe("Component name to delete (e.g. 'card')")
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ deck, component }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const componentsDir = join(deckPath, "src", "components")
      const candidates = [
        join(componentsDir, `${component}.tsx`),
        join(componentsDir, `${component}.jsx`)
      ]
      const componentPath = candidates.find(p => existsSync(p))

      if (!componentPath) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Component not found: ${component}` }) }] }
      }

      unlinkSync(componentPath)

      return { content: [{ type: "text", text: JSON.stringify({ success: true, component, message: "Component deleted." }) }] }
    }
  )
}
