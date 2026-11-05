import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const bytes = async name =>
  JSON.stringify((await readFile(require.resolve(name))).toString("base64"))
export function browserEngines() {
  return {
    name: "promptslide-browser-font-engines",
    setup(build) {
      build.onResolve({ filter: /^(?:node:)?(?:module|fs|path|url|crypto)$/ }, args => {
        if (args.path === "path") return { path: require.resolve("path-browserify") }
        return { path: args.path, namespace: "browser-node-unavailable" }
      })
      build.onLoad({ filter: /.*/, namespace: "browser-node-unavailable" }, () => ({
        contents:
          'export const createRequire=()=>{throw new Error("Node runtime unavailable in browser")};export default {};',
        loader: "js"
      }))
      build.onLoad({ filter: /pptxgenjs[\\/]dist[\\/]pptxgen\.es\.js$/ }, async args => {
        const source = await readFile(args.path, "utf8")
        const branches = source.match(/const isNode = [^;]+;/g)
        if (branches?.length !== 2)
          throw new Error("Unexpected PptxGenJS environment detection; review browser adapter")
        return {
          contents: source
            .replace(/const isNode = [^;]+;/g, "const isNode = false;")
            .replace(
              /import\((['"])(?:node:)?(?:fs|https)\1\)/g,
              'Promise.reject(new Error("Node runtime unavailable in browser"))'
            ),
          loader: "js"
        }
      })
      build.onLoad({ filter: /harfbuzzjs[\\/]dist[\\/]harfbuzz\.js$/ }, async args => {
        const source = await readFile(args.path, "utf8")
        const marker = 'new URL("harfbuzz.wasm",import.meta.url).href'
        if (!source.includes(marker))
          throw new Error("Unexpected HarfBuzz WASM locator; review browser adapter")
        return {
          contents: source.replace(marker, '"embedded:harfbuzz.wasm"'),
          loader: "js"
        }
      })
      build.onLoad({ filter: /wawoff2[\\/]build[\\/]decompress_binding\.js$/ }, async args => {
        const source = await readFile(args.path, "utf8")
        if (!source.includes('module["exports"]=Module'))
          throw new Error("Unexpected WOFF2 loader; review browser adapter")
        // Upstream exports its instance only inside the Node branch. The browser
        // wrapper must receive that same instance to observe runtime readiness.
        return { contents: source + "\nmodule.exports=Module;", loader: "js" }
      })
      build.onLoad({ filter: /harfbuzzjs[\\/]dist[\\/]index\.mjs$/ }, async args => {
        const source = await readFile(args.path, "utf8")
        const marker = "init(await createHarfBuzz());"
        if (!source.includes(marker))
          throw new Error("Unexpected HarfBuzz loader; review browser adapter")
        return {
          contents: source.replace(
            marker,
            `let initialization; export function initializeHarfBuzz(){return initialization ||= createHarfBuzz({wasmBinary:Uint8Array.from(atob(${await bytes("harfbuzzjs/dist/harfbuzz.wasm")}),c=>c.charCodeAt(0))}).then(init)}`
          ),
          loader: "js"
        }
      })
      build.onLoad({ filter: /subset-font[\\/]index\.js$/ }, async args => {
        let source = await readFile(args.path, "utf8")
        const marker = "await readFile(require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm'))"
        if (!source.includes(marker))
          throw new Error("Unexpected subset-font loader; review browser adapter")
        source = source
          .replace(
            "const { readFile } = require('fs').promises;",
            "const {Buffer}=require('buffer');"
          )
          .replace(
            "const fontverter = require('fontverter');",
            "const fontverter={detectFormat:()=> 'truetype',convert:async bytes=>bytes};"
          )
          .replace(
            marker,
            `Uint8Array.from(atob(${await bytes("harfbuzzjs/dist/harfbuzz-subset.wasm")}),c=>c.charCodeAt(0))`
          )
        return { contents: source, loader: "js" }
      })
    }
  }
}
