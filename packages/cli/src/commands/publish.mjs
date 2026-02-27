import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, basename, relative } from "node:path"

import { bold, green, cyan, red, dim } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { publishToRegistry } from "../utils/registry.mjs"
import { prompt, closePrompts } from "../utils/prompts.mjs"

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

  // Resolve full path
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

  // Collect metadata
  const title = await prompt("Title:", titleCase(slug))
  const description = await prompt("Description:", "")
  const tagsInput = await prompt("Tags (comma-separated):", "")
  const tags = tagsInput ? tagsInput.split(",").map(t => t.trim()).filter(Boolean) : []
  const section = await prompt("Section:", "")

  console.log()

  // Publish
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
    registryDependencies: registryDeps.length ? registryDeps : undefined
  }

  try {
    const result = await publishToRegistry(payload, auth)
    console.log(`  ${green("✓")} Published ${bold(slug)} to ${auth.organizationName || "registry"}`)
    console.log(`  Status: ${result.status || "published"}`)
    console.log(`  Install: ${cyan(`promptslide add ${slug}`)}`)
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

  console.log()
  closePrompts()
}
