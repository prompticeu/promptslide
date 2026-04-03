import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from "node:fs"
import { dirname, join, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { exec } from "node:child_process"
import { platform } from "node:os"
import { bold, dim } from "../utils/ansi.mjs"
import { readDeckManifest } from "../utils/deck-manifest.mjs"

const VIRTUAL_ENTRY_ID = "virtual:promptslide-entry"
const RESOLVED_VIRTUAL_ENTRY_ID = "\0" + VIRTUAL_ENTRY_ID
const VIRTUAL_EXPORT_ID = "virtual:promptslide-export"
const RESOLVED_VIRTUAL_EXPORT_ID = "\0" + VIRTUAL_EXPORT_ID
const VIRTUAL_EMBED_ID = "virtual:promptslide-embed"
const RESOLVED_VIRTUAL_EMBED_ID = "\0" + VIRTUAL_EMBED_ID
const __dirname = dirname(fileURLToPath(import.meta.url))
const FRAMEWORK_SOURCE_ROOT = resolve(__dirname, "../core")

// Inline script that catches module load errors (e.g. missing named exports)
// and forwards them to the Vite dev server so they appear in terminal logs.
// Must be a regular script (not type="module") to run before module evaluation.
const ERROR_FORWARD_SCRIPT = `<script>
window.addEventListener("error", function(e) {
  if (e.message) {
    fetch("/__promptslide_error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: e.message, filename: e.filename || "" })
    }).catch(function() {});
  }
});
</script>`

function getHtmlTemplate(moduleId = VIRTUAL_ENTRY_ID) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PromptSlide</title>
    <style>html, body, #root { margin: 0; padding: 0; height: 100%; } body { background: #0a0a0a; }</style>
  </head>
  <body>
    <div id="root"></div>
    ${ERROR_FORWARD_SCRIPT}
    <script type="module" src="/@id/${moduleId}"></script>
  </body>
</html>`
}

function getExportHtmlTemplate(moduleId = VIRTUAL_EXPORT_ID) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PromptSlide Export</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/@id/${moduleId}"></script>
  </body>
</html>`
}

function getEmbedHtmlTemplate(moduleId = VIRTUAL_EMBED_ID) {
  return `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PromptSlide Embed</title>
    <style>html, body { margin: 0; padding: 0; overflow: hidden; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/@id/${moduleId}"></script>
  </body>
</html>`
}

/**
 * Ensure a globals.css exists for a deck. Creates a default one if missing.
 * Returns the absolute path to the globals.css file.
 */
function ensureGlobalsCss(deckRoot) {
  const globalsPath = join(deckRoot, "src", "globals.css")
  if (!existsSync(globalsPath)) {
    const srcDir = join(deckRoot, "src")
    if (!existsSync(srcDir)) {
      mkdirSync(srcDir, { recursive: true })
    }
    writeFileSync(globalsPath, '@import "tailwindcss";\n')
  }
  return globalsPath
}

function getGlobalsCssImport(root) {
  const globalsPath = ensureGlobalsCss(root)
  return globalsPath
}

/** Read and normalize deck.json via the shared manifest parser. */
function readDeckJson(root) {
  try {
    return readDeckManifest(root)
  } catch {
    return null
  }
}

function listDecks(root) {
  if (!existsSync(root)) return []

  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(root, entry.name, "deck.json")))
    .map(entry => {
      const deckRoot = join(root, entry.name)
      const manifest = readDeckJson(deckRoot)
      const deckJsonPath = join(deckRoot, "deck.json")
      const stat = statSync(deckJsonPath)
      return {
        slug: entry.name,
        name: manifest?.name || entry.name,
        slides: manifest?.slides?.length || 0,
        slideCount: manifest?.slides?.length || 0,
        transition: manifest?.transition || "fade",
        theme: manifest?.theme || null,
        modifiedAt: stat.mtime.toISOString()
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function resolveDeckRoot(hostRoot, deckSlug) {
  if (!deckSlug) {
    return existsSync(join(hostRoot, "deck.json")) ? hostRoot : null
  }

  const candidate = join(hostRoot, deckSlug)
  if (existsSync(join(candidate, "deck.json"))) return candidate

  const hostManifest = readDeckJson(hostRoot)
  if (hostManifest?.slug === deckSlug) return hostRoot

  return null
}

function getDeckSlugFromPathname(pathname) {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length !== 1) return null
  return decodeURIComponent(parts[0])
}

function getDeckSlugFromReferer(referer) {
  if (!referer) return null
  try {
    const url = new URL(referer)
    return getDeckSlugFromPathname(url.pathname)
  } catch {
    return null
  }
}

function getDeckRootForRequest(hostRoot, pathname, referer = null) {
  const slug = getDeckSlugFromPathname(pathname) ?? getDeckSlugFromReferer(referer)
  return resolveDeckRoot(hostRoot, slug)
}

function getVirtualParams(id) {
  const normalized = id.startsWith("\0") ? id.slice(1) : id
  const question = normalized.indexOf("?")
  if (question === -1) {
    return { base: normalized, params: new URLSearchParams() }
  }
  return {
    base: normalized.slice(0, question),
    params: new URLSearchParams(normalized.slice(question + 1))
  }
}

function buildVirtualId(base, entries) {
  const params = new URLSearchParams()
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value)
    }
  }
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

/**
 * Resolve the slide file path for a given slide id.
 * Checks src/slides/{id}.tsx, src/slides/{id}.jsx, src/slides/slide-{id}.tsx, src/slides/slide-{id}.jsx
 */
function resolveSlideFile(root, id) {
  const normalizedId = String(id).replace(/^src\/slides\//, "").replace(/\.(tsx|jsx)$/, "")
  const candidates = [
    `src/slides/${normalizedId}.tsx`,
    `src/slides/${normalizedId}.jsx`
  ]
  if (!normalizedId.startsWith("slide-")) {
    candidates.push(`src/slides/slide-${normalizedId}.tsx`, `src/slides/slide-${normalizedId}.jsx`)
  }
  for (const candidate of candidates) {
    if (existsSync(join(root, candidate))) return candidate
  }
  // Default to .tsx even if it doesn't exist yet (agent may be about to create it)
  return normalizedId.startsWith("slide-")
    ? `src/slides/${normalizedId}.tsx`
    : `src/slides/slide-${normalizedId}.tsx`
}

function resolveSlideEntryFile(root, entry) {
  if (typeof entry?.file === "string" && entry.file) {
    const normalizedFile = entry.file.replace(/^\.\//, "")
    if (existsSync(join(root, normalizedFile))) return normalizedFile
  }
  return resolveSlideFile(root, entry?.id)
}

function getRegistryFileRelativePath(file) {
  const target = typeof file?.target === "string" ? file.target : ""
  const filePath = typeof file?.path === "string" ? file.path : ""

  if (target && filePath) {
    const normalizedTarget = target.replace(/\\/g, "/")
    const normalizedPath = filePath.replace(/\\/g, "/")
    if (/\.[a-z0-9]+$/i.test(normalizedTarget) || normalizedTarget.endsWith(normalizedPath)) {
      return target
    }
    return join(target, filePath)
  }

  return target || filePath || null
}

function getDefaultSlidePath(root) {
  const deckJson = readDeckJson(root)
  const firstSlide = deckJson?.slides?.[0]
  if (firstSlide) {
    return resolveSlideEntryFile(root, firstSlide)
  }
  return "src/slides/slide-title.tsx"
}

function resolveThemeModule(root) {
  const candidates = [
    "src/theme.ts",
    "src/theme.tsx",
    "src/theme.js",
    "src/theme.jsx",
    "src/theme.mjs"
  ]
  for (const candidate of candidates) {
    if (existsSync(join(root, candidate))) return `${root}/${candidate}`
  }
  return null
}

function getThemeLoadBlock(root) {
  const themeModulePath = resolveThemeModule(root)
  if (!themeModulePath) return "const theme = {}"

  return `
let theme = {}
const themeMod = await import("${themeModulePath}")
  theme = themeMod.theme || themeMod.default || {}
`
}

function getThemeCssImport(root, deckJson) {
  const themeCssPath = deckJson?.theme && existsSync(join(root, "themes", `${deckJson.theme}.css`))
    ? `${root}/themes/${deckJson.theme}.css`
    : null
  return themeCssPath ? `import "${themeCssPath}"` : ""
}

function getSlideComponentExpression(varName, entry) {
  const candidates = [`${varName}.default`]
  const exportName = entry?.exportName || entry?.componentName
  if (exportName) {
    candidates.push(`${varName}[${JSON.stringify(exportName)}]`)
  }
  candidates.push(`Object.values(${varName}).find(v => typeof v === "function")`)
  return candidates.join(" ?? ")
}

function isLegacyHtmlDeck(deckJson) {
  return Boolean(deckJson?.slides?.some(entry => typeof entry.file === "string" && entry.file.endsWith(".html")))
}


function hasLegacyApp(root) {
  const appCandidates = [
    "src/App.tsx",
    "src/App.jsx",
    "src/App.ts",
    "src/App.js"
  ]
  const globalsCandidates = [
    "src/globals.css",
    "src/globals.scss",
    "src/globals.sass"
  ]
  return appCandidates.some(candidate => existsSync(join(root, candidate))) &&
    globalsCandidates.some(candidate => existsSync(join(root, candidate)))
}

function getDeckIndexEntryModule(root) {
  return `
import { StrictMode, createElement, useState } from "react"
import { createRoot } from "react-dom/client"
import { LibraryView } from "promptslide"
import "${FRAMEWORK_SOURCE_ROOT}/app/globals.css"

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(LibraryView))
)
`
}

function getDeckNotFoundEntryModule(root, deckSlug) {
  const decks = listDecks(root).slice(0, 8)

  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"

const decks = ${JSON.stringify(decks)}

function NotFound() {
  return createElement("main", {
    style: {
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#111315",
      color: "#f5f5f5",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      padding: "32px"
    }
  }, createElement("div", {
    style: {
      width: "min(760px, 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      background: "#17191d",
      borderRadius: "18px",
      padding: "28px 30px"
    }
  },
    createElement("div", {
      style: {
        color: "#8a8f98",
        textTransform: "uppercase",
        letterSpacing: "0.16em",
        fontSize: "12px",
        marginBottom: "10px"
      }
    }, "Deck not found"),
    createElement("h1", { style: { margin: 0, fontSize: "32px", lineHeight: 1.1 } }, ${JSON.stringify(deckSlug)}),
    createElement("p", { style: { margin: "12px 0 0", color: "#b5bcc7", fontSize: "15px", lineHeight: 1.5 } },
      "This deck slug does not exist under the current workspace."
    ),
    decks.length
      ? createElement("div", { style: { marginTop: "24px" } },
          createElement("div", {
            style: {
              color: "#8a8f98",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontSize: "11px",
              marginBottom: "12px"
            }
          }, "Available decks"),
          createElement("div", {
            style: { display: "flex", flexWrap: "wrap", gap: "10px" }
          },
            ...decks.map(deck => createElement("a", {
              key: deck.slug,
              href: "/" + deck.slug,
              style: {
                textDecoration: "none",
                color: "#e5e7eb",
                background: "#20242a",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "999px",
                padding: "10px 14px",
                fontSize: "13px"
              }
            }, deck.name))
          )
        )
      : null
  ))
}

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(NotFound))
)
`
}

/**
 * Generate the entry module from deck.json.
 * Framework-owned: imports slides, creates SlideDeck with SlideThemeProvider.
 */
function getDeckJsonEntryModule(root, deckJson, deckSlug = null) {
  const slideImports = []
  const slideConfigs = []
  const transition = deckJson.transition || "fade"
  const directional = deckJson.directionalTransition ?? true
  const themeImport = getThemeCssImport(root, deckJson)
  const themeLoadBlock = getThemeLoadBlock(root)
  const showStudioChrome = deckSlug !== null

  for (let i = 0; i < deckJson.slides.length; i++) {
    const entry = deckJson.slides[i]
    const filePath = resolveSlideEntryFile(root, entry)
    const varName = `_slide${i}`
    slideImports.push(`import * as ${varName} from "${root}/${filePath}"`)

    const configParts = [`component: ${getSlideComponentExpression(varName, entry)}`]
    configParts.push(`steps: ${varName}.meta?.steps ?? ${Number.isFinite(entry.steps) ? entry.steps : 0}`)
    if (entry.title) configParts.push(`title: ${JSON.stringify(entry.title)}`)
    if (entry.section) configParts.push(`section: ${JSON.stringify(entry.section)}`)
    if (entry.transition) configParts.push(`transition: ${JSON.stringify(entry.transition)}`)

    slideConfigs.push(`  { ${configParts.join(", ")} }`)
  }

  const studioImport = showStudioChrome
    ? `import { StudioOverlay } from "${FRAMEWORK_SOURCE_ROOT}/app/studio/studio-view"\nimport "${FRAMEWORK_SOURCE_ROOT}/app/globals.css"`
    : ""

  const studioElement = showStudioChrome
    ? `createElement(StudioOverlay, { deckName: ${JSON.stringify(deckJson.name || deckSlug)}, deckSlug: ${JSON.stringify(deckSlug)}, slideCount: ${deckJson.slides.length} }),`
    : ""

  // Theme: try to import src/theme.ts
  return `
import { StrictMode, createElement, Fragment } from "react"
import { createRoot } from "react-dom/client"
import { SlideThemeProvider, SlideDeck } from "promptslide"
import "${getGlobalsCssImport(root)}"
${themeImport}
${studioImport}
${slideImports.join("\n")}

${themeLoadBlock}

const slides = [
${slideConfigs.join(",\n")}
]

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null,
    createElement(Fragment, null,
      ${studioElement}
      createElement(SlideThemeProvider, { theme },
        createElement(SlideDeck, {
          slides,
          transition: "${transition}",
          directionalTransition: ${directional}
        })
      )
    )
  )
)
`
}

/**
 * Generate the legacy entry module (App.tsx mode, backward compat).
 */
function getAppEntryModule(root) {
  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
import "${getGlobalsCssImport(root)}"
import App from "${root}/src/App"

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(App))
)
`
}

function getEmptyEntryModule() {
  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"

function EmptyState() {
  return createElement("main", {
    style: {
      height: "100%",
      display: "grid",
      placeItems: "center",
      margin: 0,
      background: "#0a0a0a",
      color: "#e5e5e5",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      padding: "32px"
    }
  }, createElement("div", {
    style: {
      maxWidth: "640px",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      background: "#171717",
      borderRadius: "12px",
      padding: "28px 32px",
      boxShadow: "0 18px 50px rgba(0, 0, 0, 0.5)"
    }
  },
    createElement("h1", { style: { margin: 0, fontSize: "28px", lineHeight: 1.1, color: "#fff" } }, "PromptSlide"),
    createElement("p", { style: { margin: "14px 0 0", color: "#a3a3a3", fontSize: "16px", lineHeight: 1.5 } },
      "No deck is mounted at this root yet. Open a specific deck for preview, or create one through MCP."
    )
  ))
}

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(EmptyState))
)
`
}

function getExportEntryModule(root, slidePath) {
  const deckJson = readDeckJson(root)
  const themeLoadBlock = getThemeLoadBlock(root)
  const themeImport = getThemeCssImport(root, deckJson)
  return `
import { StrictMode, createElement, useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { AnimationProvider, SlideErrorBoundary, SlideThemeProvider } from "promptslide"
import "${getGlobalsCssImport(root)}"
${themeImport}
import * as slideMod from "${root}/${slidePath}"

${themeLoadBlock}

const SlideComponent = slideMod.default || Object.values(slideMod).find(v => typeof v === "function")
const steps = slideMod.meta?.steps ?? 0

function ExportView() {
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])
  return createElement("div", {
    "data-export-ready": ready ? "true" : undefined,
    style: { width: 1280, height: 720, overflow: "hidden", position: "relative", background: "black" }
  },
    createElement(AnimationProvider, { currentStep: steps, totalSteps: steps, showAllAnimations: true },
      createElement(SlideErrorBoundary, { slideIndex: 0 },
        SlideComponent
          ? createElement(SlideComponent, { slideNumber: 1, totalSlides: 1 })
          : null
      )
    )
  )
}

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null,
    createElement(SlideThemeProvider, { theme },
      createElement(ExportView)
    )
  )
)
`
}

function getEmbedEntryModule(root) {
  const deckJson = readDeckJson(root)
  if (!deckJson || !deckJson.slides?.length) {
    // Fallback: empty embed
    return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement("div", { style: { color: "white" } }, "No slides found"))
)
`
  }

  const slideImports = []
  const slideConfigs = []
  const transition = deckJson.transition || "fade"
  const directional = deckJson.directionalTransition ?? true
  const themeLoadBlock = getThemeLoadBlock(root)
  const themeImport = getThemeCssImport(root, deckJson)

  for (let i = 0; i < deckJson.slides.length; i++) {
    const entry = deckJson.slides[i]
    const filePath = resolveSlideEntryFile(root, entry)
    const varName = `_slide${i}`
    slideImports.push(`import * as ${varName} from "${root}/${filePath}"`)

    const configParts = [
      `id: ${JSON.stringify(entry.id)}`,
      `component: ${getSlideComponentExpression(varName, entry)}`,
      `steps: ${varName}.meta?.steps ?? ${Number.isFinite(entry.steps) ? entry.steps : 0}`
    ]
    if (entry.title) configParts.push(`title: ${JSON.stringify(entry.title)}`)
    if (entry.section) configParts.push(`section: ${JSON.stringify(entry.section)}`)
    if (entry.transition) configParts.push(`transition: ${JSON.stringify(entry.transition)}`)
    if (entry.notes) configParts.push(`notes: ${JSON.stringify(entry.notes)}`)

    slideConfigs.push(`  { ${configParts.join(", ")} }`)
  }

  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
import { SlideEmbed, SlideThemeProvider } from "promptslide"
import "${getGlobalsCssImport(root)}"
${themeImport}
${slideImports.join("\n")}

${themeLoadBlock}

const slides = [
${slideConfigs.join(",\n")}
]

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null,
    createElement(SlideThemeProvider, { theme },
      createElement(SlideEmbed, {
        slides,
        transition: "${transition}",
        directionalTransition: ${directional}
      })
    )
  )
)
`
}

export function promptslidePlugin({ root: initialRoot } = {}) {
  let root = initialRoot

  return {
    name: "promptslide",
    enforce: "pre",

    config() {
      return {
        server: {
          watch: {
            ignored: ["**/annotations.json"]
          }
        }
      }
    },

    configResolved(config) {
      if (!root) root = config.root
    },

    // Inject @source directives into CSS files that import Tailwind.
    // This ensures Tailwind scans the framework core components and deck sources.
    transform(code, id) {
      // CSS: inject @source directives for Tailwind scanning
      if (id.endsWith(".css") && code.includes("@import") && code.includes("tailwindcss")) {
        const importRegex = /@import\s+[^;]+;/g
        let lastImportEnd = 0
        let match
        while ((match = importRegex.exec(code)) !== null) {
          lastImportEnd = match.index + match[0].length
        }
        if (lastImportEnd > 0) {
          let sources = `\n@source "${FRAMEWORK_SOURCE_ROOT}";`
          if (root) sources += `\n@source "${root}";`
          return code.slice(0, lastImportEnd) + sources + code.slice(lastImportEnd)
        }
        return
      }

      // JS/TSX: rewrite asset:// URLs to servable paths
      if (code.includes("asset://")) {
        let assetBase = "/assets/"
        if (root && id.startsWith(root + "/")) {
          const relative = id.slice(root.length + 1)
          const firstSlash = relative.indexOf("/")
          if (firstSlash > 0) {
            const possibleSlug = relative.slice(0, firstSlash)
            if (existsSync(join(root, possibleSlug, "deck.json"))) {
              assetBase = `/${possibleSlug}/assets/`
            }
          }
        }
        return code.replaceAll(/asset:\/\/([^"'\s)]+)/g, assetBase + "$1")
      }
    },

    resolveId(id, importer) {
      if (id === VIRTUAL_ENTRY_ID || id.startsWith(`${VIRTUAL_ENTRY_ID}?`)) return "\0" + id
      if (id === VIRTUAL_EXPORT_ID || id.startsWith(`${VIRTUAL_EXPORT_ID}?`)) return "\0" + id
      if (id === VIRTUAL_EMBED_ID || id.startsWith(`${VIRTUAL_EMBED_ID}?`)) return "\0" + id
      if (id.startsWith("@/") && importer) {
        const importerPath = importer.startsWith("\0") ? null : importer.split("?")[0]
        const srcIndex = importerPath ? importerPath.lastIndexOf("/src/") : -1
        if (srcIndex !== -1) {
          const deckRoot = importerPath.slice(0, srcIndex)
          const basePath = join(deckRoot, "src", id.slice(2))
          // If the path already has an extension and exists, return it
          if (existsSync(basePath)) return basePath
          // Try common extensions
          const extensions = [".tsx", ".jsx", ".ts", ".js", ".mjs"]
          for (const ext of extensions) {
            const candidate = basePath + ext
            if (existsSync(candidate)) return candidate
          }
          // Also try index files in case it's a directory
          for (const ext of extensions) {
            const candidate = join(basePath, "index" + ext)
            if (existsSync(candidate)) return candidate
          }
          // Fall back to the base path and let Vite handle the error
          return basePath
        }
      }
    },

    load(id) {
      const { base, params } = getVirtualParams(id)

      if (base === VIRTUAL_ENTRY_ID) {
        // App chrome pages (settings, etc.)
        const page = params.get("page")
        if (page === "settings") {
          return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
import { SettingsView } from "promptslide"
import "${FRAMEWORK_SOURCE_ROOT}/app/globals.css"

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(SettingsView))
)
`
        }

        const deckSlug = params.get("deck")
        const deckRoot = resolveDeckRoot(root, deckSlug)
        if (deckRoot) {
          const deckJson = readDeckJson(deckRoot)
          if (deckJson && deckJson.slides?.length) {
            if (isLegacyHtmlDeck(deckJson)) {
              return getLegacyDeckEntryModule(deckSlug || deckJson.slug || "deck")
            }
            return getDeckJsonEntryModule(deckRoot, deckJson, deckSlug)
          }
          if (hasLegacyApp(deckRoot)) {
            return getAppEntryModule(deckRoot)
          }
        }

        if (deckSlug) {
          return getDeckNotFoundEntryModule(root, deckSlug)
        }

        const deckJson = readDeckJson(root)
        if (deckJson && deckJson.slides?.length) {
          return getDeckJsonEntryModule(root, deckJson)
        }
        if (hasLegacyApp(root)) {
          return getAppEntryModule(root)
        }
        if (listDecks(root).length > 0) {
          return getDeckIndexEntryModule(root)
        }
        return getEmptyEntryModule()
      }
      if (base === VIRTUAL_EXPORT_ID) {
        const deckRoot = resolveDeckRoot(root, params.get("deck")) || root
        return getExportEntryModule(deckRoot, params.get("slidePath") || getDefaultSlidePath(deckRoot))
      }
      if (base === VIRTUAL_EMBED_ID) {
        const deckRoot = resolveDeckRoot(root, params.get("deck")) || root
        return getEmbedEntryModule(deckRoot)
      }
    },

    configureServer(server) {
      // Pre-middleware: receive browser errors and log them to the terminal
      server.middlewares.use((req, res, next) => {
        if (req.method !== "POST" || req.url !== "/__promptslide_error") return next()

        let body = ""
        req.on("data", chunk => { body += chunk })
        req.on("end", () => {
          try {
            const { message, filename } = JSON.parse(body)
            const location = filename ? ` ${dim(`(${filename})`)}` : ""
            server.config.logger.error(`${bold("Browser error:")} ${message}${location}`, { timestamp: true })
          } catch {}
          res.statusCode = 204
          res.end()
        })
      })

      // Pre-middleware: read annotations
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" || req.url !== "/__promptslide_annotations") return next()

        const deckRoot = getDeckRootForRequest(root, req.url, req.headers.referer)
        const filePath = deckRoot ? join(deckRoot, "annotations.json") : null
        try {
          if (filePath && existsSync(filePath)) {
            const content = readFileSync(filePath, "utf-8")
            res.setHeader("Content-Type", "application/json")
            res.statusCode = 200
            res.end(content)
          } else {
            res.setHeader("Content-Type", "application/json")
            res.statusCode = 200
            res.end(JSON.stringify({ version: 1, annotations: [] }))
          }
        } catch {
          res.statusCode = 500
          res.end()
        }
      })

      // Pre-middleware: write annotations
      server.middlewares.use((req, res, next) => {
        if (req.method !== "POST" || req.url !== "/__promptslide_annotations") return next()

        let body = ""
        req.on("data", chunk => { body += chunk })
        req.on("end", () => {
          try {
            const data = JSON.parse(body)
            const deckRoot = getDeckRootForRequest(root, req.url, req.headers.referer)
            if (!deckRoot) {
              res.statusCode = 400
              res.end()
              return
            }
            const filePath = join(deckRoot, "annotations.json")
            writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8")
            res.statusCode = 204
            res.end()
          } catch {
            res.statusCode = 400
            res.end()
          }
        })
      })

      // Pre-middleware: API endpoints for app chrome (decks, auth, registry)
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith("/__promptslide_api/")) return next()

        const url = new URL(req.url, "http://localhost")
        const sendJson = (status, data) => {
          res.setHeader("Content-Type", "application/json")
          res.statusCode = status
          res.end(JSON.stringify(data))
        }
        const readBody = () => new Promise((resolve, reject) => {
          let body = ""
          req.on("data", chunk => { body += chunk })
          req.on("end", () => { try { resolve(JSON.parse(body)) } catch { resolve({}) } })
          req.on("error", reject)
        })

        // --- Decks ---
        if (req.method === "GET" && url.pathname === "/__promptslide_api/decks") {
          return sendJson(200, { decks: listDecks(root) })
        }

        // --- Decks: create new ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/decks/create") {
          const body = await readBody()
          const slug = (body.slug || "new-deck").replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase()
          const deckDir = join(root, slug)
          if (existsSync(deckDir)) return sendJson(409, { error: `Deck "${slug}" already exists` })

          mkdirSync(join(deckDir, "src", "slides"), { recursive: true })
          const deckConfig = {
            name: body.name || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            slug,
            transition: "fade",
            directionalTransition: true,
            slides: [{ id: "title", title: "Title Slide" }]
          }
          writeFileSync(join(deckDir, "deck.json"), JSON.stringify(deckConfig, null, 2) + "\n")
          writeFileSync(join(deckDir, "src", "globals.css"), '@import "tailwindcss";\n')
          writeFileSync(join(deckDir, "src", "slides", "slide-title.tsx"),
            `export default function Title({ slideNumber, totalSlides }) {\n  return (\n    <div className="flex h-full w-full items-center justify-center bg-neutral-950">\n      <h1 className="text-5xl font-bold text-white">${JSON.stringify(deckConfig.name).slice(1, -1)}</h1>\n    </div>\n  )\n}\n`)
          return sendJson(200, { success: true, slug })
        }

        // --- Decks: clone ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/decks/clone") {
          const { cpSync } = await import("node:fs")
          const body = await readBody()
          if (!body.source) return sendJson(400, { error: "Missing source slug" })
          const sourceDir = join(root, body.source)
          if (!existsSync(join(sourceDir, "deck.json"))) return sendJson(404, { error: "Source deck not found" })

          const newSlug = (body.slug || `${body.source}-copy`).replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase()
          const targetDir = join(root, newSlug)
          if (existsSync(targetDir)) return sendJson(409, { error: `Deck "${newSlug}" already exists` })

          cpSync(sourceDir, targetDir, { recursive: true })
          // Update deck.json with new slug/name
          try {
            const manifest = JSON.parse(readFileSync(join(targetDir, "deck.json"), "utf-8"))
            manifest.slug = newSlug
            manifest.name = body.name || manifest.name + " (Copy)"
            writeFileSync(join(targetDir, "deck.json"), JSON.stringify(manifest, null, 2) + "\n")
          } catch {}
          return sendJson(200, { success: true, slug: newSlug })
        }

        // --- Auth: status ---
        if (req.method === "GET" && url.pathname === "/__promptslide_api/auth/status") {
          const { loadAuth } = await import("../utils/auth.mjs")
          const auth = loadAuth()
          return sendJson(200, auth
            ? { authenticated: true, registry: auth.registry, organizationId: auth.organizationId, organizationName: auth.organizationName, organizationSlug: auth.organizationSlug }
            : { authenticated: false })
        }

        // --- Auth: login (request device code) ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/auth/login") {
          const { DEFAULT_REGISTRY } = await import("../utils/auth.mjs")
          try {
            const codeRes = await fetch(`${DEFAULT_REGISTRY}/api/auth/device/code`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client_id: "promptslide-cli", scope: "openid profile email" })
            })
            if (!codeRes.ok) throw new Error(`Registry returned ${codeRes.status}`)
            return sendJson(200, await codeRes.json())
          } catch (err) {
            return sendJson(502, { error: err.message })
          }
        }

        // --- Auth: poll (exchange device code for token) ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/auth/poll") {
          const { DEFAULT_REGISTRY, saveAuth } = await import("../utils/auth.mjs")
          const { fetchOrganizations } = await import("../utils/registry.mjs")
          const body = await readBody()
          try {
            const tokenRes = await fetch(`${DEFAULT_REGISTRY}/api/auth/device/token`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                device_code: body.device_code,
                client_id: "promptslide-cli",
                grant_type: "urn:ietf:params:oauth:grant-type:device_code"
              })
            })
            const data = await tokenRes.json()
            if (data.error === "authorization_pending") return sendJson(200, { status: "pending" })
            if (data.error === "slow_down") return sendJson(200, { status: "pending" })
            if (data.error) return sendJson(200, { status: "error", message: data.error_description || data.error })

            const accessToken = data.access_token || data.token
            // Fetch orgs and auto-select
            let orgId = null, orgName = null, orgSlug = null
            try {
              const orgs = await fetchOrganizations({ registry: DEFAULT_REGISTRY, token: accessToken })
              if (orgs.length > 0) {
                orgId = orgs[0].id
                orgName = orgs[0].name
                orgSlug = orgs[0].slug
              }
            } catch {}

            saveAuth({ registry: DEFAULT_REGISTRY, token: accessToken, organizationId: orgId, organizationName: orgName, organizationSlug: orgSlug })
            return sendJson(200, { status: "authenticated" })
          } catch (err) {
            return sendJson(200, { status: "error", message: err.message })
          }
        }

        // --- Auth: list organizations ---
        if (req.method === "GET" && url.pathname === "/__promptslide_api/auth/organizations") {
          const { loadAuth } = await import("../utils/auth.mjs")
          const { fetchOrganizations } = await import("../utils/registry.mjs")
          const auth = loadAuth()
          if (!auth) return sendJson(401, { error: "Not authenticated" })
          try {
            const orgs = await fetchOrganizations({ registry: auth.registry, token: auth.token })
            return sendJson(200, { organizations: orgs, current: auth.organizationId })
          } catch (err) {
            return sendJson(502, { error: err.message })
          }
        }

        // --- Auth: switch organization ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/auth/switch-org") {
          const { loadAuth, saveAuth } = await import("../utils/auth.mjs")
          const auth = loadAuth()
          if (!auth) return sendJson(401, { error: "Not authenticated" })
          const body = await readBody()
          const orgId = body.organizationId || body.id
          if (!orgId) return sendJson(400, { error: "Missing organizationId" })
          saveAuth({
            registry: auth.registry,
            token: auth.token,
            organizationId: orgId,
            organizationName: body.organizationName || body.name || null,
            organizationSlug: body.organizationSlug || body.slug || null
          })
          return sendJson(200, { success: true })
        }

        // --- Auth: logout ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/auth/logout") {
          const { clearAuth } = await import("../utils/auth.mjs")
          clearAuth()
          return sendJson(200, { success: true })
        }

        // --- Registry: list items (uses /api/r) ---
        if (req.method === "GET" && url.pathname === "/__promptslide_api/registry/items") {
          const { loadAuth } = await import("../utils/auth.mjs")
          const auth = loadAuth()
          if (!auth) return sendJson(401, { error: "Not authenticated" })

          try {
            const params = new URLSearchParams()
            if (url.searchParams.get("search")) params.set("search", url.searchParams.get("search"))
            if (url.searchParams.get("type")) params.set("type", url.searchParams.get("type"))
            const headers = { Authorization: `Bearer ${auth.token}` }
            if (auth.organizationId) headers["X-Organization-Id"] = auth.organizationId

            const itemsRes = await fetch(`${auth.registry}/api/r?${params}`, { headers })
            if (itemsRes.status === 401) return sendJson(401, { error: "Token expired" })
            if (!itemsRes.ok) throw new Error(`Registry returned ${itemsRes.status}`)
            return sendJson(200, await itemsRes.json())
          } catch (err) {
            return sendJson(502, { error: err.message })
          }
        }

        // --- Registry: install item (uses /api/r/{slug} to get full item + files) ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/registry/install") {
          const { loadAuth } = await import("../utils/auth.mjs")
          const { resolveRegistryDependencies, prepareRegistryFile, writePreparedRegistryFile } = await import("../utils/registry.mjs")
          const auth = loadAuth()
          if (!auth) return sendJson(401, { error: "Not authenticated" })

          const body = await readBody()
          try {
            const headers = { Authorization: `Bearer ${auth.token}` }
            if (auth.organizationId) headers["X-Organization-Id"] = auth.organizationId

            // Fetch full item with files via /api/r/{slug}
            const itemRes = await fetch(`${auth.registry}/api/r/${body.slug}`, { headers })
            if (!itemRes.ok) throw new Error(`Failed to fetch item: ${itemRes.status}`)
            const itemData = await itemRes.json()

            // Determine local slug (strip deck prefix if present)
            const itemName = itemData.name || body.slug
            const localSlug = itemName.includes("/") ? itemName.split("/")[0] : itemName
            const deckDir = join(root, localSlug)

            // Create deck directory structure
            mkdirSync(join(deckDir, "src", "slides"), { recursive: true })
            mkdirSync(join(deckDir, "src", "layouts"), { recursive: true })
            mkdirSync(join(deckDir, "src", "components"), { recursive: true })

            // Write deck.json for deck types
            if (itemData.type === "deck" && itemData.meta) {
              const deckConfig = {
                formatVersion: 1,
                name: itemData.title || localSlug,
                slug: localSlug,
                transition: itemData.meta.transition || "fade",
                directionalTransition: itemData.meta.directionalTransition ?? true,
                slides: (itemData.meta.slides || []).map(s => ({
                  id: s.id || s.slug || s.componentName,
                  file: s.file || (s.slug ? `src/slides/${s.slug}.tsx` : null),
                  title: s.title || s.slug,
                  ...(s.componentName ? { exportName: s.componentName, componentName: s.componentName } : {}),
                  ...(typeof s.steps === "number" ? { steps: s.steps } : {}),
                  ...(s.section ? { section: s.section } : {})
                }))
              }
              writeFileSync(join(deckDir, "deck.json"), JSON.stringify(deckConfig, null, 2) + "\n")
            }

            let filesWritten = 0
            const errors = []

            const resolved = await resolveRegistryDependencies(itemData, auth, deckDir)

            // Write source files for the item and all registry dependencies.
            for (const regItem of resolved.items) {
              for (const file of (regItem.files || [])) {
                if (file.content || file.storageUrl) {
                  try {
                    const prepared = await prepareRegistryFile(deckDir, file)
                    writePreparedRegistryFile(prepared)
                    filesWritten++
                  } catch (fileErr) {
                    errors.push(`${file.path || file.target}: ${fileErr.message}`)
                  }
                }
              }
            }

            // Ensure globals.css exists
            const globalsPath = join(deckDir, "src", "globals.css")
            if (!existsSync(globalsPath)) {
              writeFileSync(globalsPath, '@import "tailwindcss";\n')
            }

            return sendJson(200, { success: true, slug: localSlug, filesWritten, errors: errors.length ? errors : undefined })
          } catch (err) {
            return sendJson(500, { error: err.message })
          }
        }

        // --- Sync: status of all decks (read .sync.json per deck) ---
        if (req.method === "GET" && url.pathname === "/__promptslide_api/sync/status") {
          const decks = listDecks(root)
          const result = decks.map(d => {
            const syncFile = join(root, d.slug, ".sync.json")
            let syncData = { status: "unlinked" }
            if (existsSync(syncFile)) {
              try { syncData = JSON.parse(readFileSync(syncFile, "utf-8")) } catch {}
            }
            return { slug: d.slug, ...syncData }
          })
          return sendJson(200, { decks: result })
        }

        // --- Sync: mark a deck as pushed/pulled (persist .sync.json) ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/sync/mark") {
          const body = await readBody()
          if (!body.slug) return sendJson(400, { error: "Missing slug" })
          const syncFile = join(root, body.slug, ".sync.json")
          let syncData = {}
          if (existsSync(syncFile)) {
            try { syncData = JSON.parse(readFileSync(syncFile, "utf-8")) } catch {}
          }
          if (body.action === "pushed") {
            syncData = { ...syncData, status: "synced", remoteSlug: body.slug, lastPushed: new Date().toISOString() }
          } else if (body.action === "pulled") {
            syncData = { ...syncData, status: "synced", remoteSlug: body.slug, lastPulled: new Date().toISOString() }
          }
          writeFileSync(syncFile, JSON.stringify(syncData, null, 2) + "\n")
          return sendJson(200, { success: true })
        }

        // --- Pack: export deck as .promptslide JSON package ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/decks/pack") {
          const body = await readBody()
          if (!body.slug) return sendJson(400, { error: "Missing slug" })

          const deckDir = join(root, body.slug)
          const deckJson = readDeckJson(deckDir)
          if (!deckJson) return sendJson(404, { error: "Deck not found" })

          try {
            const { pack: packFn } = await import("../commands/pack.mjs")
            // Use the same walk logic as the CLI pack command
            const { walkDir } = await import("../commands/pack.mjs")

            // Inline walk since we need the result not CLI output
            const walkDirLocal = (dir, base = "") => {
              const files = []
              if (!existsSync(dir)) return files
              for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const rel = base ? `${base}/${entry.name}` : entry.name
                const full = join(dir, entry.name)
                if (entry.name === "node_modules" || entry.name === ".vite" || entry.name === ".git" || entry.name === "annotations.json") continue
                if (entry.isDirectory()) {
                  files.push(...walkDirLocal(full, rel))
                } else {
                  const stat = statSync(full)
                  if (stat.size > 10 * 1024 * 1024) continue
                  const ext = full.split(".").pop()?.toLowerCase()
                  const binaryExts = ["png","jpg","jpeg","gif","webp","svg","mp4","webm","woff","woff2","ttf","pdf"]
                  if (binaryExts.includes(ext)) {
                    const buffer = readFileSync(full)
                    files.push({ path: rel, content: `data:application/octet-stream;base64,${buffer.toString("base64")}` })
                  } else {
                    files.push({ path: rel, content: readFileSync(full, "utf-8") })
                  }
                }
              }
              return files
            }

            const files = walkDirLocal(deckDir)
            const pkg = {
              format: "promptslide/1.0",
              name: deckJson.name || body.slug,
              slug: body.slug,
              version: 1,
              createdAt: new Date().toISOString(),
              deck: deckJson,
              files
            }
            return sendJson(200, pkg)
          } catch (err) {
            return sendJson(500, { error: err.message })
          }
        }

        // --- PDF export: used by SlideDeck toolbar ---
        if (req.method === "GET" && /^\/api\/export\/[^/]+\.pdf$/.test(url.pathname)) {
          const slug = decodeURIComponent(url.pathname.replace(/^\/api\/export\//, "").replace(/\.pdf$/, ""))
          const deckDir = join(root, slug)
          const deckJson = readDeckJson(deckDir)
          if (!deckJson) return sendJson(404, { error: "Deck not found" })

          try {
            const { exportPdfBuffer } = await import("../mcp/pdf-export.mjs")
            const port = server.config.server.port
            const pdfBuffer = await exportPdfBuffer({ deckSlug: slug, devServerPort: port })
            res.setHeader("Content-Type", "application/pdf")
            res.setHeader("Content-Disposition", `attachment; filename="${slug}.pdf"`)
            res.statusCode = 200
            res.end(pdfBuffer)
            return
          } catch (err) {
            return sendJson(500, { error: err.message })
          }
        }

        // --- Host-native PDF export: save to disk and open locally ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/export-pdf") {
          const body = await readBody()
          const slug = typeof body.slug === "string" ? body.slug : null
          if (!slug) return sendJson(400, { error: "Missing slug" })

          const deckDir = join(root, slug)
          const deckJson = readDeckJson(deckDir)
          if (!deckJson) return sendJson(404, { error: "Deck not found" })

          try {
            const { exportPdf } = await import("../mcp/pdf-export.mjs")
            const port = server.config.server.port
            const pdfPath = await exportPdf({ deckRoot: deckDir, deckSlug: slug, devServerPort: port })

            try {
              const openCmd = platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open"
              exec(`${openCmd} "${pdfPath}"`)
            } catch {}

            return sendJson(200, { success: true, path: pdfPath })
          } catch (err) {
            return sendJson(500, { error: err.message })
          }
        }

        // --- Unpack: import .promptslide package to local ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/decks/unpack") {
          const body = await readBody()
          if (!body.package?.format?.startsWith("promptslide/")) return sendJson(400, { error: "Invalid package format" })

          const slug = body.slug || body.package.slug || "imported-deck"
          const deckDir = join(root, slug)
          if (existsSync(join(deckDir, "deck.json")) && !body.overwrite) {
            return sendJson(409, { error: `Deck "${slug}" already exists` })
          }

          try {
            mkdirSync(deckDir, { recursive: true })
            let filesWritten = 0
            for (const file of (body.package.files || [])) {
              if (!file.path || !file.content) continue
              const targetPath = join(deckDir, file.path)
              mkdirSync(dirname(targetPath), { recursive: true })
              if (file.content.startsWith("data:")) {
                const match = file.content.match(/^data:[^;]+;base64,(.+)$/)
                if (match) {
                  writeFileSync(targetPath, Buffer.from(match[1], "base64"))
                  filesWritten++
                  continue
                }
              }
              writeFileSync(targetPath, file.content, "utf-8")
              filesWritten++
            }
            return sendJson(200, { success: true, slug, filesWritten })
          } catch (err) {
            return sendJson(500, { error: err.message })
          }
        }

        // --- Sync: push local deck to Registry using publish API ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/sync/push") {
          const { loadAuth } = await import("../utils/auth.mjs")
          const auth = loadAuth()
          if (!auth) return sendJson(401, { error: "Not authenticated" })

          const body = await readBody()
          if (!body.slug) return sendJson(400, { error: "Missing slug" })

          const deckDir = join(root, body.slug)
          const deckJson = readDeckJson(deckDir)
          if (!deckJson) return sendJson(404, { error: "Deck not found locally" })

          try {
            const headers = {
              "Content-Type": "application/json",
              Authorization: `Bearer ${auth.token}`
            }
            if (auth.organizationId) headers["X-Organization-Id"] = auth.organizationId

            // Read source files with correct path/target format for Registry
            const files = []
            const scanDir = (dir, base) => {
              if (!existsSync(dir)) return
              for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const rel = base ? `${base}/${entry.name}` : entry.name
                const full = join(dir, entry.name)
                if (entry.isDirectory()) {
                  scanDir(full, rel)
                } else {
                  files.push({
                    path: entry.name,
                    target: `src/${rel}`,
                    content: readFileSync(full, "utf-8")
                  })
                }
              }
            }
            scanDir(join(deckDir, "src"), "")

            // Build slides array with required steps field (defaults to 0)
            const slides = (deckJson.slides || []).map(s => ({
              slug: s.id || s.slug,
              steps: typeof s.steps === "number" ? s.steps : 0,
              ...(s.section ? { section: s.section } : {})
            }))

            const publishBody = {
              type: "deck",
              slug: body.slug,
              title: deckJson.name || body.slug,
              files,
              deckConfig: {
                transition: deckJson.transition || "fade",
                directionalTransition: deckJson.directionalTransition ?? true,
                slides
              }
            }

            const pubRes = await fetch(`${auth.registry}/api/publish`, {
              method: "POST",
              headers,
              body: JSON.stringify(publishBody)
            })
            if (!pubRes.ok) {
              const errData = await pubRes.json().catch(() => ({}))
              throw new Error(errData.details ? JSON.stringify(errData.details) : errData.error || `Publish failed: ${pubRes.status}`)
            }
            const result = await pubRes.json()
            return sendJson(200, { success: true, ...result })
          } catch (err) {
            return sendJson(500, { error: err.message })
          }
        }

        // --- Sync: pull Registry deck to local ---
        if (req.method === "POST" && url.pathname === "/__promptslide_api/sync/pull") {
          const { loadAuth } = await import("../utils/auth.mjs")
          const { resolveRegistryDependencies, prepareRegistryFile, writePreparedRegistryFile } = await import("../utils/registry.mjs")
          const auth = loadAuth()
          if (!auth) return sendJson(401, { error: "Not authenticated" })

          const body = await readBody()
          if (!body.slug) return sendJson(400, { error: "Missing slug" })

          try {
            const headers = { Authorization: `Bearer ${auth.token}` }
            if (auth.organizationId) headers["X-Organization-Id"] = auth.organizationId

            const itemRes = await fetch(`${auth.registry}/api/r/${body.slug}`, { headers })
            if (!itemRes.ok) throw new Error(`Registry returned ${itemRes.status}`)
            const itemData = await itemRes.json()

            const localSlug = (itemData.name || body.slug).split("/")[0]
            const deckDir = join(root, localSlug)
            mkdirSync(join(deckDir, "src", "slides"), { recursive: true })

            if (itemData.type === "deck" && itemData.meta) {
              const deckConfig = {
                name: itemData.title || localSlug,
                slug: localSlug,
                transition: itemData.meta.transition || "fade",
                directionalTransition: itemData.meta.directionalTransition ?? true,
                slides: (itemData.meta.slides || []).map(s => ({
                  id: s.id || s.slug || s.componentName,
                  file: s.file || (s.slug ? `src/slides/${s.slug}.tsx` : null),
                  title: s.title || s.slug,
                  ...(typeof s.steps === "number" ? { steps: s.steps } : {}),
                  ...(s.section ? { section: s.section } : {})
                }))
              }
              writeFileSync(join(deckDir, "deck.json"), JSON.stringify(deckConfig, null, 2) + "\n")
            }

            const resolved = await resolveRegistryDependencies(itemData, auth, deckDir)
            let filesWritten = 0
            for (const regItem of resolved.items) {
              for (const file of (regItem.files || [])) {
                if (file.content || file.storageUrl) {
                  try {
                    const prepared = await prepareRegistryFile(deckDir, file)
                    writePreparedRegistryFile(prepared)
                    filesWritten++
                  } catch {}
                }
              }
            }

            if (!existsSync(join(deckDir, "src", "globals.css"))) {
              writeFileSync(join(deckDir, "src", "globals.css"), '@import "tailwindcss";\n')
            }

            return sendJson(200, { success: true, slug: localSlug, filesWritten })
          } catch (err) {
            return sendJson(500, { error: err.message })
          }
        }

        // --- SSE: file change events ---
        if (req.method === "GET" && url.pathname === "/__promptslide_api/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*"
          })
          res.write("data: {\"type\":\"connected\"}\n\n")

          const handler = (type) => (filePath) => {
            if (!filePath.startsWith(root)) return
            const relative = filePath.slice(root.length + 1)
            const deckSlug = relative.split("/")[0]
            const file = relative.slice(deckSlug.length + 1)
            res.write(`data: ${JSON.stringify({ type, deckSlug, file })}\n\n`)
          }
          const onChange = handler("change")
          const onAdd = handler("add")
          const onUnlink = handler("unlink")

          server.watcher.on("change", onChange)
          server.watcher.on("add", onAdd)
          server.watcher.on("unlink", onUnlink)

          req.on("close", () => {
            server.watcher.removeListener("change", onChange)
            server.watcher.removeListener("add", onAdd)
            server.watcher.removeListener("unlink", onUnlink)
          })
          return
        }

        sendJson(404, { error: "Not found" })
      })

      // Pre-middleware: serve /embed route
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost")
        const parts = url.pathname.split("/").filter(Boolean)
        const isRootEmbed = url.pathname === "/embed" || url.pathname === "/embed/"
        const isDeckEmbed = parts.length === 2 && parts[1] === "embed"
        if (!isRootEmbed && !isDeckEmbed) return next()

        const deckSlug = isDeckEmbed ? decodeURIComponent(parts[0]) : null
        const moduleId = buildVirtualId(VIRTUAL_EMBED_ID, [["deck", deckSlug]])

        // Invalidate cached module so it re-reads deck.json (slides may have changed)
        const mod = server.moduleGraph.getModuleById("\0" + moduleId)
        if (mod) server.moduleGraph.invalidateModule(mod)

        const html = await server.transformIndexHtml(url.pathname, getEmbedHtmlTemplate(moduleId))
        res.setHeader("Content-Type", "text/html")
        res.statusCode = 200
        res.end(html)
      })

      // Pre-middleware: intercept export URLs before Vite's SPA fallback rewrites them
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost")
        if (url.searchParams.get("export") !== "true") return next()

        const deckSlug = getDeckSlugFromPathname(url.pathname)
        const deckRoot = resolveDeckRoot(root, deckSlug) || root
        const moduleId = buildVirtualId(VIRTUAL_EXPORT_ID, [
          ["deck", deckSlug],
          ["slidePath", url.searchParams.get("slidePath") || getDefaultSlidePath(deckRoot)]
        ])
        const mod = server.moduleGraph.getModuleById("\0" + moduleId)
        if (mod) server.moduleGraph.invalidateModule(mod)
        const html = await server.transformIndexHtml(url.pathname, getExportHtmlTemplate(moduleId))
        res.setHeader("Content-Type", "text/html")
        res.statusCode = 200
        res.end(html)
      })

      server.watcher.on("change", (filePath) => {
        if (filePath.startsWith(root) && filePath.endsWith("/deck.json")) {
          server.ws.send({ type: "full-reload" })
        }
      })
      server.watcher.on("add", (filePath) => {
        if (filePath.startsWith(root) && filePath.endsWith("/deck.json")) {
          server.ws.send({ type: "full-reload" })
        }
      })
      server.watcher.on("unlink", (filePath) => {
        if (filePath.startsWith(root) && filePath.endsWith("/deck.json")) {
          server.ws.send({ type: "full-reload" })
        }
      })

      // Post-middleware: serve the regular app after Vite's built-in middleware
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url, "http://localhost")
          const pathname = url.pathname
          const parts = pathname.split("/").filter(Boolean)
          const isRoot = pathname === "/" || pathname === "/index.html"
          const isDeckRoute = parts.length === 1

          // App chrome routes (settings, etc.) — serve as named virtual modules
          if (pathname === "/settings") {
            const moduleId = buildVirtualId(VIRTUAL_ENTRY_ID, [["page", "settings"]])
            const html = await server.transformIndexHtml(pathname, getHtmlTemplate(moduleId))
            res.setHeader("Content-Type", "text/html")
            res.statusCode = 200
            res.end(html)
            return
          }

          if (isRoot || isDeckRoute) {
            const deckSlug = isDeckRoute && !isRoot ? decodeURIComponent(parts[0]) : null
            const moduleId = buildVirtualId(VIRTUAL_ENTRY_ID, [["deck", deckSlug]])
            const html = await server.transformIndexHtml(pathname, getHtmlTemplate(moduleId))
            res.setHeader("Content-Type", "text/html")
            res.statusCode = 200
            res.end(html)
            return
          }
          next()
        })
      }
    }
  }
}

export { VIRTUAL_ENTRY_ID, getHtmlTemplate }
