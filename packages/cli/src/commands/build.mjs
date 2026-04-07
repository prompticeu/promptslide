import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { resolve, join } from "node:path"

import { build as viteBuild } from "vite"

import { bold, green, dim } from "../utils/ansi.mjs"
import { ensureTsConfig } from "../utils/tsconfig.mjs"
import { createViteConfig } from "../vite/config.mjs"

function getBuildHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PromptSlide</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.js"></script>
  </body>
</html>`
}

function toImportPath(p) {
  return p.split("\\").join("/")
}

function getBuildEntry(cwd) {
  // Use absolute paths since build root is .promptslide/ temp dir
  // Normalize to forward slashes so imports work on Windows
  const globals = toImportPath(join(cwd, "src", "globals.css"))
  const app = toImportPath(join(cwd, "src", "App"))
  return `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
import "${globals}"
import App from "${app}"

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(App))
)
`
}

export async function build(args) {
  const cwd = process.cwd()

  ensureTsConfig(cwd)

  console.log()
  console.log(`  ${bold("promptslide")} ${dim("build")}`)
  console.log()

  // Write temporary entry files for Vite build input
  const tempDir = join(cwd, ".promptslide")
  mkdirSync(tempDir, { recursive: true })
  writeFileSync(join(tempDir, "index.html"), getBuildHtml())
  writeFileSync(join(tempDir, "main.js"), getBuildEntry(cwd))

  try {
    const config = createViteConfig({ cwd, mode: "production" })
    await viteBuild({
      ...config,
      root: tempDir,
      publicDir: resolve(cwd, "public"),
      build: {
        outDir: resolve(cwd, "dist"),
        emptyOutDir: true
      }
    })
    console.log()
    console.log(`  ${green("✓")} Built to ${dim("dist/")}`)
    console.log()
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}
