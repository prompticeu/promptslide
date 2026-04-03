/**
 * promptslide pack — Package a deck into a .promptslide file.
 *
 * The .promptslide format is a self-contained JSON file with all deck
 * source files, assets, and metadata. It can be shared, uploaded to the
 * Registry, or unpacked into a local project directory.
 *
 * Usage: promptslide pack [deck-directory] [--output file.promptslide]
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { writeFileSync } from "node:fs"
import { join, resolve, basename, extname } from "node:path"

import { bold, green, cyan, dim, red } from "../utils/ansi.mjs"

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
  ".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".pdf", ".zip"
])

function isBinary(filePath) {
  return BINARY_EXTENSIONS.has(extname(filePath).toLowerCase())
}

function walkDir(dir, base = "") {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    const full = join(dir, entry.name)

    // Skip build artifacts, caches, and metadata
    if (entry.name === "node_modules" || entry.name === ".vite" ||
        entry.name === ".git" || entry.name === "annotations.json" ||
        entry.name === ".promptslide-lock.json") continue

    if (entry.isDirectory()) {
      files.push(...walkDir(full, rel))
    } else {
      const stat = statSync(full)
      if (stat.size > 10 * 1024 * 1024) continue // Skip files > 10MB

      if (isBinary(full)) {
        const buffer = readFileSync(full)
        const ext = extname(entry.name).slice(1)
        const mime = getMimeType(ext)
        files.push({ path: rel, content: `data:${mime};base64,${buffer.toString("base64")}` })
      } else {
        files.push({ path: rel, content: readFileSync(full, "utf-8") })
      }
    }
  }
  return files
}

function getMimeType(ext) {
  const map = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf",
    pdf: "application/pdf"
  }
  return map[ext] || "application/octet-stream"
}

export async function pack(args) {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim("pack")}`)
  console.log()

  const dir = resolve(args[0] || ".")
  const deckJsonPath = join(dir, "deck.json")

  if (!existsSync(deckJsonPath)) {
    console.error(`  ${red("Error:")} No deck.json found in ${dir}`)
    process.exit(1)
  }

  const deckJson = JSON.parse(readFileSync(deckJsonPath, "utf-8"))
  const slug = deckJson.slug || basename(dir)
  const cliVersion = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "..", "package.json"), "utf-8")
  ).version

  console.log(`  Packing ${bold(deckJson.name || slug)}...`)

  // Collect all files
  const files = walkDir(dir)

  // Build the .promptslide package
  const pkg = {
    format: "promptslide/1.0",
    name: deckJson.name || slug,
    slug,
    version: 1,
    promptslideVersion: cliVersion,
    createdAt: new Date().toISOString(),
    deck: deckJson,
    files
  }

  // Determine output path
  const outputIdx = args.indexOf("--output")
  const outputFile = outputIdx >= 0 && args[outputIdx + 1]
    ? resolve(args[outputIdx + 1])
    : resolve(dir, "..", `${slug}.promptslide`)

  writeFileSync(outputFile, JSON.stringify(pkg, null, 2))

  const sizeMb = (statSync(outputFile).size / 1024 / 1024).toFixed(1)
  console.log(`  ${green("✓")} Packed ${files.length} files (${sizeMb} MB)`)
  console.log(`  ${cyan(outputFile)}`)
  console.log()
}
