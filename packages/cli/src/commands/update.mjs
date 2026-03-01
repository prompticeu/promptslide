import { existsSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname, resolve, sep } from "node:path"

import { bold, green, cyan, red, dim, yellow } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { fetchRegistryItem, readLockfile, updateLockfileItem, isFileDirty, hashContent } from "../utils/registry.mjs"
import { confirm, closePrompts } from "../utils/prompts.mjs"

export async function update(args) {
  const cwd = process.cwd()

  console.log()
  console.log(`  ${bold("promptslide")} ${dim("update")}`)
  console.log()

  if (args[0] === "--help" || args[0] === "-h") {
    console.log(`  ${bold("Usage:")} promptslide update ${dim("[name] [--all]")}`)
    console.log()
    console.log(`  Check for and apply updates to installed registry items.`)
    console.log()
    console.log(`  ${bold("Examples:")}`)
    console.log(`    promptslide update              ${dim("Check for available updates")}`)
    console.log(`    promptslide update slide-hero    ${dim("Update a specific item")}`)
    console.log(`    promptslide update --all         ${dim("Update all outdated items")}`)
    console.log()
    process.exit(0)
  }

  const auth = requireAuth()
  const lock = readLockfile(cwd)
  const slugs = Object.keys(lock.items)

  if (slugs.length === 0) {
    console.log(`  ${dim("No installed items found.")}`)
    console.log(`  ${dim("Install items with")} ${cyan("promptslide add <name>")} ${dim("first.")}`)
    console.log()
    process.exit(0)
  }

  const updateAll = args.includes("--all")
  const targetSlug = args.find(a => !a.startsWith("--"))

  // Fetch latest versions for all installed items
  console.log(`  ${dim("Checking")} ${slugs.length} ${dim("installed item(s)...")}`)
  console.log()

  const updates = []

  for (const slug of slugs) {
    const installed = lock.items[slug]
    try {
      const latest = await fetchRegistryItem(slug, auth)
      const latestVersion = latest.version ?? 0
      // Version 0 means "unversioned at install time" — always outdated if registry has a real version
      const outdated = installed.version === 0
        ? latestVersion >= 1
        : latestVersion > installed.version

      updates.push({
        slug,
        installed: installed.version,
        latest: latestVersion,
        outdated,
        item: outdated ? latest : null,
        storedFiles: installed.files
      })
    } catch {
      updates.push({
        slug,
        installed: installed.version,
        latest: "?",
        outdated: false,
        item: null,
        error: true
      })
    }
  }

  // Print table
  const nameWidth = Math.max(6, ...updates.map(u => u.slug.length)) + 2

  console.log(`  ${bold("Name".padEnd(nameWidth))}  ${bold("Installed")}  ${bold("Latest")}  ${bold("Status")}`)
  console.log(`  ${"─".repeat(nameWidth)}  ${"─".repeat(9)}  ${"─".repeat(6)}  ${"─".repeat(10)}`)

  for (const u of updates) {
    const name = u.slug.padEnd(nameWidth)
    const inst = `v${u.installed}`.padEnd(9)
    const lat = (typeof u.latest === "number" ? `v${u.latest}` : u.latest).padEnd(6)
    const status = u.error
      ? red("error")
      : u.outdated
        ? cyan("update available")
        : green("up to date")
    console.log(`  ${name}  ${inst}  ${lat}  ${status}`)
  }

  console.log()

  const outdated = updates.filter(u => u.outdated && u.item)

  if (outdated.length === 0) {
    console.log(`  ${green("✓")} All items are up to date.`)
    console.log()
    closePrompts()
    return
  }

  // Determine which items to update
  let toUpdate = []

  if (targetSlug) {
    const match = outdated.find(u => u.slug === targetSlug)
    if (!match) {
      const exists = updates.find(u => u.slug === targetSlug)
      if (exists && !exists.outdated) {
        console.log(`  ${green("✓")} ${bold(targetSlug)} is already up to date.`)
      } else if (!exists) {
        console.log(`  ${red("Error:")} ${bold(targetSlug)} is not installed.`)
      }
      console.log()
      closePrompts()
      return
    }
    toUpdate = [match]
  } else if (updateAll) {
    toUpdate = outdated
  } else {
    console.log(`  ${bold(`${outdated.length}`)} update(s) available.`)
    console.log(`  Run ${cyan("promptslide update --all")} or ${cyan("promptslide update <name>")} to apply.`)
    console.log()
    closePrompts()
    return
  }

  // Apply updates
  for (const u of toUpdate) {
    const item = u.item
    console.log(`  Updating ${bold(u.slug)} ${dim(`v${u.installed} → v${u.latest}`)}...`)

    if (!item.files?.length) {
      console.log(`  ${dim("No files to write, skipping.")}`)
      continue
    }

    const fileHashes = {}

    for (const file of item.files) {
      const targetPath = resolve(cwd, file.target, file.path)
      if (!targetPath.startsWith(cwd + sep)) {
        console.log(`  ${red("Error:")} Invalid file path: ${file.target}${file.path}`)
        continue
      }
      const targetDir = dirname(targetPath)
      const relativePath = file.target + file.path
      const newHash = hashContent(file.content)

      // Check for local modifications
      if (existsSync(targetPath) && u.storedFiles[relativePath]) {
        const dirty = isFileDirty(cwd, relativePath, u.storedFiles[relativePath])
        if (dirty) {
          const overwrite = await confirm(
            `  ${yellow("⚠")} ${relativePath} has local changes. Overwrite?`,
            false
          )
          if (!overwrite) {
            // Carry forward old hash so lockfile stays accurate
            fileHashes[relativePath] = u.storedFiles[relativePath]
            console.log(`  ${dim("Skipped")} ${relativePath}`)
            continue
          }
        }
      }

      mkdirSync(targetDir, { recursive: true })
      writeFileSync(targetPath, file.content, "utf-8")
      fileHashes[relativePath] = newHash
      console.log(`  ${green("✓")} Updated ${cyan(relativePath)}`)
    }

    updateLockfileItem(cwd, u.slug, u.latest, fileHashes)
  }

  console.log()
  console.log(`  ${green("✓")} ${toUpdate.length} item(s) updated.`)
  console.log()
  closePrompts()
}
