import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join, dirname, resolve, sep } from "node:path"

import { bold, green, cyan, red, dim } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import {
  fetchRegistryItem,
  resolveRegistryDependencies,
  detectPackageManager,
  getInstallCommand,
  updateLockfileItem,
  updateLockfilePublishConfig,
  hashContent,
  hashFile
} from "../utils/registry.mjs"
import {
  toPascalCase,
  deriveImportPath,
  addSlideToDeckConfig,
  replaceDeckConfig
} from "../utils/deck-config.mjs"
import { confirm, closePrompts } from "../utils/prompts.mjs"

export async function add(args) {
  const cwd = process.cwd()

  console.log()
  console.log(`  ${bold("promptslide")} ${dim("add")}`)
  console.log()

  const name = args[0]
  if (!name || name === "--help" || name === "-h") {
    console.log(`  ${bold("Usage:")} promptslide add ${dim("<name|url>")}`)
    console.log()
    console.log(`  Install a slide, layout, deck, or theme from the registry.`)
    console.log()
    console.log(`  ${bold("Examples:")}`)
    console.log(`    promptslide add slide-hero-gradient`)
    console.log(`    promptslide add deck-pitch`)
    console.log(`    promptslide add https://custom-registry.com/r/my-slide.json`)
    console.log()
    process.exit(0)
  }

  const auth = requireAuth()

  // Fetch registry item
  let item
  try {
    item = await fetchRegistryItem(name, auth)
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

  const versionTag = item.version ? ` ${dim(`v${item.version}`)}` : ""
  console.log(`  Found ${bold(item.title || item.name)} ${dim(`(${item.type})`)}${versionTag}`)

  // Resolve dependencies
  let resolved
  try {
    resolved = await resolveRegistryDependencies(item, auth, cwd)
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

  // Write files, grouped by registry item for lockfile tracking
  const written = []
  const writtenByItem = new Map() // regItem.name -> { regItem, fileHashes }

  for (const regItem of resolved.items) {
    if (!regItem.files?.length) continue

    const fileHashes = {}

    for (const file of regItem.files) {
      const targetPath = resolve(cwd, file.target, file.path)
      if (!targetPath.startsWith(cwd + sep)) {
        console.log(`  ${red("Error:")} Invalid file path: ${file.target}${file.path}`)
        continue
      }
      const targetDir = dirname(targetPath)
      const relativePath = file.target + file.path
      const newHash = hashContent(file.content)

      if (existsSync(targetPath)) {
        // For binary files (data URIs), compare decoded bytes directly
        const dataUriMatch = file.content.match(/^data:[^;]+;base64,/)
        let identical
        if (dataUriMatch) {
          const newBuf = Buffer.from(file.content.slice(dataUriMatch[0].length), "base64")
          const existingBuf = readFileSync(targetPath)
          identical = newBuf.equals(existingBuf)
        } else {
          identical = hashFile(targetPath) === newHash
        }
        if (identical) {
          console.log(`  ${dim("Skipped")} ${relativePath} ${dim("(identical)")}`)
          fileHashes[relativePath] = newHash
          continue
        }
        const overwrite = await confirm(`  Overwrite ${relativePath}? ${dim("(local changes will be lost)")}`, false)
        if (!overwrite) {
          console.log(`  ${dim("Skipped")} ${relativePath}`)
          continue
        }
      }

      mkdirSync(targetDir, { recursive: true })
      const dataUriPrefix = file.content.match(/^data:[^;]+;base64,/)
      if (dataUriPrefix) {
        writeFileSync(targetPath, Buffer.from(file.content.slice(dataUriPrefix[0].length), "base64"))
      } else {
        writeFileSync(targetPath, file.content, "utf-8")
      }
      fileHashes[relativePath] = newHash
      written.push({ item: regItem, file })
      console.log(`  ${green("✓")} Added ${cyan(relativePath)}${regItem !== item ? dim(" (dependency)") : ""}`)
    }

    if (Object.keys(fileHashes).length > 0) {
      writtenByItem.set(regItem.name, { regItem, fileHashes })
    }
  }

  if (written.length === 0 && writtenByItem.size === 0) {
    console.log(`  ${dim("All files already exist. Nothing to add.")}`)
    console.log()
    closePrompts()
    return
  }

  // Update lockfile for all items (root + dependencies)
  for (const [name, { regItem, fileHashes }] of writtenByItem) {
    updateLockfileItem(cwd, name, regItem.version ?? 0, fileHashes)
  }

  // Persist deck slug for future pull/publish if this is a deck
  if (item.type === "deck") {
    const prefix = item.name.split("/")[0]
    updateLockfilePublishConfig(cwd, { deckSlug: item.name, deckPrefix: prefix })
  }

  // Auto-update deck-config.ts
  if (item.type === "slide") {
    for (const { file } of written.filter(w => w.file.target.includes("slides"))) {
      const componentName = toPascalCase(file.path.replace(/\.tsx?$/, ""))
      const importPath = deriveImportPath(file.target, file.path)
      const steps = item.meta?.steps ?? 0
      const updated = addSlideToDeckConfig(cwd, { componentName, importPath, steps })
      if (updated) {
        console.log(`  ${green("✓")} Updated ${cyan("deck-config.ts")} ${dim(`(${componentName}, steps: ${steps})`)}`)
      }
    }
  } else if (item.type === "deck" && item.meta?.slides) {
    const shouldReplace = await confirm("  Replace entire deck-config.ts with this deck?", true)
    if (shouldReplace) {
      const slides = item.meta.slides.map(s => ({
        componentName: toPascalCase(s.slug),
        importPath: `@/slides/${s.slug}`,
        steps: s.steps,
        section: s.section
      }))
      replaceDeckConfig(cwd, slides, {
        transition: item.meta.transition,
        directionalTransition: item.meta.directionalTransition
      })
      console.log(`  ${green("✓")} Replaced ${cyan("deck-config.ts")} ${dim(`(${slides.length} slides)`)}`)
    } else {
      // Append individual slides
      for (const s of item.meta.slides) {
        const componentName = toPascalCase(s.slug)
        const importPath = `@/slides/${s.slug}`
        const updated = addSlideToDeckConfig(cwd, { componentName, importPath, steps: s.steps })
        if (updated) {
          console.log(`  ${green("✓")} Added ${componentName} to ${cyan("deck-config.ts")}`)
        }
      }
    }
  }

  // Install npm dependencies
  const existingPkg = join(cwd, "package.json")
  if (Object.keys(resolved.npmDeps).length > 0 && existsSync(existingPkg)) {
    const pm = detectPackageManager(cwd)
    const pkgList = Object.entries(resolved.npmDeps).map(([name, ver]) => `${name}@${ver}`)
    const { cmd, args, display } = getInstallCommand(pm, pkgList)
    console.log()
    console.log(`  ${dim(`Installing dependencies: ${display}`)}`)
    try {
      execFileSync(cmd, args, { cwd, stdio: "inherit" })
      console.log(`  ${green("✓")} Dependencies installed`)
    } catch {
      console.log(`  ${red("⚠")} Dependency installation failed. Run manually:`)
      console.log(`    ${display}`)
    }
  }

  console.log()
  closePrompts()
}
