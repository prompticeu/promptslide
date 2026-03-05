import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, basename, relative, extname } from "node:path"

import { bold, green, cyan, red, dim } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { captureSlideAsDataUri, isPlaywrightAvailable } from "../utils/export.mjs"
import { publishToRegistry, registryItemExists, updateLockfileItem, hashContent, detectPackageManager, requestUploadTokens, uploadBinaryToBlob } from "../utils/registry.mjs"
import { prompt, confirm, closePrompts } from "../utils/prompts.mjs"
import { parseDeckConfig } from "../utils/deck-config.mjs"

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
  // Match both unscoped (foo) and scoped (@scope/foo) packages, exclude relative imports
  const importRegex = /import\s+.*?\s+from\s+["']((?:@[a-zA-Z0-9-]+\/)?[a-zA-Z0-9-][^"']*)["']/g
  for (const match of content.matchAll(importRegex)) {
    // Get the package name (handle deep imports like "framer-motion/client")
    const full = match[1]
    const pkg = full.startsWith("@") ? full.split("/").slice(0, 2).join("/") : full.split("/")[0]
    // Skip relative imports, react, and internal packages
    if (pkg.startsWith(".") || pkg === "react" || pkg === "react-dom" || pkg.startsWith("@promptslide/")) continue
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

const BINARY_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".woff", ".woff2"])
const MAX_INLINE_SIZE = 512_000  // 512KB for inline text content
const MAX_DECK_FILES = 50        // registry limit

const MIME_MAP = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2"
}

/**
 * Read a file for registry publishing.
 * Returns { binary: true, buffer, contentType, size } for binary files,
 * or { binary: false, content } for text files.
 */
function readFileForRegistry(fullPath) {
  const ext = extname(fullPath).toLowerCase()
  if (BINARY_EXTS.has(ext)) {
    const buffer = readFileSync(fullPath)
    const contentType = MIME_MAP[ext] || "application/octet-stream"
    return { binary: true, buffer, contentType, size: buffer.length }
  }
  return { binary: false, content: readFileSync(fullPath, "utf-8") }
}

/**
 * Collect all files for deck publishing.
 * Returns files with structured format: text files have { path, target, content },
 * binary files have { path, target, binary: true, buffer, contentType, size }.
 */
function collectDeckFiles(cwd) {
  const files = []
  const warnings = []

  function addDir(dirPath, target, filter) {
    if (!existsSync(dirPath)) return
    for (const entry of readdirSync(dirPath)) {
      if (entry === ".gitkeep") continue
      const fullPath = join(dirPath, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        addDir(fullPath, `${target}${entry}/`, filter)
        continue
      }
      if (!stat.isFile()) continue
      if (filter && !filter(entry)) continue
      const fileData = readFileForRegistry(fullPath)
      if (fileData.binary) {
        files.push({ path: entry, target, binary: true, buffer: fileData.buffer, contentType: fileData.contentType, size: fileData.size })
      } else {
        if (fileData.content.length > MAX_INLINE_SIZE) {
          warnings.push(`${target}${entry}: exceeds 512KB inline limit (${(fileData.content.length / 1024).toFixed(0)}KB), skipped`)
          continue
        }
        files.push({ path: entry, target, content: fileData.content })
      }
    }
  }

  addDir(join(cwd, "src", "slides"), "src/slides/", f => f.endsWith(".tsx") || f.endsWith(".ts"))
  addDir(join(cwd, "src", "layouts"), "src/layouts/", f => f.endsWith(".tsx") || f.endsWith(".ts"))

  const themePath = join(cwd, "src", "theme.ts")
  if (existsSync(themePath)) {
    files.push({ path: "theme.ts", target: "src/", content: readFileSync(themePath, "utf-8") })
  }

  const globalsPath = join(cwd, "src", "globals.css")
  if (existsSync(globalsPath)) {
    files.push({ path: "globals.css", target: "src/", content: readFileSync(globalsPath, "utf-8") })
  }

  addDir(join(cwd, "public"), "public/")

  if (files.length > MAX_DECK_FILES) {
    warnings.push(`Deck has ${files.length} files but registry limit is ${MAX_DECK_FILES}. Only the first ${MAX_DECK_FILES} will be included.`)
    files.length = MAX_DECK_FILES
  }

  return { files, warnings }
}

/**
 * Upload binary files directly to Vercel Blob via pre-signed tokens,
 * then return a unified file array ready for the publish payload.
 *
 * Text files get { path, target, content }.
 * Binary files get { path, target, storageUrl, contentType } (or fall back to inline data URIs).
 *
 * @param {string} slug - Item slug
 * @param {object[]} files - Mixed array from collectDeckFiles
 * @param {{ registry: string, token: string }} auth
 * @returns {Promise<object[]>} Files ready for publish payload
 */
async function uploadBinaryFiles(slug, files, auth) {
  const binaryFiles = files.filter(f => f.binary)
  const textFiles = files.filter(f => !f.binary)

  if (binaryFiles.length === 0) {
    return textFiles.map(f => ({ path: f.path, target: f.target, content: f.content }))
  }

  // Request upload tokens from registry
  let tokens = []
  try {
    tokens = await requestUploadTokens(
      slug,
      binaryFiles.map(f => ({ path: f.path, contentType: f.contentType, size: f.size })),
      auth
    )
  } catch (err) {
    console.log(`  ${dim("⚠ Could not get upload tokens, falling back to inline encoding")}`)
  }

  const result = textFiles.map(f => ({ path: f.path, target: f.target, content: f.content }))

  if (tokens.length === 0) {
    // Fallback: encode binary files as base64 data URIs inline
    for (const f of binaryFiles) {
      result.push({
        path: f.path,
        target: f.target,
        content: `data:${f.contentType};base64,${f.buffer.toString("base64")}`
      })
    }
    return result
  }

  // Upload each binary file directly to Vercel Blob
  const tokenMap = Object.fromEntries(tokens.map(t => [t.path, t]))

  for (const f of binaryFiles) {
    const token = tokenMap[f.path]
    if (!token) {
      // No token for this file — fall back to inline
      result.push({
        path: f.path,
        target: f.target,
        content: `data:${f.contentType};base64,${f.buffer.toString("base64")}`
      })
      continue
    }

    try {
      const blobUrl = await uploadBinaryToBlob(f.buffer, token.pathname, f.contentType, token.clientToken)
      result.push({
        path: f.path,
        target: f.target,
        storageUrl: blobUrl,
        contentType: f.contentType
      })
    } catch (err) {
      console.log(`  ${dim(`⚠ Direct upload failed for ${f.path}: ${err.message}`)}`)
      // Fall back to inline
      result.push({
        path: f.path,
        target: f.target,
        content: `data:${f.contentType};base64,${f.buffer.toString("base64")}`
      })
    }
  }

  return result
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
    const imagePath = await prompt("Preview image path (leave empty to auto-generate):", "")
    if (imagePath) {
      const resolved = join(cwd, imagePath)
      previewImage = readPreviewImage(resolved)
      if (!previewImage) {
        console.log(`  ${dim("⚠ Skipping image: file not found, unsupported format, or > 2MB")}`)
      }
    } else if (await isPlaywrightAvailable()) {
      console.log(`  ${dim("Generating preview image...")}`)
      previewImage = await captureSlideAsDataUri({ cwd, slidePath: filePath })
      if (previewImage) {
        console.log(`  ${green("✓")} Preview image generated`)
      } else {
        console.log(`  ${dim("⚠ Could not generate preview image")}`)
      }
    }
  } else {
    title = titleCase(slug)
    description = ""
    tags = []
    section = ""
    releaseNotes = ""
    previewImage = await captureSlideAsDataUri({ cwd, slidePath: filePath }).catch(() => null)
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
    console.log(`  Publish a slide, layout, or entire deck to the registry.`)
    console.log()
    console.log(`  ${bold("Examples:")}`)
    console.log(`    promptslide publish src/slides/slide-hero.tsx`)
    console.log(`    promptslide publish --type layout`)
    console.log(`    promptslide publish --type deck`)
    console.log()
    process.exit(0)
  }

  const auth = requireAuth()

  // Determine file to publish
  let typeOverride = null
  const typeIdx = args.indexOf("--type")
  if (typeIdx !== -1 && args[typeIdx + 1]) {
    typeOverride = args[typeIdx + 1]
  }

  const flagIndices = new Set()
  if (typeIdx !== -1) {
    flagIndices.add(typeIdx)
    flagIndices.add(typeIdx + 1)
  }
  let filePath = args.find((a, i) => !a.startsWith("--") && !flagIndices.has(i))

  if (!filePath && typeOverride !== "deck") {
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
    console.log(`    ${dim("─".repeat(30))}`)
    console.log(`    ${dim(`${available.length + 1}.`)} ${bold("Entire deck")}`)
    console.log()

    const choice = await prompt("Select file number:", "1")
    const idx = parseInt(choice, 10) - 1

    if (idx === available.length) {
      typeOverride = "deck"
    } else if (idx < 0 || idx >= available.length) {
      console.error(`  ${red("Error:")} Invalid selection.`)
      process.exit(1)
    } else {
      filePath = relative(cwd, available[idx].fullPath)
    }
  }

  // ── Deck publish flow ──────────────────────────────────────────────
  if (typeOverride === "deck") {
    const deckConfig = parseDeckConfig(cwd)
    if (!deckConfig) {
      console.error(`  ${red("Error:")} Could not parse src/deck-config.ts.`)
      console.error(`  ${dim("Ensure it has a slides array with component/steps entries.")}`)
      process.exit(1)
    }

    const { files, warnings } = collectDeckFiles(cwd)
    for (const w of warnings) {
      console.log(`  ${dim("⚠")} ${w}`)
    }

    if (files.length === 0) {
      console.error(`  ${red("Error:")} No files found to publish.`)
      process.exit(1)
    }

    // Aggregate npm deps from text files
    const allNpmDeps = {}
    for (const f of files) {
      if (!f.binary && f.content) {
        Object.assign(allNpmDeps, detectNpmDeps(f.content))
      }
    }

    // Derive slug from directory name (format: deck-name/deck-name)
    const dirName = basename(cwd)
    const deckName = dirName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const defaultSlug = `${deckName}/${deckName}`

    // Display summary
    const slideCount = files.filter(f => f.target === "src/slides/").length
    const layoutCount = files.filter(f => f.target === "src/layouts/").length
    const assetCount = files.filter(f => f.target === "public/").length
    const otherCount = files.length - slideCount - layoutCount - assetCount

    console.log(`  ${bold("Deck summary:")}`)
    console.log(`    Slides:  ${slideCount}`)
    if (layoutCount) console.log(`    Layouts: ${layoutCount}`)
    if (assetCount) console.log(`    Assets:  ${assetCount}`)
    if (otherCount) console.log(`    Other:   ${otherCount} ${dim("(theme, styles)")}`)
    console.log(`    Total:   ${files.length} files`)
    if (deckConfig.transition) {
      console.log(`    Transition: ${deckConfig.transition}${deckConfig.directionalTransition ? " (directional)" : ""}`)
    }
    if (Object.keys(allNpmDeps).length) {
      console.log(`    Dependencies: ${dim(Object.keys(allNpmDeps).join(", "))}`)
    }
    console.log()

    // Collect metadata
    const slug = await prompt("Slug (deck-name/item-name):", defaultSlug)
    const title = await prompt("Title:", titleCase(slug.split("/").pop() || slug))
    const description = await prompt("Description:", "")
    const tagsInput = await prompt("Tags (comma-separated):", "")
    const tags = tagsInput ? tagsInput.split(",").map(t => t.trim()).filter(Boolean) : []
    const releaseNotes = await prompt("Release notes:", "")

    // Preview image
    let previewImage = null
    const previewImagePath = await prompt("Preview image path (leave empty to auto-generate):", "")
    if (previewImagePath) {
      const resolved = join(cwd, previewImagePath)
      previewImage = readPreviewImage(resolved)
      if (!previewImage) {
        console.log(`  ${dim("⚠ Skipping image: file not found, unsupported format, or > 2MB")}`)
      }
    } else if (await isPlaywrightAvailable()) {
      const firstSlide = deckConfig.slides[0]
      if (firstSlide) {
        console.log(`  ${dim("Generating preview image from first slide...")}`)
        previewImage = await captureSlideAsDataUri({ cwd, slidePath: `src/slides/${firstSlide.slug}.tsx` })
        if (previewImage) {
          console.log(`  ${green("✓")} Preview image generated`)
        } else {
          console.log(`  ${dim("⚠ Could not generate preview image")}`)
        }
      }
    } else {
      const pm = detectPackageManager(cwd)
      const installCmd = pm === "bun" ? "bun add -d playwright" : pm === "pnpm" ? "pnpm add -D playwright" : pm === "yarn" ? "yarn add -D playwright" : "npm install -D playwright"
      console.log(`  ${dim("Tip: Install playwright for auto-generated preview images")}`)
      console.log(`  ${dim(`     ${installCmd} && npx playwright install chromium`)}`)
    }

    console.log()

    // Upload binary files directly to blob storage (two-phase upload)
    const binaryCount = files.filter(f => f.binary).length
    if (binaryCount > 0) {
      console.log(`  ${dim(`Uploading ${binaryCount} binary file(s)...`)}`)
    }

    let uploadedFiles
    try {
      uploadedFiles = await uploadBinaryFiles(slug, files, auth)
    } catch (err) {
      console.error(`  ${red("Error uploading files:")} ${err.message}`)
      closePrompts()
      process.exit(1)
    }

    if (binaryCount > 0) {
      const directUploads = uploadedFiles.filter(f => f.storageUrl).length
      if (directUploads > 0) {
        console.log(`  ${green("✓")} ${directUploads} file(s) uploaded directly to storage`)
      }
    }

    const payload = {
      type: "deck",
      slug,
      title,
      description: description || undefined,
      tags,
      deckConfig,
      files: uploadedFiles,
      npmDependencies: Object.keys(allNpmDeps).length ? allNpmDeps : undefined,
      releaseNotes: releaseNotes || undefined,
      previewImage: previewImage || undefined
    }

    try {
      const result = await publishToRegistry(payload, auth)
      const verTag = result.version ? ` v${result.version}` : ""
      console.log(`  ${green("✓")} Published deck ${bold(slug)}${verTag} to ${auth.organizationName || "registry"}`)
      console.log(`  Status: ${result.status || "published"}`)
      console.log(`  Install: ${cyan(`promptslide add ${slug}`)}`)

      const fileHashes = {}
      for (const f of uploadedFiles) {
        const hashInput = f.content || f.storageUrl || ""
        fileHashes[f.target + f.path] = hashContent(hashInput)
      }
      updateLockfileItem(cwd, slug, result.version ?? 0, fileHashes)
    } catch (err) {
      console.error(`  ${red("Error:")} ${err.message}`)
      closePrompts()
      process.exit(1)
    }

    console.log()
    closePrompts()
    return
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
  const previewImagePath = await prompt("Preview image path (leave empty to auto-generate):", "")
  let previewImage = null
  if (previewImagePath) {
    const resolved = join(cwd, previewImagePath)
    previewImage = readPreviewImage(resolved)
    if (!previewImage) {
      console.log(`  ${dim("⚠ Skipping image: file not found, unsupported format, or > 2MB")}`)
    }
  } else if (await isPlaywrightAvailable()) {
    console.log(`  ${dim("Generating preview image...")}`)
    previewImage = await captureSlideAsDataUri({ cwd, slidePath: filePath })
    if (previewImage) {
      console.log(`  ${green("✓")} Preview image generated`)
    } else {
      console.log(`  ${dim("⚠ Could not generate preview image")}`)
    }
  } else {
    const pm = detectPackageManager(cwd)
    const installCmd = pm === "bun" ? "bun add -d playwright" : pm === "pnpm" ? "pnpm add -D playwright" : pm === "yarn" ? "yarn add -D playwright" : "npm install -D playwright"
    console.log(`  ${dim("Tip: Install playwright for auto-generated preview images")}`)
    console.log(`  ${dim(`     ${installCmd} && npx playwright install chromium`)}`)
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
