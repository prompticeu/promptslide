/**
 * Vite plugin for HTML slide mode (multi-deck).
 *
 * Serves ALL decks from a parent directory via URL-based routing:
 * - / → deck selector page (lists available decks)
 * - /:slug → serves that deck's slides
 * - /:slug?export=true&slide=N → export mode for a specific slide
 *
 * The deck slug is injected into the HTML template so the virtual entry
 * module knows which deck to load at runtime.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join, basename, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { parseSlide, parseDeckManifest } from "./parser.mjs"
import { compileSlide } from "./compiler.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))

const VIRTUAL_HTML_ENTRY = "virtual:promptslide-html-entry"
const RESOLVED_HTML_ENTRY = "\0" + VIRTUAL_HTML_ENTRY
const VIRTUAL_SLIDE_PREFIX = "virtual:html-slide/"
const RESOLVED_SLIDE_PREFIX = "\0virtual:html-slide/"
const VIRTUAL_SLIDE_SUFFIX = ".js"

/**
 * Detect if a project uses the HTML slide format (deck.json exists).
 * In multi-deck mode, checks if any subdirectory has deck.json.
 */
export function isHtmlDeck(root) {
  // Single deck check
  if (existsSync(join(root, "deck.json"))) return true
  // Multi-deck check: any subdirectory with deck.json
  if (existsSync(root)) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(root, entry.name, "deck.json"))) {
        return true
      }
    }
  }
  return false
}

/**
 * Find all deck slugs under a root directory.
 */
function findDeckSlugs(root) {
  if (!existsSync(root)) return []
  const slugs = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(join(root, entry.name, "deck.json"))) {
      slugs.push(entry.name)
    }
  }
  return slugs
}

/**
 * Create the HTML slides Vite plugin.
 *
 * @param {{ root?: string }} options
 */
export function htmlSlidesPlugin({ root: initialRoot } = {}) {
  let root
  /** @type {Map<string, object>} slug -> parsed manifest */
  const manifests = new Map()
  /** @type {Map<string, Map<string, string>>} slug -> (filename -> compiled source) */
  const compiledSlidesMap = new Map()
  /** @type {Map<string, Map<string, number>>} slug -> (filename -> step count) — for detecting step changes */
  const slideStepsMap = new Map()

  function loadManifest(slug) {
    const deckPath = join(root, slug)
    const manifestPath = join(deckPath, "deck.json")
    if (!existsSync(manifestPath)) return null
    const raw = readFileSync(manifestPath, "utf-8")
    return parseDeckManifest(raw)
  }

  function loadAllManifests() {
    manifests.clear()
    const slugs = findDeckSlugs(root)
    for (const slug of slugs) {
      const manifest = loadManifest(slug)
      if (manifest) manifests.set(slug, manifest)
    }
  }

  function compileAllSlides(slug) {
    const manifest = manifests.get(slug)
    if (!manifest) return

    const deckPath = join(root, slug)
    const compiled = new Map()
    const steps = new Map()

    for (const slideEntry of manifest.slides) {
      const slidePath = join(deckPath, "slides", slideEntry.file)
      if (!existsSync(slidePath)) continue

      const html = readFileSync(slidePath, "utf-8")
      const parsed = parseSlide(html)
      const compiledSrc = compileSlide({
        content: parsed.content,
        layout: parsed.layout,
        deckRoot: deckPath,
        slideName: slideEntry.file,
        slots: parsed.slots
      })
      compiled.set(slideEntry.file, compiledSrc)
      steps.set(slideEntry.file, parsed.steps)
    }

    compiledSlidesMap.set(slug, compiled)
    slideStepsMap.set(slug, steps)
  }

  function compileAllDecks() {
    compiledSlidesMap.clear()
    for (const slug of manifests.keys()) {
      compileAllSlides(slug)
    }
  }

  /**
   * Extract deck slug from a virtual module ID.
   * Format: \0virtual:html-slide/<slug>/<filename>.js
   */
  function parseSlideModuleId(id) {
    if (!id.startsWith(RESOLVED_SLIDE_PREFIX)) return null
    const rest = id.slice(RESOLVED_SLIDE_PREFIX.length)
    // rest = "<slug>/<filename>.js"
    const slashIdx = rest.indexOf("/")
    if (slashIdx < 0) return null
    const slug = rest.slice(0, slashIdx)
    let filename = rest.slice(slashIdx + 1)
    if (filename.endsWith(VIRTUAL_SLIDE_SUFFIX)) {
      filename = filename.slice(0, -VIRTUAL_SLIDE_SUFFIX.length)
    }
    return { slug, filename }
  }

  function generateEntryModule(slug) {
    const manifest = manifests.get(slug)
    if (!manifest) return "export default function App() { return null }"

    const deckPath = join(root, slug)
    const slideImports = []
    const slideConfigs = []

    for (let i = 0; i < manifest.slides.length; i++) {
      const entry = manifest.slides[i]
      const varName = `Slide${i}`
      slideImports.push(`import ${varName} from "${VIRTUAL_SLIDE_PREFIX}${slug}/${entry.file}${VIRTUAL_SLIDE_SUFFIX}"`)

      // Auto-detect steps from compiled HTML
      const slidePath = join(deckPath, "slides", entry.file)
      let steps = 0
      if (existsSync(slidePath)) {
        const html = readFileSync(slidePath, "utf-8")
        const parsed = parseSlide(html)
        steps = parsed.steps
      }

      const slideId = entry.file.replace(/\.html$/, "")
      const configParts = [`id: "${slideId}"`, `component: ${varName}`, `steps: ${steps}`]
      if (entry.section) configParts.push(`section: "${entry.section}"`)
      if (entry.transition) configParts.push(`transition: "${entry.transition}"`)

      slideConfigs.push(`  { ${configParts.join(", ")} }`)
    }

    // Load theme CSS if specified
    let themeImport = ""
    if (manifest.theme) {
      const themePath = join(deckPath, "themes", `${manifest.theme}.css`)
      if (existsSync(themePath)) {
        themeImport = `import "${themePath}"`
      }
    }

    // Look for a default globals.css
    const globalsCssPath = join(deckPath, "themes", "default.css")
    let globalsImport = ""
    if (existsSync(globalsCssPath)) {
      globalsImport = `import "${globalsCssPath}"`
    }

    // Build theme config for SlideThemeProvider
    const themeConfig = {
      name: manifest.name || "Untitled"
    }
    if (manifest.logo) {
      themeConfig.logo = { full: manifest.logo.replace(/^asset:\/\//, `/${slug}/assets/`) }
    }

    const transition = manifest.transition || "fade"
    const directional = manifest.directionalTransition ?? true

    return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
import { SlideThemeProvider, SlideDeck } from "promptslide"
${globalsImport}
${themeImport}
${slideImports.join("\n")}

const slides = [
${slideConfigs.join(",\n")}
]

const theme = ${JSON.stringify(themeConfig)}

function App() {
  return createElement(
    SlideThemeProvider,
    { theme },
    createElement(SlideDeck, {
      slides,
      transition: "${transition}",
      directionalTransition: ${directional}
    })
  )
}

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(App))
)
`
  }

  /**
   * Generate the deck selector HTML page shown at /.
   */
  function generateDeckSelectorHtml() {
    const deckCards = []
    for (const [slug, manifest] of manifests) {
      const slideCount = manifest.slides.length
      deckCards.push(`
        <a href="/${slug}" class="deck-card">
          <h2>${escapeHtml(manifest.name || slug)}</h2>
          <p>${slideCount} slide${slideCount !== 1 ? "s" : ""}</p>
          ${manifest.theme ? `<p class="theme">Theme: ${escapeHtml(manifest.theme)}</p>` : ""}
        </a>`)
    }

    if (deckCards.length === 0) {
      deckCards.push(`<p class="empty">No decks found. Create one with the MCP create_deck tool.</p>`)
    }

    return `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PromptSlide — Decks</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { height: 100%; font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; }
      .container { max-width: 800px; margin: 0 auto; padding: 3rem 1.5rem; }
      h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 2rem; color: #fff; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
      .deck-card {
        display: block; padding: 1.5rem; border-radius: 0.75rem;
        background: #171717; border: 1px solid #262626;
        text-decoration: none; color: inherit;
        transition: border-color 0.15s, background 0.15s;
      }
      .deck-card:hover { border-color: #525252; background: #1c1c1c; }
      .deck-card h2 { font-size: 1.1rem; font-weight: 500; margin-bottom: 0.5rem; color: #fff; }
      .deck-card p { font-size: 0.85rem; color: #a3a3a3; }
      .deck-card .theme { margin-top: 0.25rem; font-size: 0.8rem; color: #737373; }
      .empty { color: #737373; font-size: 0.95rem; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>PromptSlide Decks</h1>
      <div class="grid">
        ${deckCards.join("\n        ")}
      </div>
    </div>
  </body>
</html>`
  }

  return {
    name: "promptslide-html-slides",
    enforce: "pre",

    configResolved(config) {
      root = initialRoot || config.root
      loadAllManifests()
      compileAllDecks()
    },

    resolveId(id) {
      if (id === VIRTUAL_HTML_ENTRY) return RESOLVED_HTML_ENTRY
      // Per-deck entry: virtual:promptslide-html-entry--<slug>
      if (id.startsWith(VIRTUAL_HTML_ENTRY + "--")) return "\0" + id
      if (id.startsWith(VIRTUAL_SLIDE_PREFIX)) return "\0" + id
    },

    load(id) {
      if (id === RESOLVED_HTML_ENTRY) {
        return "export default function App() { return null }"
      }
      // Per-deck entry: \0virtual:promptslide-html-entry--<slug>
      if (id.startsWith(RESOLVED_HTML_ENTRY + "--")) {
        const slug = id.slice(RESOLVED_HTML_ENTRY.length + 2)
        return generateEntryModule(slug)
      }
      if (id.startsWith(RESOLVED_SLIDE_PREFIX)) {
        const parsed = parseSlideModuleId(id)
        if (!parsed) return "export default function() { return null }"
        const deckSlides = compiledSlidesMap.get(parsed.slug)
        if (!deckSlides) return "export default function() { return null }"
        return deckSlides.get(parsed.filename) || "export default function() { return null }"
      }
    },

    configureServer(server) {
      // PDF export endpoint: /api/export/:slug.pdf
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ""
        const pdfMatch = url.match(/^\/api\/export\/([^/]+)\.pdf$/)
        if (pdfMatch) {
          const slug = pdfMatch[1]
          if (!manifests.has(slug)) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: `Deck "${slug}" not found` }))
            return
          }

          try {
            const { exportPdfBuffer } = await import("../mcp/pdf-export.mjs")
            const address = server.httpServer?.address()
            const port = typeof address === "object" ? address?.port : 5173
            const pdfBuffer = await exportPdfBuffer({ deckSlug: slug, devServerPort: port })

            res.setHeader("Content-Type", "application/pdf")
            res.setHeader("Content-Disposition", `attachment; filename="${slug}.pdf"`)
            res.setHeader("Content-Length", pdfBuffer.length)
            res.end(pdfBuffer)
          } catch (err) {
            res.statusCode = 500
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ error: `PDF export failed: ${err.message}` }))
          }
          return
        }
        next()
      })

      // Serve assets for specific decks: /:slug/assets/*
      server.middlewares.use((req, res, next) => {
        const url = req.url || ""
        // Match /:slug/assets/...
        const assetMatch = url.match(/^\/([^/]+)\/assets\/(.+)$/)
        if (assetMatch) {
          const slug = assetMatch[1]
          const assetFile = assetMatch[2]
          const assetPath = join(root, slug, "assets", assetFile)
          if (existsSync(assetPath)) {
            const data = readFileSync(assetPath)
            const ext = assetPath.split(".").pop()?.toLowerCase()
            const mimeTypes = {
              svg: "image/svg+xml",
              png: "image/png",
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              gif: "image/gif",
              webp: "image/webp",
              ico: "image/x-icon",
              woff: "font/woff",
              woff2: "font/woff2",
              ttf: "font/ttf",
              mp4: "video/mp4",
              webm: "video/webm"
            }
            res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream")
            res.end(data)
            return
          }
        }
        next()
      })

      // Watch all deck directories for changes
      const watchAllDecks = () => {
        const slugs = findDeckSlugs(root)
        for (const slug of slugs) {
          const deckPath = join(root, slug)
          server.watcher.add([
            join(deckPath, "deck.json"),
            join(deckPath, "slides"),
            join(deckPath, "layouts"),
            join(deckPath, "themes")
          ])
        }
      }
      watchAllDecks()

      server.watcher.on("change", (filePath) => {
        // Determine which deck this file belongs to
        if (!filePath.startsWith(root)) return
        const relToRoot = filePath.slice(root.length + 1)
        const slashIdx = relToRoot.indexOf("/")
        if (slashIdx < 0) return
        const slug = relToRoot.slice(0, slashIdx)
        const relToDeck = relToRoot.slice(slashIdx + 1)

        if (relToDeck === "deck.json") {
          const manifest = loadManifest(slug)
          if (manifest) {
            manifests.set(slug, manifest)
            compileAllSlides(slug)
          }
          // Invalidate the per-deck entry module
          const entryModId = RESOLVED_HTML_ENTRY + "--" + slug
          const entryMod = server.moduleGraph.getModuleById(entryModId)
          if (entryMod) server.moduleGraph.invalidateModule(entryMod)
          server.ws.send({ type: "full-reload" })
          return
        }

        if (relToDeck.startsWith("slides/") && relToDeck.endsWith(".html")) {
          const filename = basename(filePath)
          const deckPath = join(root, slug)
          const html = readFileSync(filePath, "utf-8")
          const parsed = parseSlide(html)
          const compiled = compileSlide({
            content: parsed.content,
            layout: parsed.layout,
            deckRoot: deckPath,
            slideName: filename,
            slots: parsed.slots
          })
          if (!compiledSlidesMap.has(slug)) compiledSlidesMap.set(slug, new Map())
          compiledSlidesMap.get(slug).set(filename, compiled)

          // Track step count changes
          const oldSteps = slideStepsMap.get(slug)?.get(filename)
          const newSteps = parsed.steps
          if (!slideStepsMap.has(slug)) slideStepsMap.set(slug, new Map())
          slideStepsMap.get(slug).set(filename, newSteps)

          // Invalidate the specific slide module — Vite HMR handles the rest
          // React Fast Refresh will hot-swap the component without losing state
          const slideModId = RESOLVED_SLIDE_PREFIX + slug + "/" + filename + VIRTUAL_SLIDE_SUFFIX
          const slideMod = server.moduleGraph.getModuleById(slideModId)
          if (slideMod) {
            server.moduleGraph.invalidateModule(slideMod)
            // Send HMR update for just this module
            server.ws.send({
              type: "update",
              updates: [{
                type: "js-update",
                path: slideMod.url,
                acceptedPath: slideMod.url,
                timestamp: Date.now()
              }]
            })
          }

          // If steps changed, entry module needs update too (step counts are in the entry)
          if (oldSteps !== undefined && oldSteps !== newSteps) {
            const entryModId = RESOLVED_HTML_ENTRY + "--" + slug
            const entryMod = server.moduleGraph.getModuleById(entryModId)
            if (entryMod) server.moduleGraph.invalidateModule(entryMod)
            server.ws.send({ type: "full-reload" })
          }

          return
        }

        if (relToDeck.startsWith("layouts/") && relToDeck.endsWith(".html")) {
          compileAllSlides(slug)
          const deckSlides = compiledSlidesMap.get(slug)
          if (deckSlides) {
            for (const [filename] of deckSlides) {
              const mod = server.moduleGraph.getModuleById(RESOLVED_SLIDE_PREFIX + slug + "/" + filename + VIRTUAL_SLIDE_SUFFIX)
              if (mod) {
                server.moduleGraph.invalidateModule(mod)
                server.ws.send({
                  type: "update",
                  updates: [{
                    type: "js-update",
                    path: mod.url,
                    acceptedPath: mod.url,
                    timestamp: Date.now()
                  }]
                })
              }
            }
          }
          return
        }

        if (relToDeck.startsWith("themes/") && relToDeck.endsWith(".css")) {
          // CSS changes are handled by Vite's built-in CSS HMR — no full reload needed
        }
      })

      // Watch for new files / new decks
      server.watcher.on("add", (filePath) => {
        if (!filePath.startsWith(root)) return
        const relToRoot = filePath.slice(root.length + 1)
        const slashIdx = relToRoot.indexOf("/")
        if (slashIdx < 0) return
        const slug = relToRoot.slice(0, slashIdx)
        const relToDeck = relToRoot.slice(slashIdx + 1)

        if (relToDeck === "deck.json" || relToDeck.startsWith("slides/") || relToDeck.startsWith("layouts/") || relToDeck.startsWith("themes/")) {
          const manifest = loadManifest(slug)
          if (manifest) {
            manifests.set(slug, manifest)
            compileAllSlides(slug)
          }
          const entryModId = RESOLVED_HTML_ENTRY + "--" + slug
          const entryMod = server.moduleGraph.getModuleById(entryModId)
          if (entryMod) server.moduleGraph.invalidateModule(entryMod)
          server.ws.send({ type: "full-reload" })
          watchAllDecks()
        }
      })

      // Pre-middleware: serve deck pages and selector BEFORE Vite's SPA fallback
      // Post-middleware: serve deck pages and selector AFTER Vite's middleware
      // (appType: 'custom' in vite config disables Vite's SPA fallback)
      return () => {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`)
        const pathname = url.pathname

        // Root: deck selector
        if (pathname === "/" || pathname === "/index.html") {
          loadAllManifests()
          const html = generateDeckSelectorHtml()
          res.setHeader("Content-Type", "text/html")
          res.statusCode = 200
          res.end(html)
          return
        }

        // Extract deck slug from path: /:slug or /:slug/anything
        const match = pathname.match(/^\/([^/]+)(\/.*)?$/)
        if (match) {
          const slug = match[1]

          // Check if this is a valid deck
          if (manifests.has(slug) || existsSync(join(root, slug, "deck.json"))) {
            // Ensure manifest is loaded
            if (!manifests.has(slug)) {
              const manifest = loadManifest(slug)
              if (manifest) {
                manifests.set(slug, manifest)
                compileAllSlides(slug)
              }
            }

            const deckEntryId = VIRTUAL_HTML_ENTRY + "--" + slug
            try {
              const html = await server.transformIndexHtml(
                req.url,
                getHtmlModeTemplate(slug, deckEntryId)
              )
              res.setHeader("Content-Type", "text/html")
              res.statusCode = 200
              res.end(html)
            } catch (err) {
              // Log error and fall through
              console.error(`[promptslide] Error rendering deck "${slug}":`, err.message)
              next()
            }
            return
          }
        }

        next()
      })
      }
    },

    // Transform asset:// URLs in compiled slide source — now deck-aware
    transform(code, id) {
      if (id.startsWith(RESOLVED_SLIDE_PREFIX)) {
        const parsed = parseSlideModuleId(id)
        if (parsed) {
          // Replace asset:// with /<slug>/assets/ for dev server serving
          return code.replace(/asset:\/\//g, `/${parsed.slug}/assets/`)
        }
      }
      if (id.startsWith(RESOLVED_HTML_ENTRY)) {
        // For entry modules, asset URLs are already rewritten in generateEntryModule
        return code
      }
    }
  }
}

/**
 * Vite plugin that injects @source for framework core files BEFORE PostCSS/Tailwind runs.
 * This ensures Tailwind scans SlideDeck, Animated, etc. for utility class names.
 */
export function tailwindSourcePlugin({ deckRoot } = {}) {
  const corePath = resolve(__dirname, "../core")
  return {
    name: "promptslide:tailwind-source",
    enforce: "pre",
    transform(code, id) {
      if (id.endsWith(".css") && code.includes("@import") && code.includes("tailwindcss")) {
        // @source must come after ALL @import statements (CSS requires @import before other rules)
        // Find the last @import statement and inject @source after it
        const importRegex = /@import\s+[^;]+;/g
        let lastImportEnd = 0
        let match
        while ((match = importRegex.exec(code)) !== null) {
          lastImportEnd = match.index + match[0].length
        }
        if (lastImportEnd > 0) {
          let sources = `\n@source "${corePath}";`
          // Also scan deck HTML files (slides, layouts) so Tailwind generates
          // CSS for all utility classes used in slide content
          if (deckRoot) {
            sources += `\n@source "${deckRoot}";`
          }
          return code.slice(0, lastImportEnd) + sources + code.slice(lastImportEnd)
        }
      }
    }
  }
}

/**
 * HTML template for a specific deck.
 * Injects the deck slug so the entry module knows which deck to load.
 *
 * @param {string} slug - Deck slug
 * @param {string} entryId - Virtual entry module ID for this deck
 */
export function getHtmlModeTemplate(slug, entryId) {
  return `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PromptSlide</title>
    <style>html, body, #root { height: 100%; margin: 0; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/@id/${entryId}"></script>
  </body>
</html>`
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
