import { existsSync, writeFileSync, unlinkSync } from "node:fs"
import { resolve } from "node:path"
import { build as viteBuild } from "vite"
import react from "@vitejs/plugin-react"
import { powervibe } from "../vite/plugin.js"
import { generateHtml } from "../vite/html-template.js"

export async function build() {
  const cwd = process.cwd()
  const configPath = resolve(cwd, "deck.config.ts")
  const themePath = resolve(cwd, "theme.css")

  if (!existsSync(configPath)) {
    console.error("  Error: deck.config.ts not found in current directory.")
    console.error("  Run this command from your PowerVibe project root.")
    process.exit(1)
  }

  if (!existsSync(themePath)) {
    console.error("  Error: theme.css not found. Run `powervibe dev` first to generate it.")
    process.exit(1)
  }

  // Write temporary index.html for Vite build
  const indexPath = resolve(cwd, "index.html")
  writeFileSync(indexPath, generateHtml(), "utf-8")

  try {
    await viteBuild({
      root: cwd,
      configFile: false,
      publicDir: resolve(cwd, "public"),
      plugins: [
        react(),
        powervibe()
      ],
      resolve: {
        alias: {
          "/deck.config": configPath,
          "/theme.css": themePath
        }
      },
      css: {
        postcss: {
          plugins: [
            (await import("@tailwindcss/postcss")).default()
          ]
        }
      },
      build: {
        outDir: resolve(cwd, "dist"),
        emptyOutDir: true
      }
    })

    console.log("\n  Build complete! Output in dist/\n")
  } finally {
    // Clean up temporary index.html
    try { unlinkSync(indexPath) } catch {}
  }
}
