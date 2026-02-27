import { createRequire } from "node:module"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/postcss"
import react from "@vitejs/plugin-react"

import { promptslidePlugin } from "./plugin.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Resolve tailwindcss from CLI's deps so @import "tailwindcss" in user CSS works
// even when the user's project doesn't have tailwindcss as a direct dependency.
const tailwindPath = resolve(dirname(require.resolve("tailwindcss")), "..")

// Resolve promptslide core from source so Vite uses TS directly without a build step
const promptslidePath = resolve(__dirname, "../core/index.ts")

export function createViteConfig({ cwd, mode = "development" }) {
  return {
    configFile: false,
    root: cwd,
    mode,
    plugins: [react(), promptslidePlugin()],
    resolve: {
      alias: {
        "@": resolve(cwd, "src"),
        promptslide: promptslidePath,
        // CSS @import "tailwindcss" → resolved from CLI package
        tailwindcss: tailwindPath
      }
    },
    css: {
      postcss: {
        plugins: [tailwindcss()]
      }
    }
  }
}
