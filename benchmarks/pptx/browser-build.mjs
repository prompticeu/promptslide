// Verify the public SDK entry as a consumer bundles it; no browser or service required.
import assert from "node:assert/strict"
import { mkdtemp, mkdir, symlink, writeFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { resolve, join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const require = createRequire(join(root, "packages/cli/package.json"))
const { build } = require("vite")
const temporary = await mkdtemp("/tmp/promptslide-browser-build-")
try {
  await mkdir(join(temporary, "node_modules"))
  await symlink(join(root, "packages/cli"), join(temporary, "node_modules/promptslide"), "dir")
  const entry = join(temporary, "index.mjs")
  await writeFile(
    entry,
    'export {exportBrowserPptx} from "promptslide/browser"; export {prepareBrowserPdf} from "promptslide/pdf-browser"'
  )
  const result = await build({
    root: temporary,
    configFile: false,
    logLevel: "error",
    build: { target: "es2020", write: false, lib: { entry, formats: ["es"] } }
  })
  const bundles = (Array.isArray(result) ? result : [result])
    .flatMap(value => value.output)
    .filter(value => value.type === "chunk")
  assert.ok(bundles.some(value => value.exports.includes("exportBrowserPptx")))
  assert.ok(bundles.some(value => value.exports.includes("prepareBrowserPdf")))
  const emitted = new Set(bundles.map(bundle => bundle.fileName))
  for (const bundle of bundles)
    assert.ok(
      bundle.imports
        .concat(bundle.dynamicImports)
        .every(path => emitted.has(path.replace(/^\.\//, ""))),
      "Browser bundle must have no Node or external runtime dependencies"
    )
  console.log("Public browser entry bundles successfully with Vite; no Node runtime dependencies")
} finally {
  await rm(temporary, { recursive: true, force: true })
}
