import { spawn } from "node:child_process"
// Run from the repository root: node packages/cli/test/ui-bundle.mjs
// Isolated production probes; no source slides, registry, or live server writes.
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve, join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync, brotliCompressSync, constants } from "node:zlib"

import { build } from "vite"

import { DEFAULT_LOOP_CONFIG } from "../src/core/loop/config.mjs"
import { readLoopConfig } from "../src/utils/loop-config.mjs"
import { createViteConfig } from "../src/vite/config.mjs"

const cwd = process.cwd()
const here = dirname(fileURLToPath(import.meta.url))
const output = resolve(process.env.UI_BUNDLE_OUT || "/tmp/promptslide-ui-bundles")
const measurements = {}
const budget = {
  compressedViewerGrowthPercent: 15,
  initialGrowthPercent: 15,
  additionalCssGzipBytes: 10240
}
const variants = [
  "baseline",
  "integrated",
  "viewer",
  "deferred",
  "editor-baseline",
  "editor-prototype"
]
const selected = process.argv[2]
if (selected && !variants.includes(selected)) throw new Error("Unknown probe variant")
// Tailwind caches compiled CSS within a process. Fresh processes prevent an
// earlier variant from changing the generated CSS of subsequent builds.
if (!selected) {
  for (const variant of variants) {
    await new Promise((done, reject) => {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), variant], {
        stdio: "inherit",
        env: process.env
      })
      child.on("error", reject)
      child.on("exit", code =>
        code === 0 ? done() : reject(new Error(`${variant} exited ${code}`))
      )
    })
    measurements[variant] = JSON.parse(
      readFileSync(join(output, variant, "measurement.json"), "utf8")
    )
  }
}

for (const variant of selected ? [selected] : []) {
  const entry = join(cwd, ".promptslide-ui-bundle")
  mkdirSync(entry, { recursive: true })
  const probe = variant === "viewer" ? "viewer" : variant === "deferred" ? "deferred" : null
  let imports = probe
    ? `import {${probe === "viewer" ? "ViewerProbe" : "DeferredProbe"} as Probe} from ${JSON.stringify(join(here, "ui-prototype", probe + ".tsx"))}`
    : ""
  let extra = probe ? "createElement(Probe)," : ""
  if (variant.startsWith("editor")) {
    imports += `\nimport {EditorLauncher} from ${JSON.stringify(resolve("packages/cli/src/editor/studio.tsx"))}`
    extra += 'createElement(EditorLauncher, {token: "bundle-probe"} ),'
    if (variant === "editor-prototype") {
      imports += `\nimport {EditorProbe} from ${JSON.stringify(join(here, "ui-prototype/editor.tsx"))}\nimport {ViewerProbe} from ${JSON.stringify(join(here, "ui-prototype/viewer.tsx"))}`
      extra += "createElement(EditorProbe),createElement(ViewerProbe),"
    }
  }
  writeFileSync(
    join(entry, "index.html"),
    '<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>PromptSlide</title></head><body><div id="root"></div><script type="module" src="./main.js"></script></body></html>'
  )
  const app = extra
    ? `createElement(Fragment,null,${extra}createElement(App))`
    : "createElement(App)"
  writeFileSync(
    join(entry, "main.js"),
    `
import { StrictMode, createElement${extra ? ", Fragment" : ""} } from "react"
import { createRoot } from "react-dom/client"
import ${JSON.stringify(join(cwd, "src/globals.css"))}
import App from ${JSON.stringify(join(cwd, "src/App"))}
import { LoopConfigProvider } from "promptslide"
${imports}
const loopConfig = ${JSON.stringify(readLoopConfig(cwd) ?? DEFAULT_LOOP_CONFIG)}

createRoot(document.getElementById("root")).render(
  createElement(StrictMode, null, createElement(LoopConfigProvider, { config: loopConfig }, ${app}))
)
`
  )
  try {
    const config = createViteConfig({ cwd, mode: "production" })
    if (variant === "integrated")
      config.plugins.push({
        name: "ui-cost-probe-replacements",
        enforce: "pre",
        transform(code, id) {
          for (const file of ["toolbar-action", "view-menu"]) {
            if (id === resolve(`packages/cli/src/core/${file}.tsx`))
              return `export * from ${JSON.stringify(join(here, "ui-prototype", file + ".tsx"))}`
          }
          if (id === resolve("packages/cli/src/core/loop/loop-settings.tsx")) {
            // Replace only the loop checkbox; retain all application behavior.
            const start = code.indexOf(
              '<input\n                  aria-label="Include current slide in loop"'
            )
            if (start < 0) throw new Error("Loop checkbox probe no longer matches baseline")
            const end = code.indexOf("/>", start) + 2
            code =
              code.slice(0, start) +
              code.slice(start, end).replace("<input", "<LoopCheckbox") +
              code.slice(end)
            return (
              `import {LoopCheckbox} from ${JSON.stringify(join(here, "ui-prototype/checkbox.tsx"))};\n` +
              code
            )
          }
        }
      })
    const built = await build({
      ...config,
      logLevel: "warn",
      root: entry,
      publicDir: resolve("public"),
      build: { outDir: join(output, variant), emptyOutDir: true, manifest: true }
    })
    const assets = []
    const modules = []
    for (const item of built.output) {
      if (!/\.(js|css)$/.test(item.fileName)) continue
      const data = Buffer.from(item.type === "chunk" ? item.code : item.source)
      assets.push({
        file: item.fileName,
        type: item.fileName.endsWith(".js") ? "js" : "css",
        raw: data.length,
        gzip: gzipSync(data, { level: 9 }).length,
        brotli: brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
          .length
      })
      if (item.type === "chunk") modules.push(...Object.keys(item.modules))
    }
    const manifest = JSON.parse(readFileSync(join(output, variant, ".vite/manifest.json"), "utf8"))
    const initialFiles = new Set()
    const visit = key => {
      const asset = manifest[key]
      if (!asset || initialFiles.has(asset.file)) return
      initialFiles.add(asset.file)
      for (const css of asset.css || []) initialFiles.add(css)
      for (const imported of asset.imports || []) visit(imported)
    }
    for (const [key, value] of Object.entries(manifest)) if (value.isEntry) visit(key)
    const sum = list =>
      Object.fromEntries(
        ["js", "css"].map(type => [
          type,
          Object.fromEntries(
            ["raw", "gzip", "brotli"].map(metric => [
              metric,
              list.filter(a => a.type === type).reduce((n, a) => n + a[metric], 0)
            ])
          )
        ])
      )
    measurements[variant] = {
      total: sum(assets),
      initial: sum(assets.filter(a => initialFiles.has(a.file))),
      assets,
      editorModules: modules
        .filter(m => m.includes("/src/editor/"))
        .map(m => m.replace(cwd + "/", "")),
      baseModules: modules.filter(m => m.includes("/@base-ui/")).length
    }
    writeFileSync(
      join(output, variant, "measurement.json"),
      JSON.stringify(measurements[variant], null, 2) + "\n"
    )
    console.log(
      variant,
      JSON.stringify(measurements[variant].total),
      "initial",
      JSON.stringify(measurements[variant].initial)
    )
  } finally {
    rmSync(entry, { recursive: true, force: true })
  }
}
if (selected) process.exit(0)
const comparisons = {}
for (const [variant, base] of [
  ["integrated", "baseline"],
  ["viewer", "baseline"],
  ["deferred", "baseline"],
  ["editor-prototype", "editor-baseline"]
]) {
  comparisons[variant] = {}
  for (const scope of ["total", "initial"])
    comparisons[variant][scope] = Object.fromEntries(
      ["js", "css"].map(type => [
        type,
        Object.fromEntries(
          ["raw", "gzip", "brotli"].map(metric => {
            const delta =
              measurements[variant][scope][type][metric] - measurements[base][scope][type][metric]
            return [
              metric,
              {
                bytes: delta,
                percent: +((delta / measurements[base][scope][type][metric]) * 100).toFixed(2)
              }
            ]
          })
        )
      ])
    )
}
const report = {
  budget,
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    baseUi: JSON.parse(
      readFileSync(createRequire(import.meta.url).resolve("@base-ui/react/package.json"), "utf8")
    ).version
  },
  methodology:
    "Vite production defaults; identical deck and loop config; gzip level 9; Brotli quality 11; initial graph from manifest static imports; totals sum independently compressed assets; editor probes are synthetic, never shipped",
  measurements,
  comparisons
}
writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n")
mkdirSync(resolve("docs/bundle-measurements"), { recursive: true })
writeFileSync(
  resolve("docs/bundle-measurements/prototype.json"),
  JSON.stringify(report, null, 2) + "\n"
)
console.log("Report:", join(output, "report.json"))
