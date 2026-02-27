#!/usr/bin/env node

import { existsSync, cpSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createInterface } from "node:readline"

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
    console.log(`  Scaffolds a new PowerVibe slide deck project.`)
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

  console.log()

  // 3. Copy template
  if (!existsSync(TEMPLATE_DIR)) {
    console.error(`  ${red("Error:")} Template directory not found at ${TEMPLATE_DIR}`)
    process.exit(1)
  }

  cpSync(TEMPLATE_DIR, targetDir, { recursive: true })

  // 4. Replace placeholders
  const replacements = [
    {
      path: join(targetDir, "package.json"),
      values: { "{{PROJECT_SLUG}}": dirName, "{{PROJECT_NAME}}": projectName }
    },
    {
      path: join(targetDir, "deck.config.ts"),
      values: { "{{PROJECT_NAME}}": projectName }
    },
    {
      path: join(targetDir, "src", "slides", "slide-title.tsx"),
      values: { "{{PROJECT_NAME}}": projectName }
    }
  ]

  for (const { path, values } of replacements) {
    replaceInFile(path, values)
  }

  // 5. Success output
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
