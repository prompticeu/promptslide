#!/usr/bin/env node

/**
 * Dev launcher for the PromptSlide desktop app.
 *
 * Starts the promptslide backend (MCP HTTP + Vite dev server) and opens the browser.
 * Use this during development without needing Tauri/Rust installed.
 *
 * Usage: node src/launcher.mjs [--port=5173] [--mcp-port=3001]
 */

import { spawn } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { existsSync, mkdirSync } from "node:fs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const cliEntry = resolve(__dirname, "../../cli/src/index.mjs")

const args = process.argv.slice(2)
const portArg = args.find(a => a.startsWith("--port="))
const port = portArg ? portArg.split("=")[1] : "5173"
const mcpPortArg = args.find(a => a.startsWith("--mcp-port="))
const mcpPort = mcpPortArg ? mcpPortArg.split("=")[1] : "3001"

const deckRoot = resolve(homedir(), ".promptslide", "decks")
if (!existsSync(deckRoot)) {
  mkdirSync(deckRoot, { recursive: true })
}

console.log("Starting PromptSlide app mode...")
console.log(`  Deck root: ${deckRoot}`)
console.log()

const child = spawn(
  process.execPath,
  [
    cliEntry,
    "studio",
    "--mcp",
    "--transport=http",
    "--html",
    "--json",
    `--port=${port}`,
    `--mcp-port=${mcpPort}`,
    `--deck-root=${deckRoot}`,
  ],
  {
    cwd: deckRoot,
    stdio: ["ignore", "inherit", "pipe"],
  }
)

child.stderr.on("data", (chunk) => {
  const text = chunk.toString()
  if (text.includes("__PROMPTSLIDE_READY__")) {
    const jsonStr = text.split("__PROMPTSLIDE_READY__")[1].trim()
    try {
      const info = JSON.parse(jsonStr)
      console.log(`  Dev server:  ${info.devServer}`)
      console.log(`  MCP server:  ${info.mcpServer}`)
      console.log()
      console.log("Open the dev server URL in your browser, or connect an LLM to the MCP URL.")
    } catch {
      // not json, print raw
      process.stderr.write(text)
    }
  } else {
    process.stderr.write(text)
  }
})

child.on("exit", (code) => {
  process.exit(code ?? 1)
})

process.on("SIGINT", () => {
  child.kill("SIGTERM")
})
process.on("SIGTERM", () => {
  child.kill("SIGTERM")
})
