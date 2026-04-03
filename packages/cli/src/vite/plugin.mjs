import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { bold, dim } from "../utils/ansi.mjs"

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
    <style>html, body, #root { margin: 0; padding: 0; height: 100%; overflow: hidden; } body { background: #0a0a0a; }</style>
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

/**
 * Read and parse deck.json if it exists.
 * Returns null if not found.
 */
function readDeckJson(root) {
  const deckJsonPath = join(root, "deck.json")
  if (!existsSync(deckJsonPath)) return null
  try {
    return JSON.parse(readFileSync(deckJsonPath, "utf-8"))
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
      return {
        slug: entry.name,
        name: manifest?.name || entry.name,
        slides: manifest?.slides?.length || 0,
        transition: manifest?.transition || "fade",
        theme: manifest?.theme || null
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
  const candidates = [
    `src/slides/${id}.tsx`,
    `src/slides/${id}.jsx`,
    `src/slides/slide-${id}.tsx`,
    `src/slides/slide-${id}.jsx`
  ]
  for (const candidate of candidates) {
    if (existsSync(join(root, candidate))) return candidate
  }
  // Default to .tsx even if it doesn't exist yet (agent may be about to create it)
  return `src/slides/slide-${id}.tsx`
}

function getDefaultSlidePath(root) {
  const deckJson = readDeckJson(root)
  const firstId = deckJson?.slides?.[0]?.id
  if (firstId) {
    return resolveSlideFile(root, firstId)
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
  const decks = listDecks(root)
  const cards = decks.map(deck => ({
    ...deck,
    href: `/${deck.slug}`
  }))

  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"

const decks = ${JSON.stringify(cards)}

function DeckIndex() {
  return createElement("main", {
    style: {
      minHeight: "100vh",
      margin: 0,
      background: "#111315",
      color: "#f5f5f5",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      padding: "40px"
    }
  },
    createElement("div", { style: { maxWidth: "1120px", margin: "0 auto" } },
      createElement("div", {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: "24px",
          marginBottom: "28px"
        }
      },
        createElement("div", null,
          createElement("div", {
            style: {
              color: "#8a8f98",
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              fontSize: "12px",
              marginBottom: "10px"
            }
          }, "Workspace"),
          createElement("h1", { style: { margin: 0, fontSize: "42px", lineHeight: 1.05 } }, "PromptSlide")
        ),
        createElement("div", {
          style: {
            color: "#9ca3af",
            fontSize: "14px",
            paddingBottom: "6px"
          }
        }, decks.length === 1 ? "1 deck" : decks.length + " decks")
      ),
      createElement("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "18px"
        }
      },
        ...decks.map(deck => createElement("a", {
          key: deck.slug,
          href: deck.href,
          style: {
            textDecoration: "none",
            color: "inherit",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "#17191d",
            borderRadius: "18px",
            padding: "20px",
            minHeight: "180px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)"
          }
        },
          createElement("div", null,
            createElement("div", {
              style: {
                color: "#8a8f98",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                fontSize: "11px",
                marginBottom: "12px"
              }
            }, deck.slug),
            createElement("h2", { style: { margin: 0, fontSize: "24px", lineHeight: 1.15 } }, deck.name),
            createElement("p", { style: { margin: "10px 0 0", color: "#b5bcc7", fontSize: "14px", lineHeight: 1.45 } },
              deck.slides + " slides",
              deck.theme ? " · theme " + deck.theme : "",
              deck.transition ? " · " + deck.transition : ""
            )
          ),
          createElement("div", {
            style: {
              color: "#d4d4d8",
              fontSize: "13px",
              marginTop: "20px"
            }
          }, "Open deck →")
        ))
      )
    )
  )
}

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(DeckIndex))
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

function getLegacyDeckEntryModule(deckSlug) {
  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"

function LegacyDeckNotice() {
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
    }, "Migration needed"),
    createElement("h1", { style: { margin: 0, fontSize: "32px", lineHeight: 1.1 } }, ${JSON.stringify(deckSlug)}),
    createElement("p", { style: { margin: "12px 0 0", color: "#b5bcc7", fontSize: "15px", lineHeight: 1.5 } },
      "This deck still uses the legacy HTML format. It needs to be migrated to the TSX deck runtime before it can render in the shared app host."
    )
  ))
}

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(LegacyDeckNotice))
)
`
}

/**
 * Generate the entry module from deck.json.
 * Framework-owned: imports slides, creates SlideDeck with SlideThemeProvider.
 */
function getDeckJsonEntryModule(root, deckJson) {
  const slideImports = []
  const slideConfigs = []
  const transition = deckJson.transition || "fade"
  const directional = deckJson.directionalTransition ?? true
  const themeImport = getThemeCssImport(root, deckJson)
  const themeLoadBlock = getThemeLoadBlock(root)

  for (let i = 0; i < deckJson.slides.length; i++) {
    const entry = deckJson.slides[i]
    const filePath = resolveSlideFile(root, entry.id)
    const varName = `_slide${i}`
    slideImports.push(`import * as ${varName} from "${root}/${filePath}"`)

    const configParts = [`component: ${varName}.default`]
    configParts.push(`steps: ${varName}.meta?.steps ?? 0`)
    if (entry.title) configParts.push(`title: ${JSON.stringify(entry.title)}`)
    if (entry.section) configParts.push(`section: ${JSON.stringify(entry.section)}`)
    if (entry.transition) configParts.push(`transition: ${JSON.stringify(entry.transition)}`)

    slideConfigs.push(`  { ${configParts.join(", ")} }`)
  }

  // Theme: try to import src/theme.ts
  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
import { SlideThemeProvider, SlideDeck } from "promptslide"
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
      createElement(SlideDeck, {
        slides,
        transition: "${transition}",
        directionalTransition: ${directional}
      })
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
    const filePath = resolveSlideFile(root, entry.id)
    const varName = `_slide${i}`
    slideImports.push(`import * as ${varName} from "${root}/${filePath}"`)

    const configParts = [
      `id: ${JSON.stringify(entry.id)}`,
      `component: ${varName}.default`,
      `steps: ${varName}.meta?.steps ?? 0`
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
      if (!id.endsWith(".css") || !code.includes("@import") || !code.includes("tailwindcss")) return
      const importRegex = /@import\s+[^;]+;/g
      let lastImportEnd = 0
      let match
      while ((match = importRegex.exec(code)) !== null) {
        lastImportEnd = match.index + match[0].length
      }
      if (lastImportEnd > 0) {
        let sources = `\n@source "${FRAMEWORK_SOURCE_ROOT}";`
        // Also scan deck source files so Tailwind generates CSS for slide utility classes
        if (root) sources += `\n@source "${root}";`
        return code.slice(0, lastImportEnd) + sources + code.slice(lastImportEnd)
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
          // Resolve extension — @/layouts/master → src/layouts/master.tsx
          const extensions = [".tsx", ".ts", ".jsx", ".js"]
          for (const ext of extensions) {
            if (existsSync(basePath + ext)) return basePath + ext
          }
          // Try as directory with index file
          for (const ext of extensions) {
            if (existsSync(join(basePath, `index${ext}`))) return join(basePath, `index${ext}`)
          }
          // Return as-is and let Vite report the error
          return basePath
        }
      }
    },

    load(id) {
      const { base, params } = getVirtualParams(id)

      if (base === VIRTUAL_ENTRY_ID) {
        const deckSlug = params.get("deck")
        const deckRoot = resolveDeckRoot(root, deckSlug)
        if (deckRoot) {
          const deckJson = readDeckJson(deckRoot)
          if (deckJson && deckJson.slides?.length) {
            if (isLegacyHtmlDeck(deckJson)) {
              return getLegacyDeckEntryModule(deckSlug || deckJson.slug || "deck")
            }
            return getDeckJsonEntryModule(deckRoot, deckJson)
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
          if (isLegacyHtmlDeck(deckJson)) {
            return getLegacyDeckEntryModule(deckJson.slug || "deck")
          }
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
