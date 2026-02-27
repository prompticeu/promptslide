import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/postcss"
import { promptslidePlugin } from "./plugin.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

// Resolve tailwindcss from CLI's deps so @import "tailwindcss" in user CSS works
// even when the user's project doesn't have tailwindcss as a direct dependency.
const tailwindPath = resolve(dirname(require.resolve("tailwindcss")), "..")

export function createViteConfig({ cwd, mode = "development" }) {
  return {
    configFile: false,
    root: cwd,
    mode,
    plugins: [
      react(),
      promptslidePlugin(),
    ],
    resolve: {
      alias: {
        "@": resolve(cwd, "src"),
        // CSS @import "tailwindcss" → resolved from CLI package
        "tailwindcss": tailwindPath,
      },
    },
    css: {
      postcss: {
        plugins: [tailwindcss()],
      },
    },
  }
}
