import { spawn, execFileSync } from "node:child_process"
// Fresh-process production comparison against the preserved feature baseline.
// Run from repo root: node packages/cli/test/application-bundle.mjs
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  mkdtempSync,
  symlinkSync,
  realpathSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { gzipSync, brotliCompressSync, constants } from "node:zlib"

import { build } from "vite"

const repo = process.cwd(),
  script = fileURLToPath(import.meta.url)
const out = resolve(process.env.UI_MIGRATION_OUT || "/tmp/promptslide-application-bundles")
const variant = process.argv[2]
async function run(args, env = {}) {
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repo,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production", ...env }
    })
    child.once("error", reject)
    child.once("exit", code => (code === 0 ? done() : reject(new Error(`Build exited ${code}`))))
  })
}
if (!variant) {
  const baseline = mkdtempSync(join(tmpdir(), "promptslide-ui-baseline-"))
  try {
    const archive = join(baseline, "snapshot.tar")
    execFileSync("git", ["archive", "--format=tar", "-o", archive, "6dc2f38"], { cwd: repo })
    execFileSync("tar", ["-xf", archive, "-C", baseline])
    rmSync(archive)
    symlinkSync(join(repo, "node_modules"), join(baseline, "node_modules"), "dir")
    symlinkSync(
      join(repo, "packages/cli/node_modules"),
      join(baseline, "packages/cli/node_modules"),
      "dir"
    )
    await run([script, "baseline"], { PS_MEASURE_DECK: baseline })
    await run([script, "migration"], { PS_MEASURE_DECK: repo })
  } finally {
    rmSync(baseline, { recursive: true, force: true })
  }
  const measurements = Object.fromEntries(
    ["baseline", "migration"].map(name => [
      name,
      JSON.parse(readFileSync(join(out, name, "measurement.json"), "utf8"))
    ])
  )
  const delta = {}
  for (const scope of ["initial", "total"])
    delta[scope] = Object.fromEntries(
      ["js", "css"].map(type => [
        type,
        Object.fromEntries(
          ["raw", "gzip", "brotli"].map(metric => {
            const before = measurements.baseline[scope][type][metric],
              after = measurements.migration[scope][type][metric]
            return [
              metric,
              { bytes: after - before, percent: +(((after - before) / before) * 100).toFixed(2) }
            ]
          })
        )
      ])
    )
  const report = {
    baselineCommit: "6dc2f38",
    method:
      "Fresh Node processes, NODE_ENV=production, same deck and CLI entry, Vite defaults plus manifest; gzip level 9 / Brotli quality 11; sum independently compressed files; initial graph excludes dynamic imports. Application shadow-root CSS is transported in JS and included in JS totals.",
    measurements,
    delta
  }
  mkdirSync(resolve("docs/bundle-measurements"), { recursive: true })
  writeFileSync(
    resolve("docs/bundle-measurements/migration.json"),
    JSON.stringify(report, null, 2) + "\n"
  )
  console.log(
    JSON.stringify(
      { initial: measurements.migration.initial, total: measurements.migration.total, delta },
      null,
      2
    )
  )
} else {
  if (!["baseline", "migration"].includes(variant)) throw new Error("Unknown variant")
  const cwd = process.env.PS_MEASURE_DECK && realpathSync(process.env.PS_MEASURE_DECK)
  if (!cwd) throw new Error("Use the parent runner to select the correct baseline")
  process.chdir(cwd)
  const { createViteConfig } = await import(
    pathToFileURL(join(cwd, "packages/cli/src/vite/config.mjs"))
  )
  const { readLoopConfig } = await import(
    pathToFileURL(join(cwd, "packages/cli/src/utils/loop-config.mjs"))
  )
  const { DEFAULT_LOOP_CONFIG } = await import(
    pathToFileURL(join(cwd, "packages/cli/src/core/loop/config.mjs"))
  )
  const entry = join(cwd, ".promptslide-ui-measure")
  mkdirSync(entry, { recursive: true })
  writeFileSync(
    join(entry, "index.html"),
    '<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>PromptSlide</title></head><body><div id="root"></div><script type="module" src="./main.js"></script></body></html>'
  )
  writeFileSync(
    join(entry, "main.js"),
    `
import { StrictMode, createElement } from "react"
import { createRoot } from "react-dom/client"
import ${JSON.stringify(join(cwd, "src/globals.css"))}
import App from ${JSON.stringify(join(cwd, "src/App"))}
import { LoopConfigProvider } from "promptslide"
const loopConfig = ${JSON.stringify(readLoopConfig(cwd) ?? DEFAULT_LOOP_CONFIG)}
createRoot(document.getElementById("root")).render(
 createElement(StrictMode, null, createElement(LoopConfigProvider, { config: loopConfig }, createElement(App)))
)
`
  )
  try {
    const built = await build({
      ...createViteConfig({ cwd, mode: "production" }),
      logLevel: "warn",
      root: entry,
      publicDir: join(cwd, "public"),
      build: { outDir: join(out, variant), emptyOutDir: true, manifest: true }
    })
    const assets = [],
      modules = []
    for (const item of built.output) {
      if (item.type === "chunk") modules.push(...Object.keys(item.modules))
      if (!/\.(js|css)$/.test(item.fileName)) continue
      const bytes = Buffer.from(item.type === "chunk" ? item.code : item.source)
      assets.push({
        file: item.fileName,
        type: item.fileName.endsWith(".js") ? "js" : "css",
        raw: bytes.length,
        gzip: gzipSync(bytes, { level: 9 }).length,
        brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
          .length
      })
    }
    const manifest = JSON.parse(readFileSync(join(out, variant, ".vite/manifest.json"), "utf8")),
      initial = new Set()
    const visit = key => {
      const item = manifest[key]
      if (!item || initial.has(item.file)) return
      initial.add(item.file)
      for (const css of item.css ?? []) initial.add(css)
      for (const dependency of item.imports ?? []) visit(dependency)
    }
    for (const [key, value] of Object.entries(manifest)) if (value.isEntry) visit(key)
    const sum = list =>
      Object.fromEntries(
        ["js", "css"].map(type => [
          type,
          Object.fromEntries(
            ["raw", "gzip", "brotli"].map(metric => [
              metric,
              list.filter(item => item.type === type).reduce((n, item) => n + item[metric], 0)
            ])
          )
        ])
      )
    const editorModules = modules.filter(id => id.includes("/src/editor/"))
    if (editorModules.length) throw new Error("Production build included development editor code")
    const report = {
      total: sum(assets),
      initial: sum(assets.filter(item => initial.has(item.file))),
      assets,
      editorModules,
      modules: modules.length,
      baseUiModules: modules.filter(id => id.includes("/@base-ui/")).length
    }
    writeFileSync(join(out, variant, "measurement.json"), JSON.stringify(report, null, 2) + "\n")
    console.log(variant, JSON.stringify(report.total), "initial", JSON.stringify(report.initial))
  } finally {
    rmSync(entry, { recursive: true, force: true })
  }
}
