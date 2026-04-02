/**
 * MCP Read tools: list_decks, get_deck_info, list_layouts, get_layout,
 * list_components, get_component, get_slide, get_screenshot, get_deck_overview, get_guide
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { parseDeckManifest } from "../../utils/deck-manifest.mjs"
import { getGuideContent } from "../guides/index.mjs"
import { resolveDeckPath, listDeckSlugs } from "../deck-resolver.mjs"

/** Detect max step from TSX source: step={N} */
function detectSteps(content) {
  const matches = content.matchAll(/step=\{(\d+)\}/g)
  let max = 0
  for (const m of matches) {
    const n = parseInt(m[1], 10)
    if (n > max) max = n
  }
  return max
}

/** List .tsx/.jsx files in a directory, returning name (without extension) and full path */
function listTsxFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith(".tsx") || f.endsWith(".jsx"))
    .map(f => ({
      name: f.replace(/\.(tsx|jsx)$/, ""),
      file: f,
      fullPath: join(dir, f)
    }))
}

/**
 * Resolve slide file path for a given slide id.
 * Checks: src/slides/{id}.tsx, src/slides/slide-{id}.tsx, and .jsx variants.
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

export function registerReadTools(server, context) {
  const { deckRoot } = context

  // ─── list_decks ───
  server.tool(
    "list_decks",
    `List all available decks. Returns name, slug, slide count, and theme for each deck.`,
    {},
    { readOnlyHint: true, destructiveHint: false },
    async () => {
      const decks = []

      const slugs = listDeckSlugs(deckRoot)
      for (const slug of slugs) {
        const deckPath = join(deckRoot, slug)
        const manifestPath = join(deckPath, "deck.json")
        try {
          const manifest = parseDeckManifest(readFileSync(manifestPath, "utf-8"))
          decks.push({
            name: manifest.name,
            slug: manifest.slug,
            theme: manifest.theme,
            slides: manifest.slides.length,
            path: deckPath
          })
        } catch { /* skip invalid */ }
      }

      if (decks.length === 0) {
        return { content: [{ type: "text", text: JSON.stringify({ decks: [], message: "No decks found. Create one with create_deck." }) }] }
      }

      return { content: [{ type: "text", text: JSON.stringify({ decks }, null, 2) }] }
    }
  )

  // ─── get_deck_info ───
  server.tool(
    "get_deck_info",
    `Get an overview of a deck. Returns deck name, slug, theme, transition, ` +
    `slide list with filenames, sections, and auto-detected step counts, ` +
    `available layouts, components, and assets. Call this first to understand the deck state.`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const manifestPath = join(deckPath, "deck.json")
      if (!existsSync(manifestPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No deck.json found. Create a deck first with create_deck." }) }] }
      }

      const manifest = parseDeckManifest(readFileSync(manifestPath, "utf-8"))

      // Enrich slides with auto-detected steps from TSX source
      const slides = manifest.slides.map(s => {
        const resolved = resolveSlideFile(deckPath, s.id)
        let steps = 0
        let file = null
        if (resolved) {
          file = resolved.file
          const source = readFileSync(resolved.fullPath, "utf-8")
          steps = detectSteps(source)
        }
        return { id: s.id, file, section: s.section, transition: s.transition, title: s.title, steps }
      })

      // List layouts
      const layouts = listTsxFiles(join(deckPath, "src", "layouts"))
        .map(f => ({ name: f.name, file: f.file }))

      // List components
      const components = listTsxFiles(join(deckPath, "src", "components"))
        .map(f => ({ name: f.name, file: f.file }))

      // List assets
      const assetsDir = join(deckPath, "assets")
      const assets = existsSync(assetsDir)
        ? readdirSync(assetsDir).map(f => {
            const stat = statSync(join(assetsDir, f))
            return { name: f, size: stat.size }
          })
        : []

      const result = {
        ...manifest,
        slides,
        layouts,
        components,
        assets,
        deckPath
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    }
  )

  // ─── list_layouts ───
  server.tool(
    "list_layouts",
    `List all available slide master layouts for a deck. Returns layout names and a source preview.`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const layoutsDir = join(deckPath, "src", "layouts")
      if (!existsSync(layoutsDir)) {
        return { content: [{ type: "text", text: JSON.stringify({ layouts: [], message: "No layouts directory. Create a layout with write_layout." }) }] }
      }

      const layouts = listTsxFiles(layoutsDir).map(f => {
        const content = readFileSync(f.fullPath, "utf-8")
        return { name: f.name, file: f.file, preview: content.substring(0, 300) }
      })

      return { content: [{ type: "text", text: JSON.stringify({ layouts }, null, 2) }] }
    }
  )

  // ─── get_layout ───
  server.tool(
    "get_layout",
    `Read a slide master layout's TSX source. Returns the raw source code.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      layout: z.string().describe("Layout name (e.g. 'master')")
    },
    { readOnlyHint: true, destructiveHint: false },
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

      const content = readFileSync(layoutPath, "utf-8")
      return { content: [{ type: "text", text: content }] }
    }
  )

  // ─── list_components ───
  server.tool(
    "list_components",
    `List all reusable components for a deck. Returns component names and a source preview.`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const componentsDir = join(deckPath, "src", "components")
      if (!existsSync(componentsDir)) {
        return { content: [{ type: "text", text: JSON.stringify({ components: [], message: "No components directory." }) }] }
      }

      const components = listTsxFiles(componentsDir).map(f => {
        const content = readFileSync(f.fullPath, "utf-8")
        return { name: f.name, file: f.file, preview: content.substring(0, 300) }
      })

      return { content: [{ type: "text", text: JSON.stringify({ components }, null, 2) }] }
    }
  )

  // ─── get_component ───
  server.tool(
    "get_component",
    `Read a reusable component's TSX source.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      component: z.string().describe("Component name (e.g. 'card')")
    },
    { readOnlyHint: true, destructiveHint: false },
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

      const content = readFileSync(componentPath, "utf-8")
      return { content: [{ type: "text", text: content }] }
    }
  )

  // ─── get_slide ───
  server.tool(
    "get_slide",
    `Read one slide's TSX source code. Returns the raw source of the slide file.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero' or 'slide-hero')")
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, slide }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const resolved = resolveSlideFile(deckPath, slide)
      if (!resolved) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${slide}` }) }] }
      }

      const content = readFileSync(resolved.fullPath, "utf-8")
      return { content: [{ type: "text", text: content }] }
    }
  )

  // ─── get_screenshot ───
  server.tool(
    "get_screenshot",
    `Capture a visual preview of a rendered slide as base64 PNG. ` +
    `Starts the dev server automatically if not already running. ` +
    `Use after creating or editing slides to verify the result looks correct.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero')"),
      scale: z.number().optional().default(1).describe("Screenshot scale (1 or 2)")
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, slide, scale }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      // Resolve slide file for the screenshot service
      const resolved = resolveSlideFile(deckPath, slide)
      if (!resolved) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${slide}` }) }] }
      }

      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ root: deckRoot })

        const { takeScreenshot } = await import("../screenshot.mjs")
        const base64 = await takeScreenshot({
          deckRoot: deckPath,
          deckSlug: deckPath.split("/").pop(),
          slideId: slide,
          devServerPort: port,
          scale: scale || 1
        })
        return { content: [{ type: "image", data: base64, mimeType: "image/png" }] }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Screenshot failed: ${err.message}` }) }] }
      }
    }
  )

  // ─── get_slide_html (internal, used by MCP App widget) ───
  server.tool(
    "get_slide_html",
    `Get a slide's rendered HTML with all CSS inlined. Used by the preview widget for crisp rendering.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero')")
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, slide }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const resolved = resolveSlideFile(deckPath, slide)
      if (!resolved) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${slide}` }) }] }
      }

      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ root: deckRoot })

        const { captureSlideHtml } = await import("../screenshot.mjs")
        const html = await captureSlideHtml({
          deckRoot: deckPath,
          deckSlug: deckPath.split("/").pop(),
          slideId: slide,
          devServerPort: port
        })
        return { content: [{ type: "text", text: html }] }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `HTML capture failed: ${err.message}` }) }] }
      }
    }
  )

  // ─── get_deck_overview ───
  server.tool(
    "get_deck_overview",
    `Get a thumbnail grid of all slides in the deck as a single base64 PNG image. ` +
    `Starts the dev server automatically if not already running.`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ root: deckRoot })

        const { takeDeckOverview } = await import("../screenshot.mjs")
        const base64 = await takeDeckOverview({ deckRoot: deckPath, deckSlug: deckPath.split("/").pop(), devServerPort: port })
        return { content: [{ type: "image", data: base64, mimeType: "image/png" }] }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Overview failed: ${err.message}` }) }] }
      }
    }
  )

  // ─── get_guide ───
  server.tool(
    "get_guide",
    `Get framework documentation. Two guides available: ` +
    `"framework" — comprehensive reference for slide format, animations, layouts, theming, and workflow (read once at start). ` +
    `"design-recipes" — code snippets for backgrounds, card styles, layout patterns, data viz, and typography.`,
    {
      topic: z.enum(["framework", "design-recipes"])
        .describe('Guide topic: "framework" (comprehensive reference) or "design-recipes" (code snippets)')
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ topic }) => {
      const content = getGuideContent(topic)
      return { content: [{ type: "text", text: content }] }
    }
  )
}
