import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, basename, relative, extname } from "node:path"

import { bold, green, cyan, red, dim } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { publishToRegistry, registryItemExists, updateLockfileItem, hashContent } from "../utils/registry.mjs"
import { prompt, confirm, closePrompts } from "../utils/prompts.mjs"

function titleCase(slug) {
  return slug
    .replace(/\.tsx?$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
}

function detectType(filePath) {
  if (filePath.includes("/slides/") || filePath.includes("\\slides\\")) return "slide"
  if (filePath.includes("/layouts/") || filePath.includes("\\layouts\\")) return "layout"
  return null
}

function detectSteps(content) {
  const matches = content.matchAll(/step=\{(\d+)\}/g)
  let max = 0
  for (const m of matches) {
    const n = parseInt(m[1], 10)
    if (n > max) max = n
  }
  return max
}

function detectNpmDeps(content) {
  const deps = {}
  const importRegex = /import\s+.*?\s+from\s+["']([^"'@/.][^"']*)["']/g
  for (const match of content.matchAll(importRegex)) {
    const pkg = match[1]
    // Skip internal packages
    if (pkg === "react" || pkg === "react-dom" || pkg.startsWith("@promptslide/")) continue
    deps[pkg] = "latest"
  }
  return deps
}

function detectRegistryDeps(content) {
  const deps = []
  const importRegex = /import\s+.*?\s+from\s+["']@\/layouts\/([^"']+)["']/g
  for (const match of content.matchAll(importRegex)) {
    const name = match[1].replace(/\.tsx?$/, "")
    deps.push(name)
  }
  return deps
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"])
const MAX_IMAGE_SIZE = 2 * 1024 * 1024 // 2MB

function readPreviewImage(imagePath) {
  if (!existsSync(imagePath)) return null
  const ext = extname(imagePath).toLowerCase()
  if (!IMAGE_EXTS.has(ext)) return null
  const stat = statSync(imagePath)
  if (stat.size > MAX_IMAGE_SIZE) return null
  const buf = readFileSync(imagePath)
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg"
  return `data:${mime};base64,${buf.toString("base64")}`
}

function scanForFiles(cwd) {
  const files = []
  const dirs = [
    { dir: join(cwd, "src", "slides"), target: "src/slides/" },
    { dir: join(cwd, "src", "layouts"), target: "src/layouts/" }
  ]
  for (const { dir, target } of dirs) {
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
        files.push({ path: entry, target, fullPath: join(dir, entry) })
      }
    }
  }
  return files
}

/**
 * Publish a single item to the registry.
 * @param {{ filePath: string, cwd: string, auth: object, typeOverride?: string, interactive?: boolean }} opts
 * @returns {Promise<{ slug: string, status: string }>}
 */
async function publishItem({ filePath, cwd, auth, typeOverride, interactive = true }) {
  const fullPath = join(cwd, filePath)
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const content = readFileSync(fullPath, "utf-8")
  const fileName = basename(fullPath)
  const slug = fileName.replace(/\.tsx?$/, "")

  const type = typeOverride || detectType(filePath) || "slide"
  const steps = detectSteps(content)
  const npmDeps = detectNpmDeps(content)
  const registryDeps = detectRegistryDeps(content)
  const target = type === "layout" ? "src/layouts/" : "src/slides/"

  let title, description, tags, section, releaseNotes, previewImage

  if (interactive) {
    title = await prompt("Title:", titleCase(slug))
    description = await prompt("Description:", "")
    const tagsInput = await prompt("Tags (comma-separated):", "")
    tags = tagsInput ? tagsInput.split(",").map(t => t.trim()).filter(Boolean) : []
    section = await prompt("Section:", "")
    releaseNotes = await prompt("Release notes:", "")
    const imagePath = await prompt("Preview image path:", "")
    if (imagePath) {
      const resolved = join(cwd, imagePath)
      previewImage = readPreviewImage(resolved)
      if (!previewImage) {
        console.log(`  ${dim("⚠ Skipping image: file not found, unsupported format, or > 2MB")}`)
      }
    }
  } else {
    title = titleCase(slug)
    description = ""
    tags = []
    section = ""
    releaseNotes = ""
    previewImage = null
  }

  const payload = {
    type,
    slug,
    title,
    description: description || undefined,
    tags,
    steps,
    section: section || undefined,
    files: [{ path: fileName, target, content }],
    npmDependencies: Object.keys(npmDeps).length ? npmDeps : undefined,
    registryDependencies: registryDeps.length ? registryDeps : undefined,
    releaseNotes: releaseNotes || undefined,
    previewImage: previewImage || undefined
  }

  const result = await publishToRegistry(payload, auth)

  // Track in lockfile
  const fileHashes = { [target + fileName]: hashContent(content) }
  updateLockfileItem(cwd, slug, result.version ?? 0, fileHashes)

  return { slug, status: result.status || "published", version: result.version }
}

export async function publish(args) {
  const cwd = process.cwd()

  console.log()
  console.log(`  ${bold("promptslide")} ${dim("publish")}`)
  console.log()

  if (args[0] === "--help" || args[0] === "-h") {
    console.log(`  ${bold("Usage:")} promptslide publish ${dim("[file] [--type slide|layout|deck|theme]")}`)
    console.log()
    console.log(`  Publish a slide or layout to the registry.`)
    console.log()
    console.log(`  ${bold("Examples:")}`)
    console.log(`    promptslide publish src/slides/slide-hero.tsx`)
    console.log(`    promptslide publish --type layout`)
    console.log()
    process.exit(0)
  }

  const auth = requireAuth()

  // Determine file to publish
  let filePath = args.find(a => !a.startsWith("--"))
  let typeOverride = null
  const typeIdx = args.indexOf("--type")
  if (typeIdx !== -1 && args[typeIdx + 1]) {
    typeOverride = args[typeIdx + 1]
  }

  if (!filePath) {
    // Interactive mode: scan for files
    const available = scanForFiles(cwd)
    if (available.length === 0) {
      console.error(`  ${red("Error:")} No .tsx files found in src/slides/ or src/layouts/.`)
      process.exit(1)
    }

    console.log(`  ${bold("Available files:")}`)
    available.forEach((f, i) => {
      console.log(`    ${dim(`${i + 1}.`)} ${f.target}${f.path}`)
    })
    console.log()

    const choice = await prompt("Select file number:", "1")
    const idx = parseInt(choice, 10) - 1
    if (idx < 0 || idx >= available.length) {
      console.error(`  ${red("Error:")} Invalid selection.`)
      process.exit(1)
    }

    filePath = relative(cwd, available[idx].fullPath)
  }

  // Resolve full path and read content
  const fullPath = join(cwd, filePath)
  if (!existsSync(fullPath)) {
    console.error(`  ${red("Error:")} File not found: ${filePath}`)
    process.exit(1)
  }

  const content = readFileSync(fullPath, "utf-8")
  const fileName = basename(fullPath)
  const slug = fileName.replace(/\.tsx?$/, "")

  // Detect metadata
  const type = typeOverride || detectType(filePath) || "slide"
  const steps = detectSteps(content)
  const npmDeps = detectNpmDeps(content)
  const registryDeps = detectRegistryDeps(content)
  const target = type === "layout" ? "src/layouts/" : "src/slides/"

  console.log(`  File: ${cyan(filePath)}`)
  console.log(`  Type: ${type}`)
  console.log(`  Steps: ${steps}`)
  if (Object.keys(npmDeps).length) {
    console.log(`  Dependencies: ${dim(Object.keys(npmDeps).join(", "))}`)
  }
  if (registryDeps.length) {
    console.log(`  Registry deps: ${dim(registryDeps.join(", "))}`)
  }
  console.log()

  // Check if registry dependencies exist and offer to publish missing ones
  if (registryDeps.length) {
    const missing = []

    for (const depSlug of registryDeps) {
      const exists = await registryItemExists(depSlug, auth)
      if (!exists) {
        missing.push(depSlug)
      }
    }

    if (missing.length) {
      console.log(`  ${bold("Missing dependencies:")} ${missing.length} registry dep(s) not yet published`)
      for (const depSlug of missing) {
        // Try to find the local file
        const candidates = [
          join(cwd, "src", "layouts", `${depSlug}.tsx`),
          join(cwd, "src", "layouts", `${depSlug}.ts`),
          join(cwd, "src", "slides", `${depSlug}.tsx`),
          join(cwd, "src", "slides", `${depSlug}.ts`),
        ]
        const localFile = candidates.find(f => existsSync(f))

        if (localFile) {
          const relPath = relative(cwd, localFile)
          const depType = detectType(relPath) || "layout"
          const shouldPublish = await confirm(
            `Publish ${bold(depSlug)} (${cyan(relPath)}) as ${depType}?`
          )

          if (shouldPublish) {
            console.log()
            console.log(`  ${dim("─── Publishing dependency:")} ${bold(depSlug)} ${dim("───")}`)
            console.log()

            try {
              const result = await publishItem({
                filePath: relPath,
                cwd,
                auth,
                typeOverride: depType,
                interactive: true
              })
              console.log()
              const depVer = result.version ? ` ${dim(`v${result.version}`)}` : ""
              console.log(`  ${green("✓")} Published dependency ${bold(result.slug)}${depVer}`)
              console.log()
            } catch (err) {
              console.error(`  ${red("Error publishing dependency:")} ${err.message}`)
              console.log(`  ${dim("Continuing with main item...")}`)
              console.log()
            }
          }
        } else {
          console.log(`  ${dim("⚠")} ${depSlug}: local file not found, skipping`)
        }
      }

      console.log(`  ${dim("─── Main item:")} ${bold(slug)} ${dim("───")}`)
      console.log()
    }
  }

  // Collect metadata for main item
  const title = await prompt("Title:", titleCase(slug))
  const description = await prompt("Description:", "")
  const tagsInput = await prompt("Tags (comma-separated):", "")
  const tags = tagsInput ? tagsInput.split(",").map(t => t.trim()).filter(Boolean) : []
  const section = await prompt("Section:", "")
  const releaseNotes = await prompt("Release notes:", "")
  const previewImagePath = await prompt("Preview image path:", "")
  let previewImage = null
  if (previewImagePath) {
    const resolved = join(cwd, previewImagePath)
    previewImage = readPreviewImage(resolved)
    if (!previewImage) {
      console.log(`  ${dim("⚠ Skipping image: file not found, unsupported format, or > 2MB")}`)
    }
  }

  console.log()

  // Publish main item
  const payload = {
    type,
    slug,
    title,
    description: description || undefined,
    tags,
    steps,
    section: section || undefined,
    files: [{ path: fileName, target, content }],
    npmDependencies: Object.keys(npmDeps).length ? npmDeps : undefined,
    registryDependencies: registryDeps.length ? registryDeps : undefined,
    releaseNotes: releaseNotes || undefined,
    previewImage: previewImage || undefined
  }

  try {
    const result = await publishToRegistry(payload, auth)
    const verTag = result.version ? ` v${result.version}` : ""
    console.log(`  ${green("✓")} Published ${bold(slug)}${verTag} to ${auth.organizationName || "registry"}`)
    console.log(`  Status: ${result.status || "published"}`)
    console.log(`  Install: ${cyan(`promptslide add ${slug}`)}`)

    // Track in lockfile
    const fileHashes = { [target + fileName]: hashContent(content) }
    updateLockfileItem(cwd, slug, result.version ?? 0, fileHashes)
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

  console.log()
  closePrompts()
}
