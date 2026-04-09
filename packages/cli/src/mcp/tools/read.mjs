/**
 * MCP Read tools: list_decks, get_deck_info, list_layouts, get_layout,
 * list_components, get_component, get_slide, get_screenshot, get_deck_overview, get_guide
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, basename } from "node:path"

import { registerAppTool } from "@modelcontextprotocol/ext-apps/server"
import { z } from "zod"

import { parseDeckManifest } from "../../utils/deck-manifest.mjs"
import { resolveDeckPath, listDeckSlugs } from "../deck-resolver.mjs"
import { getGuideContent } from "../guides/index.mjs"

/** Detect max step from TSX source: step={N} and startStep={N} (AnimatedGroup) */
function detectSteps(content) {
  let max = 0
  for (const m of content.matchAll(/step=\{(\d+)\}/g)) {
    const n = parseInt(m[1], 10)
    if (n > max) max = n
  }
  for (const m of content.matchAll(/startStep=\{(\d+)\}/g)) {
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

function resolveManifestSlideFile(deckPath, slide) {
  if (typeof slide?.file === "string" && slide.file) {
    const fullPath = join(deckPath, slide.file)
    if (existsSync(fullPath)) {
      return { file: slide.file.replace(/^src\/slides\//, ""), fullPath }
    }
  }
  return resolveSlideFile(deckPath, slide?.id)
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
        } catch {
          /* skip invalid */
        }
      }

      if (decks.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                decks: [],
                message: "No decks found. Create one with create_deck."
              })
            }
          ]
        }
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
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "No deck.json found. Create a deck first with create_deck."
              })
            }
          ]
        }
      }

      const manifest = parseDeckManifest(readFileSync(manifestPath, "utf-8"))

      // Enrich slides with auto-detected steps from TSX source
      const slides = manifest.slides.map(s => {
        const resolved = resolveManifestSlideFile(deckPath, s)
        let steps = s.steps ?? 0
        let file = null
        if (resolved) {
          file = resolved.file
          const source = readFileSync(resolved.fullPath, "utf-8")
          steps = detectSteps(source)
        }
        return {
          id: s.id,
          file,
          exportName: s.exportName,
          section: s.section,
          transition: s.transition,
          title: s.title,
          steps
        }
      })

      // List layouts
      const layouts = listTsxFiles(join(deckPath, "src", "layouts")).map(f => ({
        name: f.name,
        file: f.file
      }))

      // List components
      const components = listTsxFiles(join(deckPath, "src", "components")).map(f => ({
        name: f.name,
        file: f.file
      }))

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
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                layouts: [],
                message: "No layouts directory. Create a layout with write_layout."
              })
            }
          ]
        }
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
      const candidates = [join(layoutsDir, `${layout}.tsx`), join(layoutsDir, `${layout}.jsx`)]
      const layoutPath = candidates.find(p => existsSync(p))

      if (!layoutPath) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: `Layout not found: ${layout}` }) }
          ]
        }
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
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ components: [], message: "No components directory." })
            }
          ]
        }
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
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: `Component not found: ${component}` }) }
          ]
        }
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
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${slide}` }) }]
        }
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
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${slide}` }) }]
        }
      }

      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ root: deckRoot })

        const { takeScreenshot } = await import("../screenshot.mjs")
        const base64 = await takeScreenshot({
          deckRoot: deckPath,
          deckSlug: basename(deckPath),
          slideId: slide,
          devServerPort: port,
          scale: scale || 1
        })
        return { content: [{ type: "image", data: base64, mimeType: "image/png" }] }
      } catch (err) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: `Screenshot failed: ${err.message}` }) }
          ]
        }
      }
    }
  )

  // ─── get_slide_html (widget-only, hidden from agent) ───
  registerAppTool(
    server,
    "get_slide_html",
    {
      description: `Get a slide's rendered HTML with all CSS inlined. Used by the preview widget.`,
      inputSchema: {
        deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
        slide: z.string().describe("Slide id (e.g. 'hero')")
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
      _meta: { ui: { visibility: ["app"] } }
    },
    async ({ deck, slide }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const resolved = resolveSlideFile(deckPath, slide)
      if (!resolved) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${slide}` }) }]
        }
      }

      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ root: deckRoot })

        const { captureSlideHtml } = await import("../screenshot.mjs")
        const html = await captureSlideHtml({
          deckRoot: deckPath,
          deckSlug: basename(deckPath),
          slideId: slide,
          devServerPort: port
        })
        return { content: [{ type: "text", text: html }] }
      } catch (err) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: `HTML capture failed: ${err.message}` }) }
          ]
        }
      }
    }
  )

  // ─── get_deck_overview ───
  server.tool(
    "get_deck_overview",
    `Get a thumbnail grid of all slides in the deck as a single base64 PNG image. ` +
      `Limited to decks with 16 or fewer slides — for larger decks, use get_screenshot on individual slides. ` +
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
        const base64 = await takeDeckOverview({
          deckRoot: deckPath,
          deckSlug: basename(deckPath),
          devServerPort: port
        })
        return { content: [{ type: "image", data: base64, mimeType: "image/png" }] }
      } catch (err) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: `Overview failed: ${err.message}` }) }
          ]
        }
      }
    }
  )

  // ─── get_guide ───
  server.tool(
    "get_guide",
    `Get framework documentation by topic. Available guides: ` +
      `"framework" — core reference: slide format, layouts, components, PDF constraints, workflow (read first). ` +
      `"animation-api" — Animated, AnimatedGroup, Morph, step rules, animation intent guide. ` +
      `"slide-design" — content density, design thinking, design principles, anti-patterns, distinctive aesthetics. ` +
      `"style-presets" — 8 curated visual directions with design philosophy. ` +
      `"theming" — colors, CSS variables, theme config, fonts, glow.`,
    {
      topic: z
        .enum(["framework", "animation-api", "slide-design", "style-presets", "theming"])
        .describe(
          'Guide topic: "framework", "animation-api", "slide-design", "style-presets", or "theming"'
        )
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ topic }) => {
      const content = getGuideContent(topic)
      return { content: [{ type: "text", text: content }] }
    }
  )

  // ─── get_build_errors ───
  server.tool(
    "get_build_errors",
    `Get recent Vite compilation errors and dev server output. ` +
      `Use when a slide fails to render, a screenshot times out, or you suspect a build issue. ` +
      `Returns both Vite HMR errors (import resolution, JSX syntax, etc.) and recent dev server stderr.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)")
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      try {
        const { ensureDevServer } = await import("../dev-server.mjs")
        const port = await ensureDevServer({ root: deckRoot })

        // Resolve the deck slug for scoped error queries
        let deckSlug = deck || null
        if (!deckSlug) {
          const slugs = listDeckSlugs(deckRoot)
          if (slugs.length === 1) deckSlug = slugs[0]
        }
        const qs = deckSlug ? `?deck=${encodeURIComponent(deckSlug)}` : ""

        // Fetch errors from Vite plugin's error buffer
        let viteErrors = []
        try {
          const res = await fetch(`http://localhost:${port}/__promptslide_errors${qs}`)
          if (res.ok) {
            const data = await res.json()
            viteErrors = data.errors || []
          }
        } catch {
          /* dev server may not support this endpoint yet */
        }

        // Get recent stderr from dev server process
        let stderr = []
        try {
          const { getRecentStderr } = await import("../dev-server.mjs")
          stderr = getRecentStderr()
        } catch {
          /* may not be available */
        }

        const hasErrors = viteErrors.length > 0 || stderr.length > 0

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  hasErrors,
                  viteErrors,
                  stderr: stderr.slice(-20), // last 20 lines
                  message: hasErrors
                    ? `Found ${viteErrors.length} Vite error(s) and ${stderr.length} stderr line(s).`
                    : "No errors detected."
                },
                null,
                2
              )
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Failed to check errors: ${err.message}` })
            }
          ]
        }
      }
    }
  )

  // ─── get_project_files ───
  server.tool(
    "get_project_files",
    `List the file tree of a deck directory. Shows files, directories, and file sizes. ` +
      `Use to inspect the actual project structure, check config files (tsconfig.json, deck.json), ` +
      `or debug path issues.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      depth: z.number().optional().default(3).describe("Max directory depth (default 3)")
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, depth }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const maxDepth = depth || 3
      const EXCLUDED = new Set(["node_modules", ".git", "dist", ".next", ".cache"])

      function listDir(dir, currentDepth) {
        if (currentDepth > maxDepth) return []
        if (!existsSync(dir)) return []

        const entries = readdirSync(dir, { withFileTypes: true })
          .filter(e => !EXCLUDED.has(e.name))
          .sort((a, b) => {
            // Directories first, then files
            if (a.isDirectory() && !b.isDirectory()) return -1
            if (!a.isDirectory() && b.isDirectory()) return 1
            return a.name.localeCompare(b.name)
          })

        return entries.map(entry => {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            return {
              name: entry.name,
              type: "dir",
              children: listDir(fullPath, currentDepth + 1)
            }
          }
          const stat = statSync(fullPath)
          return { name: entry.name, type: "file", size: stat.size }
        })
      }

      const tree = listDir(deckPath, 1)
      return {
        content: [{ type: "text", text: JSON.stringify({ path: deckPath, tree }, null, 2) }]
      }
    }
  )

  // ─── read_file ───
  server.tool(
    "read_file",
    `Read any file in a deck directory. Use to inspect config files (tsconfig.json, deck.json, globals.css, theme.ts), ` +
      `layouts, components, or any other project file. Path is relative to the deck root.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      path: z
        .string()
        .describe(
          "File path relative to deck root (e.g. 'src/globals.css', 'tsconfig.json', 'deck.json')"
        )
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, path: filePath }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      // Security: prevent path traversal outside deck directory
      const resolved = join(deckPath, filePath)
      if (!resolved.startsWith(deckPath)) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Path traversal not allowed" }) }]
        }
      }

      if (!existsSync(resolved)) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: `File not found: ${filePath}` }) }
          ]
        }
      }

      try {
        const stat = statSync(resolved)
        if (stat.isDirectory()) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: `${filePath} is a directory, not a file. Use get_project_files to list directories.`
                })
              }
            ]
          }
        }
        if (stat.size > 512 * 1024) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: `File too large (${(stat.size / 1024).toFixed(0)} KB). Max 512 KB.`
                })
              }
            ]
          }
        }
        const content = readFileSync(resolved, "utf-8")
        return { content: [{ type: "text", text: content }] }
      } catch (err) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: `Failed to read file: ${err.message}` }) }
          ]
        }
      }
    }
  )
}
