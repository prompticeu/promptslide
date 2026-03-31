import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { bold, dim } from "../utils/ansi.mjs"

const VIRTUAL_ENTRY_ID = "virtual:promptslide-entry"
const RESOLVED_VIRTUAL_ENTRY_ID = "\0" + VIRTUAL_ENTRY_ID
const VIRTUAL_EXPORT_ID = "virtual:promptslide-export"
const RESOLVED_VIRTUAL_EXPORT_ID = "\0" + VIRTUAL_EXPORT_ID
const VIRTUAL_EMBED_ID = "virtual:promptslide-embed"
const RESOLVED_VIRTUAL_EMBED_ID = "\0" + VIRTUAL_EMBED_ID

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

function getHtmlTemplate() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PromptSlide</title>
  </head>
  <body>
    <div id="root"></div>
    ${ERROR_FORWARD_SCRIPT}
    <script type="module" src="/@id/${VIRTUAL_ENTRY_ID}"></script>
  </body>
</html>`
}

function getExportHtmlTemplate() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PromptSlide Export</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/@id/${VIRTUAL_EXPORT_ID}"></script>
  </body>
</html>`
}

function getEntryModule(root) {
  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
import "${root}/src/globals.css"
import App from "${root}/src/App"

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(App))
)
`
}

function getExportEntryModule(root, slidePath) {
  return `
import { StrictMode, createElement, useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { AnimationProvider, SlideErrorBoundary, SlideThemeProvider } from "promptslide"
import "${root}/src/globals.css"
import * as slideMod from "${root}/${slidePath}"

let theme = {}
try {
  const themeMod = await import("${root}/src/theme")
  theme = themeMod.theme || themeMod.default || {}
} catch {}

const SlideComponent = slideMod.default || Object.values(slideMod).find(v => typeof v === "function")

function ExportView() {
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])
  return createElement("div", {
    "data-export-ready": ready ? "true" : undefined,
    style: { width: 1280, height: 720, overflow: "hidden", position: "relative", background: "black" }
  },
    createElement(AnimationProvider, { currentStep: 0, totalSteps: 0, showAllAnimations: true },
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

function getEmbedHtmlTemplate() {
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
    <script type="module" src="/@id/${VIRTUAL_EMBED_ID}"></script>
  </body>
</html>`
}

function getEmbedEntryModule(root) {
  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
import { SlideEmbed, SlideThemeProvider } from "promptslide"
import "${root}/src/globals.css"
import { slides } from "${root}/src/deck-config"

let theme = {}
try {
  const themeMod = await import("${root}/src/theme")
  theme = themeMod.theme || themeMod.default || {}
} catch {}

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null,
    createElement(SlideThemeProvider, { theme },
      createElement(SlideEmbed, { slides })
    )
  )
)
`
}

export function promptslidePlugin({ root: initialRoot } = {}) {
  let root = initialRoot
  let exportSlidePath = null

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

    resolveId(id) {
      if (id === VIRTUAL_ENTRY_ID) return RESOLVED_VIRTUAL_ENTRY_ID
      if (id === VIRTUAL_EXPORT_ID) return RESOLVED_VIRTUAL_EXPORT_ID
      if (id === VIRTUAL_EMBED_ID) return RESOLVED_VIRTUAL_EMBED_ID
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ENTRY_ID) return getEntryModule(root)
      if (id === RESOLVED_VIRTUAL_EXPORT_ID) return getExportEntryModule(root, exportSlidePath || "src/slides/slide-title.tsx")
      if (id === RESOLVED_VIRTUAL_EMBED_ID) return getEmbedEntryModule(root)
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

        const filePath = join(root, "annotations.json")
        try {
          if (existsSync(filePath)) {
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
            const filePath = join(root, "annotations.json")
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
        if (url.pathname !== "/embed" && url.pathname !== "/embed/") return next()

        const html = await server.transformIndexHtml("/embed", getEmbedHtmlTemplate())
        res.setHeader("Content-Type", "text/html")
        res.statusCode = 200
        res.end(html)
      })

      // Pre-middleware: intercept export URLs before Vite's SPA fallback rewrites them
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost")
        if (url.searchParams.get("export") !== "true") return next()

        exportSlidePath = url.searchParams.get("slidePath") || "src/slides/slide-title.tsx"
        // Invalidate cached export module so it regenerates with the new slidePath
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_EXPORT_ID)
        if (mod) server.moduleGraph.invalidateModule(mod)
        const html = await server.transformIndexHtml("/index.html", getExportHtmlTemplate())
        res.setHeader("Content-Type", "text/html")
        res.statusCode = 200
        res.end(html)
      })

      // Post-middleware: serve the regular app after Vite's built-in middleware
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === "/" || req.url === "/index.html") {
            const html = await server.transformIndexHtml(req.url, getHtmlTemplate())
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

// Re-export HTML mode detection for use by other modules
export { isHtmlDeck } from "../html/vite-plugin.mjs"
