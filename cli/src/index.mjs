#!/usr/bin/env node

import { existsSync, cpSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createInterface } from "node:readline"
import { execSync } from "node:child_process"

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------
const bold = (s) => `\x1b[1m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const cyan = (s) => `\x1b[36m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const TEMPLATE_DIR = join(__dirname, "..", "templates", "default")

function titleCase(slug) {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function isValidDirName(name) {
  return /^[a-zA-Z0-9._-]+$/.test(name)
}

function prompt(question, defaultValue) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` ${dim(`(${defaultValue})`)} ` : " "
    rl.question(`  ${question}${suffix}`, (answer) => {
      rl.close()
      resolve(answer.trim() || defaultValue || "")
    })
  })
}

function confirm(question, defaultYes = true) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    const hint = defaultYes ? "Y/n" : "y/N"
    rl.question(`  ${question} ${dim(`(${hint})`)} `, (answer) => {
      rl.close()
      const a = answer.trim().toLowerCase()
      if (!a) return resolve(defaultYes)
      resolve(a === "y" || a === "yes")
    })
  })
}

// ---------------------------------------------------------------------------
// Hex → OKLCH conversion (pure math, zero dependencies)
// ---------------------------------------------------------------------------
function hexToOklch(hex) {
  hex = hex.replace("#", "")
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  // sRGB → linear RGB
  const toLinear = (c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)

  // Linear RGB → LMS
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  // LMS → OKLAB
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  // OKLAB → OKLCH
  const C = Math.sqrt(a * a + bv * bv)
  let H = Math.atan2(bv, a) * (180 / Math.PI)
  if (H < 0) H += 360

  const round = (n, d = 3) => +n.toFixed(d)
  return `oklch(${round(L)} ${round(C)} ${round(H)})`
}

function hexToOklchDark(hex) {
  // Slightly lighter variant for dark mode (bump lightness by ~0.05)
  const oklch = hexToOklch(hex)
  const match = oklch.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/)
  const L = Math.min(1, parseFloat(match[1]) + 0.05)
  return `oklch(${+L.toFixed(3)} ${match[2]} ${match[3]})`
}

function isValidHex(hex) {
  return /^#?[0-9a-fA-F]{6}$/.test(hex)
}

function replaceInFile(filePath, replacements) {
  let content = readFileSync(filePath, "utf-8")
  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, value)
  }
  writeFileSync(filePath, content, "utf-8")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log()
  console.log(`  ${bold("create-slides")} ${dim("v0.1.0")}`)
  console.log()

  // 1. Parse directory name from argv or prompt
  let dirName = process.argv[2]

  if (dirName === "--help" || dirName === "-h") {
    console.log(`  ${bold("Usage:")} npx create-slides ${dim("<project-directory>")}`)
    console.log()
    console.log(`  Scaffolds a new PromptSlide slide deck project.`)
    console.log()
    console.log(`  ${bold("Example:")}`)
    console.log(`    npx create-slides my-pitch-deck`)
    console.log()
    process.exit(0)
  }

  if (!dirName) {
    dirName = await prompt("Project directory:")
  }

  if (!dirName) {
    console.error(`  ${red("Error:")} Please provide a project directory name.`)
    process.exit(1)
  }

  if (!isValidDirName(dirName)) {
    console.error(
      `  ${red("Error:")} Invalid directory name "${dirName}". Use only letters, numbers, hyphens, dots, and underscores.`
    )
    process.exit(1)
  }

  const targetDir = resolve(process.cwd(), dirName)

  if (existsSync(targetDir)) {
    console.error(`  ${red("Error:")} Directory "${dirName}" already exists.`)
    process.exit(1)
  }

  // 2. Ask for project/brand name
  const defaultName = titleCase(dirName)
  const projectName = await prompt("Project name:", defaultName)

  // 3. Ask for primary brand color (optional)
  let primaryHex = await prompt("Primary brand color (hex):", "#3B82F6")
  if (!isValidHex(primaryHex)) {
    console.log(`  ${dim("Invalid hex color, using default #3B82F6")}`)
    primaryHex = "#3B82F6"
  }

  console.log()

  // 4. Copy template
  if (!existsSync(TEMPLATE_DIR)) {
    console.error(`  ${red("Error:")} Template directory not found at ${TEMPLATE_DIR}`)
    process.exit(1)
  }

  cpSync(TEMPLATE_DIR, targetDir, { recursive: true })

  // 5. Replace placeholders
  const primaryOklch = hexToOklch(primaryHex)
  const primaryOklchDark = hexToOklchDark(primaryHex)

  const replacements = [
    {
      path: join(targetDir, "package.json"),
      values: { "{{PROJECT_SLUG}}": dirName, "{{PROJECT_NAME}}": projectName }
    },
    {
      path: join(targetDir, "index.html"),
      values: { "{{PROJECT_NAME}}": projectName }
    },
    {
      path: join(targetDir, "src", "App.tsx"),
      values: { "{{PROJECT_NAME}}": projectName }
    },
    {
      path: join(targetDir, "src", "slides", "slide-title.tsx"),
      values: { "{{PROJECT_NAME}}": projectName }
    },
    {
      path: join(targetDir, "README.md"),
      values: { "{{PROJECT_NAME}}": projectName }
    },
    {
      path: join(targetDir, "src", "globals.css"),
      values: {
        "{{PRIMARY_COLOR}}": primaryOklch,
        "{{PRIMARY_COLOR_DARK}}": primaryOklchDark
      }
    }
  ]

  for (const { path, values } of replacements) {
    replaceInFile(path, values)
  }

  // 6. Install PromptSlide agent skill
  const installSkill = await confirm("Install PromptSlide agent skill?")

  if (installSkill) {
    console.log()
    console.log(`  ${dim("Running: npx skills add prompticeu/promptslide")}`)
    try {
      execSync("npx skills add prompticeu/promptslide", {
        cwd: targetDir,
        stdio: "inherit"
      })
      console.log(`  ${green("✓")} PromptSlide skill installed`)
    } catch {
      console.log(
        `  ${red("⚠")} Skill installation failed. You can install it later with:`
      )
      console.log(`    npx skills add prompticeu/promptslide`)
    }
  }

  // 7. Success output
  console.log()
  console.log(`  ${green("✓")} Created ${bold(projectName)} in ${cyan(dirName)}/`)
  console.log()
  console.log(`  ${bold("Next steps:")}`)
  console.log()
  console.log(`    cd ${dirName}`)
  console.log(`    npm install`)
  console.log(`    npm run dev`)
  console.log()
  console.log(
    `  Then open your coding agent and start building slides!`
  )
  console.log(
    `  The agent will read ${cyan("AGENTS.md")} to understand the framework.`
  )
  console.log()
}

main().catch((err) => {
  console.error(`  ${red("Error:")} ${err.message}`)
  process.exit(1)
})
