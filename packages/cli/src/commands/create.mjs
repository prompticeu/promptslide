import { execSync } from "node:child_process"
import { existsSync, cpSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { bold, green, cyan, red, dim } from "../utils/ansi.mjs"
import { hexToOklch, hexToOklchDark, isValidHex } from "../utils/colors.mjs"
import { prompt, confirm, closePrompts } from "../utils/prompts.mjs"
import { ensureTsConfig } from "../utils/tsconfig.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLI_ROOT = join(__dirname, "..", "..")
const TEMPLATE_DIR = join(CLI_ROOT, "templates", "default")

/**
 * Detect if we're running from a local dev/linked install (monorepo).
 * If so, return absolute paths to the local packages so scaffolded
 * projects can resolve them without npm publish.
 */
function getLocalPackagePaths() {
  try {
    const monoRoot = resolve(CLI_ROOT, "..", "..")
    const cliPkg = join(monoRoot, "packages", "cli", "package.json")

    if (existsSync(cliPkg)) {
      const pkg = JSON.parse(readFileSync(cliPkg, "utf-8"))
      if (pkg.name === "promptslide") {
        return {
          cli: resolve(monoRoot, "packages", "cli")
        }
      }
    }
  } catch {}
  return null
}

function titleCase(slug) {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function isValidDirName(name) {
  return /^[a-zA-Z0-9._-]+$/.test(name)
}

function replaceInFile(filePath, replacements) {
  let content = readFileSync(filePath, "utf-8")
  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, value)
  }
  writeFileSync(filePath, content, "utf-8")
}

export async function create(args) {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim("create")}`)
  console.log()

  // Parse flags
  const useDefaults = args.includes("--yes") || args.includes("-y")
  const filteredArgs = args.filter(a => a !== "--yes" && a !== "-y")

  // 1. Parse directory name from args or prompt
  let dirName = filteredArgs[0]

  if (dirName === "--help" || dirName === "-h") {
    console.log(`  ${bold("Usage:")} promptslide create ${dim("<project-directory>")} ${dim("[options]")}`)
    console.log()
    console.log(`  Scaffolds a new PromptSlide slide deck project.`)
    console.log()
    console.log(`  ${bold("Options:")}`)
    console.log(`    -y, --yes    Skip prompts and use defaults`)
    console.log()
    console.log(`  ${bold("Example:")}`)
    console.log(`    promptslide create my-pitch-deck`)
    console.log(`    promptslide create my-pitch-deck --yes`)
    console.log()
    process.exit(0)
  }

  if (!dirName) {
    if (useDefaults) {
      console.error(`  ${red("Error:")} Please provide a project directory name when using --yes.`)
      process.exit(1)
    }
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
  const projectName = useDefaults ? defaultName : await prompt("Project name:", defaultName)

  // 3. Ask for primary brand color (optional)
  let primaryHex = "#3B82F6"
  if (!useDefaults) {
    primaryHex = await prompt("Primary brand color (hex):", "#3B82F6")
    if (!isValidHex(primaryHex)) {
      console.log(`  ${dim("Invalid hex color, using default #3B82F6")}`)
      primaryHex = "#3B82F6"
    }
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
      path: join(targetDir, "src", "theme.ts"),
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

  // 6. If running from local dev, rewrite deps to use file: paths
  const localPaths = getLocalPackagePaths()
  if (localPaths) {
    const pkgPath = join(targetDir, "package.json")
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
    pkg.dependencies["promptslide"] = `file:${localPaths.cli}`
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8")
    console.log(`  ${dim("Local dev detected — using file: paths for packages")}`)
  }

  // 7. Generate tsconfig.json for editor support
  ensureTsConfig(targetDir)

  // 8. Install PromptSlide agent skill (skip when using defaults — skill is likely already installed)
  const installSkill = useDefaults ? false : await confirm("Install PromptSlide agent skill?")

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
      console.log(`  ${red("⚠")} Skill installation failed. You can install it later with:`)
      console.log(`    npx skills add prompticeu/promptslide`)
    }
  }

  // 9. Success output
  console.log()
  console.log(`  ${green("✓")} Created ${bold(projectName)} in ${cyan(dirName)}/`)
  console.log()
  console.log(`  ${bold("Next steps:")}`)
  console.log()
  console.log(`    cd ${dirName}`)
  console.log(`    bun install`)
  console.log(`    bun run dev`)
  console.log()
  console.log(`  Then open your coding agent and start building slides!`)
  console.log(`  The agent will read ${cyan("AGENTS.md")} to understand the framework.`)
  console.log()

  closePrompts()
}
