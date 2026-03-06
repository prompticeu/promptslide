import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join, dirname, resolve, sep } from "node:path"

import { bold, green, cyan, red, yellow, dim } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import {
  fetchRegistryItem,
  resolveRegistryDependencies,
  detectPackageManager,
  getInstallCommand,
  readLockfile,
  updateLockfileItem,
  hashContent,
  hashFile,
  isFileDirty
} from "../utils/registry.mjs"
import {
  toPascalCase,
  addSlideToDeckConfig,
  replaceDeckConfig
} from "../utils/deck-config.mjs"
import { confirm, closePrompts } from "../utils/prompts.mjs"

export async function pull(args) {
  const cwd = process.cwd()

  console.log()
  console.log(`  ${bold("promptslide")} ${dim("pull")}`)
  console.log()

  if (args[0] === "--help" || args[0] === "-h") {
    console.log(`  ${bold("Usage:")} promptslide pull ${dim("[--force]")}`)
    console.log()
    console.log(`  Pull the latest version of your deck from the registry.`)
    console.log(`  Reads the deck slug from the lockfile (set during publish).`)
    console.log()
    console.log(`  ${bold("Options:")}`)
    console.log(`    --force    Overwrite locally modified files without prompting`)
    console.log()
    process.exit(0)
  }

  const force = args.includes("--force")
  const auth = requireAuth()

  // Read deckSlug from lockfile
  const lock = readLockfile(cwd)
  const deckSlug = lock.deckSlug

  if (!deckSlug) {
    console.error(`  ${red("Error:")} No deck slug found in lockfile.`)
    console.error(`  ${dim("Run")} ${cyan("promptslide publish --type deck")} ${dim("first to set it.")}`)
    console.log()
    process.exit(1)
  }

  console.log(`  Pulling deck ${bold(deckSlug)}...`)
  console.log()

  // Fetch the deck manifest from the registry
  let deckItem
  try {
    deckItem = await fetchRegistryItem(deckSlug, auth)
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

  const versionTag = deckItem.version ? ` ${dim(`v${deckItem.version}`)}` : ""
  console.log(`  Found ${bold(deckItem.title || deckItem.name)} ${dim(`(${deckItem.type})`)}${versionTag}`)

  // Resolve all dependencies (slides, layouts, themes, assets)
  let resolved
  try {
    resolved = await resolveRegistryDependencies(deckItem, auth, cwd)
  } catch (err) {
    console.error(`  ${red("Error resolving dependencies:")} ${err.message}`)
    process.exit(1)
  }

  const itemCount = resolved.items.length
  const fileCount = resolved.items.reduce((sum, i) => sum + (i.files?.length || 0), 0)
  console.log(`  Resolved ${bold(String(itemCount))} items with ${bold(String(fileCount))} files`)
  console.log()

  // Write files
  const written = []
  const writtenByItem = new Map()

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
        // Check if content is identical
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
          fileHashes[relativePath] = newHash
          continue
        }

        // Check if file has local modifications
        const lockEntry = lock.items[regItem.name]
        const storedHash = lockEntry?.files?.[relativePath]
        if (!force) {
          if (storedHash && isFileDirty(cwd, relativePath, storedHash)) {
            // File was tracked and has been locally modified
            const overwrite = await confirm(
              `  ${yellow("!")} ${relativePath} has local changes. Overwrite?`,
              false
            )
            if (!overwrite) {
              fileHashes[relativePath] = storedHash
              console.log(`  ${dim("Skipped")} ${relativePath}`)
              continue
            }
          } else if (!storedHash) {
            // File exists but not in lockfile (first pull or untracked)
            const overwrite = await confirm(`  Overwrite ${relativePath}? ${dim("(local changes will be lost)")}`, false)
            if (!overwrite) {
              console.log(`  ${dim("Skipped")} ${relativePath}`)
              continue
            }
          }
        }
      }

      // Write the file
      mkdirSync(targetDir, { recursive: true })
      const dataUriPrefix = file.content.match(/^data:[^;]+;base64,/)
      if (dataUriPrefix) {
        writeFileSync(targetPath, Buffer.from(file.content.slice(dataUriPrefix[0].length), "base64"))
      } else {
        writeFileSync(targetPath, file.content, "utf-8")
      }
      fileHashes[relativePath] = newHash
      written.push({ item: regItem, file })
      console.log(`  ${green("+")} ${cyan(relativePath)}`)
    }

    if (Object.keys(fileHashes).length > 0) {
      writtenByItem.set(regItem.name, { regItem, fileHashes })
    }
  }

  // Update lockfile for all resolved items
  for (const [name, { regItem, fileHashes }] of writtenByItem) {
    updateLockfileItem(cwd, name, regItem.version ?? 0, fileHashes)
  }

  // Also update the deck manifest entry itself (has no files)
  updateLockfileItem(cwd, deckSlug, deckItem.version ?? 0, {})

  // Update deck-config.ts
  if (deckItem.type === "deck" && deckItem.meta?.slides) {
    const shouldReplace = await confirm("  Replace deck-config.ts with pulled deck config?", true)
    if (shouldReplace) {
      const slides = deckItem.meta.slides.map(s => ({
        componentName: toPascalCase(s.slug),
        importPath: `@/slides/${s.slug}`,
        steps: s.steps,
        section: s.section
      }))
      replaceDeckConfig(cwd, slides, {
        transition: deckItem.meta.transition,
        directionalTransition: deckItem.meta.directionalTransition
      })
      console.log(`  ${green("+")} Replaced ${cyan("deck-config.ts")} ${dim(`(${slides.length} slides)`)}`)
    } else {
      // Append individual slides
      for (const s of deckItem.meta.slides) {
        const componentName = toPascalCase(s.slug)
        const importPath = `@/slides/${s.slug}`
        const updated = addSlideToDeckConfig(cwd, { componentName, importPath, steps: s.steps, section: s.section })
        if (updated) {
          console.log(`  ${green("+")} Added ${componentName} to ${cyan("deck-config.ts")}`)
        }
      }
    }
  }

  // Install npm dependencies
  if (Object.keys(resolved.npmDeps).length > 0 && existsSync(join(cwd, "package.json"))) {
    const pm = detectPackageManager(cwd)
    const pkgList = Object.entries(resolved.npmDeps).map(([name, ver]) => `${name}@${ver}`)
    const { cmd, args: installArgs, display } = getInstallCommand(pm, pkgList)
    console.log()
    console.log(`  ${dim(`Installing dependencies: ${display}`)}`)
    try {
      execFileSync(cmd, installArgs, { cwd, stdio: "inherit" })
      console.log(`  ${green("+")} Dependencies installed`)
    } catch {
      console.log(`  ${red("!")} Dependency installation failed. Run manually:`)
      console.log(`    ${display}`)
    }
  }

  // Summary
  console.log()
  if (written.length === 0) {
    console.log(`  ${green("+")} Everything is up to date.`)
  } else {
    console.log(`  ${green("+")} Pulled ${bold(String(written.length))} file(s) from ${bold(deckSlug)}`)
  }
  console.log()
  closePrompts()
}
