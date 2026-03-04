import { writeFileSync } from "node:fs"
import { resolve, basename } from "node:path"

import { bold, green, red, dim } from "../utils/ansi.mjs"
import { captureSlideScreenshot, isPlaywrightAvailable } from "../utils/export.mjs"

export async function toImage(args) {
  const slidePath = args[0]
  const outputIndex = args.indexOf("-o")
  const output = outputIndex !== -1 ? args[outputIndex + 1] : null

  if (!slidePath || slidePath === "--help" || slidePath === "-h") {
    console.log()
    console.log(`  ${bold("Usage:")} promptslide to-image <slide> [options]`)
    console.log()
    console.log(`  ${bold("Options:")}`)
    console.log(`    -o <file>  Output file path (default: <slide-name>.png)`)
    console.log()
    console.log(`  ${bold("Examples:")}`)
    console.log(`    ${dim("promptslide to-image src/slides/slide-title.tsx")}`)
    console.log(`    ${dim("promptslide to-image src/slides/slide-title.tsx -o preview.png")}`)
    console.log()
    return
  }

  if (!(await isPlaywrightAvailable())) {
    console.error()
    console.error(`  ${red("Error:")} Playwright is required for image export.`)
    console.error(`  Install it with: ${bold("npm install -D playwright && npx playwright install chromium")}`)
    console.error()
    process.exit(1)
  }

  const outputPath = resolve(output || `${basename(slidePath).replace(/\.tsx?$/, "")}.png`)

  console.log()
  console.log(`  ${dim("Capturing screenshot...")}`)

  const buffer = await captureSlideScreenshot({
    cwd: process.cwd(),
    slidePath
  })

  if (!buffer) {
    console.error(`  ${red("Error:")} Failed to capture screenshot.`)
    process.exit(1)
  }

  writeFileSync(outputPath, buffer)
  console.log(`  ${green("✓")} Saved to ${bold(outputPath)}`)
  console.log()
}
