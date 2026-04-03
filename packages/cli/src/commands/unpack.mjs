/**
 * promptslide unpack — Extract a .promptslide file to a local project.
 *
 * Usage: promptslide unpack <file.promptslide> [--output directory]
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, resolve, dirname } from "node:path"

import { bold, green, cyan, dim, red } from "../utils/ansi.mjs"

export async function unpack(args) {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim("unpack")}`)
  console.log()

  const inputFile = args[0]
  if (!inputFile || !existsSync(resolve(inputFile))) {
    console.error(`  ${red("Error:")} Please provide a .promptslide file`)
    process.exit(1)
  }

  const filePath = resolve(inputFile)
  let pkg
  try {
    pkg = JSON.parse(readFileSync(filePath, "utf-8"))
  } catch {
    console.error(`  ${red("Error:")} Invalid .promptslide file`)
    process.exit(1)
  }

  if (!pkg.format?.startsWith("promptslide/")) {
    console.error(`  ${red("Error:")} Not a valid .promptslide package (missing format field)`)
    process.exit(1)
  }

  const slug = pkg.slug || "unpacked-deck"
  const outputIdx = args.indexOf("--output")
  const outputDir = outputIdx >= 0 && args[outputIdx + 1]
    ? resolve(args[outputIdx + 1])
    : resolve(slug)

  if (existsSync(outputDir)) {
    console.error(`  ${red("Error:")} Directory "${outputDir}" already exists. Remove it first or use --output.`)
    process.exit(1)
  }

  console.log(`  Unpacking ${bold(pkg.name || slug)}...`)

  mkdirSync(outputDir, { recursive: true })

  let filesWritten = 0
  for (const file of (pkg.files || [])) {
    if (!file.path || !file.content) continue

    const targetPath = join(outputDir, file.path)
    mkdirSync(dirname(targetPath), { recursive: true })

    // Handle data URI content (binary files)
    if (file.content.startsWith("data:")) {
      const match = file.content.match(/^data:[^;]+;base64,(.+)$/)
      if (match) {
        writeFileSync(targetPath, Buffer.from(match[1], "base64"))
        filesWritten++
        continue
      }
    }

    // Text content
    writeFileSync(targetPath, file.content, "utf-8")
    filesWritten++
  }

  // Ensure globals.css exists
  const globalsPath = join(outputDir, "src", "globals.css")
  if (!existsSync(globalsPath)) {
    mkdirSync(join(outputDir, "src"), { recursive: true })
    writeFileSync(globalsPath, '@import "tailwindcss";\n')
  }

  console.log(`  ${green("✓")} Unpacked ${filesWritten} files`)
  console.log(`  ${cyan(outputDir)}`)
  console.log()
  console.log(`  ${dim("Next steps:")}`)
  console.log(`    cd ${slug}`)
  console.log(`    promptslide dev`)
  console.log()
}
