import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, basename, relative, extname } from "node:path"

import { bold, green, cyan, red, dim } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { captureSlideAsDataUri, isPlaywrightAvailable } from "../utils/export.mjs"
import { publishToRegistry, registryItemExists, searchRegistry, updateLockfileItem, updateLockfilePublishConfig, readLockfile, hashContent, detectPackageManager, requestUploadTokens, uploadBinaryToBlob, assetFileToSlug, detectAssetDepsInContent } from "../utils/registry.mjs"
import { prompt, confirm, select, closePrompts } from "../utils/prompts.mjs"
import { parseDeckConfig } from "../utils/deck-config.mjs"

function readDeckPrefix(cwd) {
  // Prefer stored prefix from lockfile (user's previous choice)
  const lock = readLockfile(cwd)
  if (lock.deckPrefix) return lock.deckPrefix

  // Fall back to package.json name
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"))
    return (pkg.name || "").toLowerCase()
  } catch {
    return ""
  }
}

async function promptDeckPrefix(cwd, interactive) {
  const defaultPrefix = readDeckPrefix(cwd)
  if (!interactive) {
    if (!defaultPrefix) throw new Error("Deck prefix is required. Set a name in package.json or publish interactively.")
    return defaultPrefix
  }
  let prefix
  while (true) {
    prefix = await prompt("Deck prefix:", defaultPrefix)
    if (prefix && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(prefix)) break
    console.log(`  ${red("Error:")} Deck prefix is required (lowercase alphanumeric with hyphens, min 2 chars)`)
  }
  return prefix
}

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
  } catch {
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
 * @param {{ filePath: string, cwd: string, auth: object, typeOverride?: string, interactive?: boolean, deckPrefix?: string }} opts
 * @returns {Promise<{ slug: string, status: string }>}
 */
async function publishItem({ filePath, cwd, auth, typeOverride, interactive = true, deckPrefix }) {
  const fullPath = join(cwd, filePath)
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const content = readFileSync(fullPath, "utf-8")
  const fileName = basename(fullPath)
  const baseSlug = fileName.replace(/\.tsx?$/, "")
  const prefix = deckPrefix || await promptDeckPrefix(cwd, interactive)
  const slug = `${prefix}/${baseSlug}`

  const type = typeOverride || detectType(filePath) || "slide"
  const steps = detectSteps(content)
  const npmDeps = detectNpmDeps(content)
  const registryDeps = detectRegistryDeps(content)
  const target = type === "layout" ? "src/layouts/" : "src/slides/"

  let title, description, tags, section, releaseNotes, previewImage

  if (interactive) {
    title = await prompt("Title:", titleCase(baseSlug))
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
    title = titleCase(baseSlug)
    description = ""
    tags = []
    section = ""
    releaseNotes = ""
    previewImage = await captureSlideAsDataUri({ cwd, slidePath: filePath }).catch(() => null)
  }

  const prefixedDeps = registryDeps.map(d => `${prefix}/${d}`)
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
    registryDependencies: prefixedDeps.length ? prefixedDeps : undefined,
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

    console.log(`  ${bold("What do you want to publish?")}`)
    console.log()

    const options = [
      ...available.map(f => `${f.target}${f.path}`),
      "Entire deck"
    ]
    const idx = await select(options, options.length - 1)

    if (idx === available.length) {
      typeOverride = "deck"
    } else {
      filePath = relative(cwd, available[idx].fullPath)
    }
  }

  // ── Deck publish flow (decomposed) ───────────────────────────────
  if (typeOverride === "deck") {
    const deckConfig = parseDeckConfig(cwd)
    if (!deckConfig) {
      console.error(`  ${red("Error:")} Could not parse src/deck-config.ts.`)
      console.error(`  ${dim("Ensure it has a slides array with component/steps entries.")}`)
      process.exit(1)
    }

    // Check if a deck slug already exists in the lockfile
    const existingLock = readLockfile(cwd)
    const existingSlug = existingLock.deckSlug
    let deckPrefix, deckSlug

    if (existingSlug) {
      console.log(`  ${dim("Previously published as")} ${cyan(existingSlug)}`)
      console.log()
      const reuse = await confirm(`  Publish to ${bold(existingSlug)}?`)

      if (reuse) {
        deckSlug = existingSlug
        deckPrefix = existingSlug.split("/")[0]
      } else {
        deckPrefix = await promptDeckPrefix(cwd, true)
        const dirName = basename(cwd)
        const deckBaseSlug = dirName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        deckSlug = `${deckPrefix}/${deckBaseSlug}`
      }
    } else {
      deckPrefix = await promptDeckPrefix(cwd, true)
      const dirName = basename(cwd)
      const deckBaseSlug = dirName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      deckSlug = `${deckPrefix}/${deckBaseSlug}`
    }

    // Persist prefix for next time (slug is saved after successful publish)
    updateLockfilePublishConfig(cwd, { deckPrefix })

    // Walk public/ to collect assets and build reference set
    const publicDir = join(cwd, "public")
    const publicAssets = []
    const publicFileSet = new Set()
    function walkPublic(dir, prefix) {
      if (!existsSync(dir)) return
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith(".")) continue
        const full = join(dir, entry)
        const s = statSync(full)
        if (s.isDirectory()) {
          walkPublic(full, prefix ? `${prefix}/${entry}` : entry)
        } else if (s.isFile()) {
          const relPath = prefix ? `${prefix}/${entry}` : entry
          publicAssets.push({ relativePath: relPath, fullPath: full })
          publicFileSet.add(relPath)
        }
      }
    }
    walkPublic(publicDir, "")

    // Discover theme, layout, and slide files
    const themeFilePaths = []
    if (existsSync(join(cwd, "src", "theme.ts"))) themeFilePaths.push("theme.ts")
    if (existsSync(join(cwd, "src", "globals.css"))) themeFilePaths.push("globals.css")
    const hasTheme = themeFilePaths.length > 0

    const layoutsDir = join(cwd, "src", "layouts")
    const layoutEntries = existsSync(layoutsDir)
      ? readdirSync(layoutsDir).filter(f => f.endsWith(".tsx") || f.endsWith(".ts"))
      : []

    const slidesDir = join(cwd, "src", "slides")
    const slideEntries = existsSync(slidesDir)
      ? readdirSync(slidesDir).filter(f => f.endsWith(".tsx") || f.endsWith(".ts"))
      : []

    const totalItems = publicAssets.length + (hasTheme ? 1 : 0) + layoutEntries.length + slideEntries.length + 1

    // Display summary
    console.log(`  ${bold("Decomposed deck publish:")} ${cyan(deckSlug)}`)
    if (publicAssets.length) console.log(`    Assets:  ${publicAssets.length}`)
    if (hasTheme) console.log(`    Theme:   1`)
    if (layoutEntries.length) console.log(`    Layouts: ${layoutEntries.length}`)
    console.log(`    Slides:  ${slideEntries.length}`)
    console.log(`    Total:   ${totalItems} items`)
    if (deckConfig.transition) {
      console.log(`    Transition: ${deckConfig.transition}${deckConfig.directionalTransition ? " (directional)" : ""}`)
    }
    console.log()

    // Collect deck metadata
    const title = await prompt("Title:", titleCase(deckBaseSlug))
    const description = await prompt("Description:", "")
    const tagsInput = await prompt("Tags (comma-separated):", "")
    const tags = tagsInput ? tagsInput.split(",").map(t => t.trim()).filter(Boolean) : []
    const releaseNotes = await prompt("Release notes:", "")

    // Check Playwright availability once for preview images
    const canCapture = await isPlaywrightAvailable()

    // Preview image (attached to the deck manifest only)
    let previewImage = null
    const previewImagePath = await prompt("Preview image path (leave empty to auto-generate):", "")
    if (previewImagePath) {
      const resolved = join(cwd, previewImagePath)
      previewImage = readPreviewImage(resolved)
      if (!previewImage) {
        console.log(`  ${dim("⚠ Skipping image: file not found, unsupported format, or > 2MB")}`)
      }
    } else if (canCapture) {
      const firstSlide = deckConfig.slides[0]
      if (firstSlide) {
        console.log(`  ${dim("Generating deck preview image...")}`)
        previewImage = await captureSlideAsDataUri({ cwd, slidePath: `src/slides/${firstSlide.slug}.tsx` })
        if (previewImage) {
          console.log(`  ${green("✓")} Deck preview image generated`)
        } else {
          console.log(`  ${dim("⚠ Could not generate deck preview image")}`)
        }
      }
    } else {
      const pm = detectPackageManager(cwd)
      const installCmd = pm === "bun" ? "bun add -d playwright" : pm === "pnpm" ? "pnpm add -D playwright" : pm === "yarn" ? "yarn add -D playwright" : "npm install -D playwright"
      console.log(`  ${dim("Tip: Install playwright for auto-generated preview images")}`)
      console.log(`  ${dim(`     ${installCmd} && npx playwright install chromium`)}`)
    }

    console.log()
    console.log(`  Publishing ${totalItems} items...`)
    console.log()

    // Read lockfile for skip-if-unchanged
    const lock = readLockfile(cwd)
    let itemIndex = 0
    let published = 0
    let skipped = 0
    let failed = 0

    function isUnchanged(slug, fileHashes) {
      const entry = lock.items[slug]
      if (!entry?.files) return false
      const storedKeys = Object.keys(entry.files)
      const currentKeys = Object.keys(fileHashes)
      if (storedKeys.length !== currentKeys.length) return false
      return currentKeys.every(k => entry.files[k] === fileHashes[k])
    }

    // ── Phase 1: Assets ──
    for (const asset of publicAssets) {
      itemIndex++
      const assetSlug = assetFileToSlug(deckPrefix, asset.relativePath)
      const fileName = basename(asset.fullPath)
      const dirPart = asset.relativePath.includes("/")
        ? "public/" + asset.relativePath.substring(0, asset.relativePath.lastIndexOf("/") + 1)
        : "public/"

      const fileData = readFileForRegistry(asset.fullPath)
      const fileHash = fileData.binary
        ? hashContent(fileData.buffer.toString("base64"))
        : hashContent(fileData.content)
      const fileHashes = { [dirPart + fileName]: fileHash }

      if (isUnchanged(assetSlug, fileHashes)) {
        console.log(`  [${itemIndex}/${totalItems}] ${dim("—")} asset ${dim(assetSlug)} (unchanged)`)
        skipped++
        continue
      }

      let files
      if (fileData.binary) {
        files = await uploadBinaryFiles(assetSlug, [
          { path: fileName, target: dirPart, binary: true, buffer: fileData.buffer, contentType: fileData.contentType, size: fileData.size }
        ], auth)
      } else {
        files = [{ path: fileName, target: dirPart, content: fileData.content }]
      }

      try {
        const result = await publishToRegistry({ type: "asset", slug: assetSlug, title: fileName, files }, auth)
        console.log(`  [${itemIndex}/${totalItems}] ${green("✓")} asset ${cyan(assetSlug)} ${dim(`v${result.version}`)}`)
        updateLockfileItem(cwd, assetSlug, result.version ?? 0, fileHashes)
        published++
      } catch (err) {
        console.log(`  [${itemIndex}/${totalItems}] ${red("✗")} asset ${dim(assetSlug)}: ${err.message}`)
        failed++
      }
    }

    // ── Phase 2: Theme ──
    if (hasTheme) {
      itemIndex++
      const themeSlug = `${deckPrefix}/theme`
      const themePayloadFiles = []
      const themeFileHashes = {}
      let themeContent = ""

      for (const tf of themeFilePaths) {
        const content = readFileSync(join(cwd, "src", tf), "utf-8")
        themePayloadFiles.push({ path: tf, target: "src/", content })
        themeFileHashes[`src/${tf}`] = hashContent(content)
        themeContent += content
      }

      if (isUnchanged(themeSlug, themeFileHashes)) {
        console.log(`  [${itemIndex}/${totalItems}] ${dim("—")} theme ${dim(themeSlug)} (unchanged)`)
        skipped++
      } else {
        const assetDeps = detectAssetDepsInContent(themeContent, deckPrefix, publicFileSet)
        const npmDeps = detectNpmDeps(themeContent)

        try {
          const result = await publishToRegistry({
            type: "theme",
            slug: themeSlug,
            title: "Theme",
            files: themePayloadFiles,
            registryDependencies: assetDeps.length ? assetDeps : undefined,
            npmDependencies: Object.keys(npmDeps).length ? npmDeps : undefined
          }, auth)
          console.log(`  [${itemIndex}/${totalItems}] ${green("✓")} theme ${cyan(themeSlug)} ${dim(`v${result.version}`)}`)
          updateLockfileItem(cwd, themeSlug, result.version ?? 0, themeFileHashes)
          published++
        } catch (err) {
          console.log(`  [${itemIndex}/${totalItems}] ${red("✗")} theme ${dim(themeSlug)}: ${err.message}`)
          failed++
        }
      }
    }

    // ── Phase 3: Layouts ──
    for (const layoutFile of layoutEntries) {
      itemIndex++
      const layoutName = layoutFile.replace(/\.tsx?$/, "")
      const layoutSlug = `${deckPrefix}/${layoutName}`
      const content = readFileSync(join(cwd, "src", "layouts", layoutFile), "utf-8")
      const fileHashes = { [`src/layouts/${layoutFile}`]: hashContent(content) }

      if (isUnchanged(layoutSlug, fileHashes)) {
        console.log(`  [${itemIndex}/${totalItems}] ${dim("—")} layout ${dim(layoutSlug)} (unchanged)`)
        skipped++
        continue
      }

      const assetDeps = detectAssetDepsInContent(content, deckPrefix, publicFileSet)
      const npmDeps = detectNpmDeps(content)
      const regDeps = hasTheme ? [`${deckPrefix}/theme`] : []
      regDeps.push(...assetDeps)

      try {
        const result = await publishToRegistry({
          type: "layout",
          slug: layoutSlug,
          title: titleCase(layoutName),
          files: [{ path: layoutFile, target: "src/layouts/", content }],
          registryDependencies: regDeps.length ? regDeps : undefined,
          npmDependencies: Object.keys(npmDeps).length ? npmDeps : undefined
        }, auth)
        console.log(`  [${itemIndex}/${totalItems}] ${green("✓")} layout ${cyan(layoutSlug)} ${dim(`v${result.version}`)}`)
        updateLockfileItem(cwd, layoutSlug, result.version ?? 0, fileHashes)
        published++
      } catch (err) {
        console.log(`  [${itemIndex}/${totalItems}] ${red("✗")} layout ${dim(layoutSlug)}: ${err.message}`)
        failed++
      }
    }

    // ── Phase 4: Slides ──
    for (const slideFile of slideEntries) {
      itemIndex++
      const slideName = slideFile.replace(/\.tsx?$/, "")
      const slideSlug = `${deckPrefix}/${slideName}`
      const content = readFileSync(join(cwd, "src", "slides", slideFile), "utf-8")
      const fileHashes = { [`src/slides/${slideFile}`]: hashContent(content) }

      if (isUnchanged(slideSlug, fileHashes)) {
        console.log(`  [${itemIndex}/${totalItems}] ${dim("—")} slide ${dim(slideSlug)} (unchanged)`)
        skipped++
        continue
      }

      const assetDeps = detectAssetDepsInContent(content, deckPrefix, publicFileSet)
      const layoutDeps = detectRegistryDeps(content).map(d => `${deckPrefix}/${d}`)
      const npmDeps = detectNpmDeps(content)
      const steps = detectSteps(content)
      const slideConfig = deckConfig.slides.find(s => s.slug === slideName)
      const section = slideConfig?.section || undefined

      const regDeps = hasTheme ? [`${deckPrefix}/theme`] : []
      regDeps.push(...layoutDeps, ...assetDeps)

      // Generate preview image for this slide
      let slidePreview = null
      if (canCapture) {
        slidePreview = await captureSlideAsDataUri({ cwd, slidePath: `src/slides/${slideFile}` }).catch(() => null)
      }

      try {
        const result = await publishToRegistry({
          type: "slide",
          slug: slideSlug,
          title: titleCase(slideName),
          files: [{ path: slideFile, target: "src/slides/", content }],
          steps,
          section,
          registryDependencies: regDeps.length ? regDeps : undefined,
          npmDependencies: Object.keys(npmDeps).length ? npmDeps : undefined,
          previewImage: slidePreview || undefined
        }, auth)
        console.log(`  [${itemIndex}/${totalItems}] ${green("✓")} slide ${cyan(slideSlug)} ${dim(`v${result.version}`)}`)
        updateLockfileItem(cwd, slideSlug, result.version ?? 0, fileHashes)
        published++
      } catch (err) {
        console.log(`  [${itemIndex}/${totalItems}] ${red("✗")} slide ${dim(slideSlug)}: ${err.message}`)
        failed++
      }
    }

    // ── Phase 5: Deck manifest ──
    itemIndex++
    const slideSlugs = slideEntries.map(f => `${deckPrefix}/${f.replace(/\.tsx?$/, "")}`)
    const assetSlugs = publicAssets.map(a => assetFileToSlug(deckPrefix, a.relativePath))
    const allDeckDeps = [...slideSlugs, ...assetSlugs]

    let deckItemId = null
    try {
      const result = await publishToRegistry({
        type: "deck",
        slug: deckSlug,
        title,
        description: description || undefined,
        tags,
        deckConfig,
        files: [],
        registryDependencies: allDeckDeps.length ? allDeckDeps : undefined,
        releaseNotes: releaseNotes || undefined,
        previewImage: previewImage || undefined
      }, auth)
      console.log(`  [${itemIndex}/${totalItems}] ${green("✓")} deck ${cyan(deckSlug)} ${dim(`v${result.version}`)}`)
      updateLockfileItem(cwd, deckSlug, result.version ?? 0, {})
      updateLockfilePublishConfig(cwd, { deckSlug })
      deckItemId = result.id
      published++
    } catch (err) {
      console.log(`  [${itemIndex}/${totalItems}] ${red("✗")} deck ${dim(deckSlug)}: ${err.message}`)
      failed++
    }

    console.log()
    console.log(`  ${bold("Done:")} ${green(`${published} published`)}${skipped ? `, ${skipped} unchanged` : ""}${failed ? `, ${red(`${failed} failed`)}` : ""}`)
    if (auth.organizationSlug && deckItemId) {
      console.log(`  View: ${cyan(`${auth.registry}/${auth.organizationSlug}/items/${deckItemId}`)}`)
    }
    console.log(`  Install: ${cyan(`promptslide add ${deckSlug}`)}`)
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
  const baseSlug = fileName.replace(/\.tsx?$/, "")

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

  // Prompt for deck prefix (required)
  const deckPrefix = await promptDeckPrefix(cwd, true)
  const slug = `${deckPrefix}/${baseSlug}`

  // Persist prefix for next time
  updateLockfilePublishConfig(cwd, { deckPrefix })

  console.log(`  Slug: ${cyan(slug)}`)
  console.log()

  // Warn if same base slug exists under a different prefix
  try {
    const { items: results } = await searchRegistry({ search: baseSlug, type }, auth)
    const conflicts = (results || []).filter(r => r.name !== slug && r.name.endsWith(`/${baseSlug}`))
    if (conflicts.length) {
      console.log(`  ${bold("Note:")} ${baseSlug} also exists as:`)
      for (const c of conflicts) {
        console.log(`    ${dim("·")} ${c.name} ${dim(`(${c.title || "untitled"})`)}`)
      }
      console.log()
    }
  } catch {
    // Search failure is non-blocking
  }

  // Check if registry dependencies exist and offer to publish missing ones
  if (registryDeps.length) {
    const missing = []

    for (const depSlug of registryDeps) {
      const prefixedDepSlug = `${deckPrefix}/${depSlug}`
      const exists = await registryItemExists(prefixedDepSlug, auth)
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
                interactive: true,
                deckPrefix
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

      console.log(`  ${dim("─── Main item:")} ${bold(baseSlug)} ${dim("───")}`)
      console.log()
    }
  }

  // Collect metadata for main item
  const title = await prompt("Title:", titleCase(baseSlug))
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
  const prefixedRegistryDeps = registryDeps.map(d => `${deckPrefix}/${d}`)
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
    registryDependencies: prefixedRegistryDeps.length ? prefixedRegistryDeps : undefined,
    releaseNotes: releaseNotes || undefined,
    previewImage: previewImage || undefined
  }

  try {
    const result = await publishToRegistry(payload, auth)
    const verTag = result.version ? ` v${result.version}` : ""
    console.log(`  ${green("✓")} Published ${bold(slug)}${verTag} to ${auth.organizationName || "registry"}`)
    console.log(`  Status: ${result.status || "published"}`)
    if (auth.organizationSlug && result.id) {
      console.log(`  View: ${cyan(`${auth.registry}/${auth.organizationSlug}/items/${result.id}`)}`)
    }
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
