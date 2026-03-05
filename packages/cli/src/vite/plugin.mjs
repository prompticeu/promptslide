const VIRTUAL_ENTRY_ID = "virtual:promptslide-entry"
const RESOLVED_VIRTUAL_ENTRY_ID = "\0" + VIRTUAL_ENTRY_ID
const VIRTUAL_EXPORT_ID = "virtual:promptslide-export"
const RESOLVED_VIRTUAL_EXPORT_ID = "\0" + VIRTUAL_EXPORT_ID

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

export function promptslidePlugin({ root: initialRoot } = {}) {
  let root = initialRoot
  let exportSlidePath = null

  return {
    name: "promptslide",
    enforce: "pre",

    configResolved(config) {
      if (!root) root = config.root
    },

    resolveId(id) {
      if (id === VIRTUAL_ENTRY_ID) return RESOLVED_VIRTUAL_ENTRY_ID
      if (id === VIRTUAL_EXPORT_ID) return RESOLVED_VIRTUAL_EXPORT_ID
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ENTRY_ID) return getEntryModule(root)
      if (id === RESOLVED_VIRTUAL_EXPORT_ID) return getExportEntryModule(root, exportSlidePath || "src/slides/slide-title.tsx")
    },

    configureServer(server) {
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
