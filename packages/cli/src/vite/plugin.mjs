const VIRTUAL_ENTRY_ID = "virtual:promptslide-entry"
const RESOLVED_VIRTUAL_ENTRY_ID = "\0" + VIRTUAL_ENTRY_ID

function getHtmlTemplate() {
  return `<!doctype html>
<html lang="en" class="dark">
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

function getEntryModule() {
  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
import "./src/globals.css"
import App from "./src/App"

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(App))
)
`
}

export function promptslidePlugin() {
  return {
    name: "promptslide",
    enforce: "pre",

    resolveId(id) {
      if (id === VIRTUAL_ENTRY_ID) {
        return RESOLVED_VIRTUAL_ENTRY_ID
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ENTRY_ID) {
        return getEntryModule()
      }
    },

    configureServer(server) {
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
