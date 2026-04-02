/**
 * Slide Compiler — compiles a single slide TSX into a self-contained IIFE string.
 *
 * Uses Vite's build() API in library mode to bundle the slide + its local
 * dependencies (layouts, components) while externalizing React, framer-motion,
 * and the promptslide core (provided as globals by the MCP App).
 *
 * The compiled IIFE assigns `window.__slideModule = { default: SlideComponent, meta }`.
 */

import { build } from "vite"
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

/**
 * Compile a slide to a self-contained IIFE string.
 *
 * @param {Object} options
 * @param {string} options.deckRoot - Absolute path to the deck directory
 * @param {string} options.slideFile - Relative path to slide file (e.g. "src/slides/slide-hero.tsx")
 * @returns {Promise<{ js: string, meta: { steps: number } }>}
 */
export async function compileSlide({ deckRoot, slideFile }) {
  const slidePath = resolve(deckRoot, slideFile)

  if (!existsSync(slidePath)) {
    throw new Error(`Slide file not found: ${slideFile}`)
  }

  // Virtual entry that re-exports the slide
  const result = await build({
    configFile: false,
    root: deckRoot,
    logLevel: "silent",

    plugins: [
      // Resolve @/ imports to deck's src/ directory
      {
        name: "slide-alias",
        resolveId(id) {
          if (id.startsWith("@/")) {
            return resolve(deckRoot, "src", id.slice(2))
          }
        },
      },
    ],

    build: {
      write: false,
      lib: {
        entry: slidePath,
        formats: ["iife"],
        name: "__slideModule",
      },
      rollupOptions: {
        external: [
          "react",
          "react/jsx-runtime",
          "react-dom",
          "framer-motion",
          "promptslide",
        ],
        output: {
          globals: {
            "react": "__PS.React",
            "react/jsx-runtime": "__PS.React",
            "react-dom": "__PS.React",
            "framer-motion": "__PS.framerMotion",
            "promptslide": "__PS",
          },
          // Ensure IIFE assigns to window
          extend: true,
        },
      },
      minify: true,
      sourcemap: false,
    },
  })

  // Extract the compiled JS string
  const output = Array.isArray(result) ? result[0] : result
  const chunk = output.output.find(o => o.type === "chunk")
  if (!chunk) throw new Error("No output chunk produced")

  // Detect step count from source
  const source = readFileSync(slidePath, "utf-8")
  const steps = detectSteps(source)

  return {
    js: chunk.code,
    meta: { steps },
  }
}

/** Detect max step from TSX source: step={N} */
function detectSteps(content) {
  const matches = content.matchAll(/step=\{(\d+)\}/g)
  let max = 0
  for (const m of matches) {
    const n = parseInt(m[1], 10)
    if (n > max) max = n
  }
  return max
}
