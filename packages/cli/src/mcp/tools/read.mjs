/**
 * MCP Read tools: list_decks, get_deck_info, list_layouts, get_layout,
 * list_themes, list_assets, get_slide, get_screenshot, get_deck_overview, get_guide
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { parseSlide, parseDeckManifest } from "../../html/parser.mjs"
import { getGuideContent } from "../guides/index.mjs"
import { resolveDeckPath, listDeckSlugs } from "../deck-resolver.mjs"

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
    `available layouts, themes, and assets. Call this first to understand the deck state.`,
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

      // Enrich slides with auto-detected steps
      const slides = manifest.slides.map(s => {
        const slidePath = join(deckPath, "slides", s.file)
        let steps = 0
        if (existsSync(slidePath)) {
          const html = readFileSync(slidePath, "utf-8")
          steps = parseSlide(html).steps
        }
        return { ...s, steps }
      })

      // List layouts
      const layoutsDir = join(deckPath, "layouts")
      const layouts = existsSync(layoutsDir)
        ? readdirSync(layoutsDir).filter(f => f.endsWith(".html")).map(f => f.replace(".html", ""))
        : []

      // List themes
      const themesDir = join(deckPath, "themes")
      const themes = existsSync(themesDir)
        ? readdirSync(themesDir).filter(f => f.endsWith(".css")).map(f => f.replace(".css", ""))
        : []

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
        themes,
        assets,
        deckPath
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    }
  )

  // ─── list_layouts ───
  server.tool(
    "list_layouts",
    `List all available slide master layouts for a deck. Returns layout names and a preview of each template.`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const layoutsDir = join(deckPath, "layouts")
      if (!existsSync(layoutsDir)) {
        return { content: [{ type: "text", text: JSON.stringify({ layouts: [], message: "No layouts directory. Create a layout with write_layout." }) }] }
      }

      const layouts = readdirSync(layoutsDir)
        .filter(f => f.endsWith(".html"))
        .map(f => {
          const name = f.replace(".html", "")
          const content = readFileSync(join(layoutsDir, f), "utf-8")
          const hasContent = content.includes("<!-- content -->")
          const hasSlideNumber = content.includes("<!-- slideNumber -->")
          const hasTotalSlides = content.includes("<!-- totalSlides -->")
          return { name, hasContent, hasSlideNumber, hasTotalSlides, preview: content.substring(0, 200) }
        })

      return { content: [{ type: "text", text: JSON.stringify({ layouts }, null, 2) }] }
    }
  )

  // ─── get_layout ───
  server.tool(
    "get_layout",
    `Read a slide master layout's HTML template. Returns the raw HTML source.`,
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

      const filename = layout.endsWith(".html") ? layout : `${layout}.html`
      const layoutPath = join(deckPath, "layouts", filename)

      if (!existsSync(layoutPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Layout not found: ${filename}` }) }] }
      }

      const content = readFileSync(layoutPath, "utf-8")
      return { content: [{ type: "text", text: content }] }
    }
  )

  // ─── list_themes ───
  server.tool(
    "list_themes",
    `List all available themes for a deck. Returns theme names and a preview of each CSS file (first 200 characters).`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const themesDir = join(deckPath, "themes")
      if (!existsSync(themesDir)) {
        return { content: [{ type: "text", text: JSON.stringify({ themes: [], message: "No themes directory. Create a theme with write_theme." }) }] }
      }

      const themes = readdirSync(themesDir)
        .filter(f => f.endsWith(".css"))
        .map(f => {
          const name = f.replace(".css", "")
          const content = readFileSync(join(themesDir, f), "utf-8")
          return { name, preview: content.substring(0, 200) }
        })

      return { content: [{ type: "text", text: JSON.stringify({ themes }, null, 2) }] }
    }
  )

  // ─── list_assets ───
  server.tool(
    "list_assets",
    `List all assets in a deck's assets/ directory. Returns filename, size in bytes, and the asset:// URL for referencing in slides.`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const assetsDir = join(deckPath, "assets")
      if (!existsSync(assetsDir)) {
        return { content: [{ type: "text", text: JSON.stringify({ assets: [], message: "No assets directory." }) }] }
      }

      const assets = readdirSync(assetsDir).map(f => {
        const stat = statSync(join(assetsDir, f))
        return { name: f, size: stat.size, url: `asset://${f}` }
      })

      return { content: [{ type: "text", text: JSON.stringify({ assets }, null, 2) }] }
    }
  )

  // ─── get_slide ───
  server.tool(
    "get_slide",
    `Read one slide's HTML content. Returns the raw HTML source of the slide file.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide filename (e.g. 'hero.html' or 'hero')")
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, slide }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const filename = slide.endsWith(".html") ? slide : `${slide}.html`
      const slidePath = join(deckPath, "slides", filename)

      if (!existsSync(slidePath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${filename}` }) }] }
      }

      const content = readFileSync(slidePath, "utf-8")
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
      slide: z.string().describe("Slide filename (e.g. 'hero.html' or 'hero')"),
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

      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ deckRoot })

        const { takeScreenshot } = await import("../screenshot.mjs")
        const filename = slide.endsWith(".html") ? slide : `${slide}.html`
        const deckSlug = deckPath.split("/").pop()
        const base64 = await takeScreenshot({
          deckRoot: deckPath,
          deckSlug,
          slideFile: filename,
          devServerPort: port,
          scale: scale || 1
        })
        return { content: [{ type: "image", data: base64, mimeType: "image/png" }] }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Screenshot failed: ${err.message}` }) }] }
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
        const port = await ensureDevServer({ deckRoot })

        const { takeDeckOverview } = await import("../screenshot.mjs")
        const deckSlug = deckPath.split("/").pop()
        const base64 = await takeDeckOverview({ deckRoot: deckPath, deckSlug, devServerPort: port })
        return { content: [{ type: "image", data: base64, mimeType: "image/png" }] }
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Overview failed: ${err.message}` }) }] }
      }
    }
  )

  // ─── get_guide ───
  server.tool(
    "get_guide",
    `Get detailed framework documentation on a specific topic. ` +
    `Available topics: "getting-started", "animations", "design", "theming", "layouts".`,
    {
      topic: z.enum(["getting-started", "animations", "design", "theming", "layouts"])
        .describe('Guide topic: "getting-started", "animations", "design", "theming", or "layouts"')
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ topic }) => {
      const content = getGuideContent(topic)
      return { content: [{ type: "text", text: content }] }
    }
  )
}
