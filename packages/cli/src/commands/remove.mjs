import { existsSync, unlinkSync } from "node:fs"
import { join } from "node:path"

import { bold, green, cyan, red, yellow, dim } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { readLockfile, removeLockfileItem, fetchRegistryItem, isFileDirty } from "../utils/registry.mjs"
import { toPascalCase, removeSlideFromDeckConfig } from "../utils/deck-config.mjs"
import { confirm, closePrompts } from "../utils/prompts.mjs"

export async function remove(args) {
  const cwd = process.cwd()

  console.log()
  console.log(`  ${bold("promptslide")} ${dim("remove")}`)
  console.log()

  const name = args[0]
  if (!name || name === "--help" || name === "-h") {
    console.log(`  ${bold("Usage:")} promptslide remove ${dim("<name>")}`)
    console.log()
    console.log(`  Remove an installed slide, layout, or deck.`)
    console.log()
    console.log(`  ${bold("Examples:")}`)
    console.log(`    promptslide remove slide-hero-gradient`)
    console.log(`    promptslide remove deck-pitch`)
    console.log()
    process.exit(0)
  }

  // Check lockfile
  const lock = readLockfile(cwd)
  if (!lock.items[name]) {
    console.error(`  ${red("Error:")} "${name}" is not installed (not found in lockfile).`)
    console.log()
    process.exit(1)
  }

  const lockEntry = lock.items[name]

  // Use lockfile file hashes if available, otherwise fall back to registry
  const auth = requireAuth()
  let item = null
  try {
    item = await fetchRegistryItem(name, auth)
  } catch {
    // Item may have been deleted from registry — that's fine, we'll just remove the lockfile entry
  }

  const filesToRemove = []
  let hasDirtyFiles = false

  if (item?.files?.length) {
    for (const file of item.files) {
      const targetPath = join(cwd, file.target, file.path)
      const relativePath = file.target + file.path
      if (existsSync(targetPath)) {
        const dirty = lockEntry.files?.[relativePath]
          ? isFileDirty(cwd, relativePath, lockEntry.files[relativePath])
          : false
        if (dirty) hasDirtyFiles = true
        filesToRemove.push({ path: targetPath, display: relativePath, dirty })
      }
    }
  }

  // Show what will be removed
  if (filesToRemove.length > 0) {
    console.log(`  Files to remove:`)
    for (const f of filesToRemove) {
      const tag = f.dirty ? ` ${yellow("(modified)")}` : ""
      console.log(`    ${dim("•")} ${f.display}${tag}`)
    }
    console.log()
  } else if (item) {
    console.log(`  ${dim("No local files found for this item.")}`)
    console.log()
  } else {
    console.log(`  ${dim("Item not found in registry. Removing lockfile entry only.")}`)
    console.log()
  }

  const confirmMsg = hasDirtyFiles
    ? `Remove ${bold(name)}? ${yellow("Some files have local changes that will be lost.")}`
    : `Remove ${bold(name)}?`
  const ok = await confirm(confirmMsg, !hasDirtyFiles)
  if (!ok) {
    console.log(`  ${dim("Cancelled.")}`)
    console.log()
    closePrompts()
    return
  }

  // Delete files
  let removed = 0
  for (const f of filesToRemove) {
    try {
      unlinkSync(f.path)
      console.log(`  ${green("✓")} Removed ${cyan(f.display)}`)
      removed++
    } catch (err) {
      console.log(`  ${red("⚠")} Could not remove ${f.display}: ${err.message}`)
    }
  }

  // Remove from deck-config if it's a slide
  if (item?.type === "slide" && item.files?.length) {
    for (const file of item.files) {
      if (file.target.includes("slides")) {
        const componentName = toPascalCase(file.path.replace(/\.tsx?$/, ""))
        const updated = removeSlideFromDeckConfig(cwd, componentName)
        if (updated) {
          console.log(`  ${green("✓")} Removed ${componentName} from ${cyan("deck-config.ts")}`)
        }
      }
    }
  }

  // Remove from lockfile
  removeLockfileItem(cwd, name)
  console.log(`  ${green("✓")} Removed from lockfile`)

  if (removed > 0) {
    console.log()
    console.log(`  ${dim(`Removed ${removed} file${removed === 1 ? "" : "s"}.`)}`)
  }

  console.log()
  closePrompts()
}
