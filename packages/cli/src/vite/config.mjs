import { createRequire } from "node:module"
import { resolve, dirname, join } from "node:path"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/postcss"
import react from "@vitejs/plugin-react"

import { promptslidePlugin } from "./plugin.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function resolvePackageAsset(packageName, assetPath) {
  let dir = __dirname
  while (true) {
    const candidate = join(dir, "node_modules", packageName, assetPath)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`Could not resolve ${packageName}/${assetPath}`)
}

// Resolve tailwindcss from CLI's deps so @import "tailwindcss" in user CSS works
// even when the user's project doesn't have tailwindcss as a direct dependency.
const tailwindPath = resolve(dirname(require.resolve("tailwindcss")), "..")
const twAnimateCssPath = resolvePackageAsset("tw-animate-css", "dist/tw-animate.css")

// Resolve promptslide core from source so Vite uses TS directly without a build step
const promptslidePath = resolve(__dirname, "../core/index.ts")

// Resolve react entry points from CLI's deps so decks outside the monorepo work
const reactEntry = require.resolve("react")
const reactDomEntry = require.resolve("react-dom")
const reactJsxRuntime = require.resolve("react/jsx-runtime")
const reactJsxDevRuntime = require.resolve("react/jsx-dev-runtime")
const reactDomClient = require.resolve("react-dom/client")

export function createViteConfig({ cwd, mode = "development" }) {
  // CLI's node_modules for optimizeDeps to find react etc.
  const cliRoot = resolve(__dirname, "../..")

  return {
    configFile: false,
    root: cwd,
    mode,
    appType: "custom",
    plugins: [react(), promptslidePlugin({ root: cwd })],
    resolve: {
      alias: {
        promptslide: promptslidePath,
        // CSS @import "tailwindcss" → resolved from CLI package
        tailwindcss: tailwindPath,
        // CSS @import "tw-animate-css" → resolved from CLI package/toolchain
        "tw-animate-css": twAnimateCssPath,
        // Resolve react from CLI's deps so decks don't need their own node_modules
        "react/jsx-runtime": reactJsxRuntime,
        "react/jsx-dev-runtime": reactJsxDevRuntime,
        "react-dom/client": reactDomClient,
        "react-dom": reactDomEntry,
        react: reactEntry
      }
    },
    server: {
      cors: true,
      fs: {
        // Allow serving files from the CLI package (core, node_modules)
        // so decks outside the monorepo can access framework code
        allow: [cwd, cliRoot, resolve(cliRoot, ".."), resolve(cliRoot, "../.."), resolve(cliRoot, "node_modules"), resolve(cliRoot, "../../node_modules")]
      }
    },
    // Tell Vite's dependency optimizer where to find react etc.
    // esbuild aliases ensure pre-bundling works regardless of Vite root location.
    optimizeDeps: {
      entries: [],
      include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client"],
      esbuildOptions: {
        resolveExtensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
        nodePaths: [resolve(cliRoot, "node_modules")],
        alias: {
          react: reactEntry,
          "react-dom": reactDomEntry,
          "react/jsx-runtime": reactJsxRuntime,
          "react/jsx-dev-runtime": reactJsxDevRuntime,
          "react-dom/client": reactDomClient
        }
      }
    },
    css: {
      postcss: {
        plugins: [tailwindcss()]
      }
    }
  }
}
