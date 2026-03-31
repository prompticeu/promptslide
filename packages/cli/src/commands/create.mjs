import { execSync } from "node:child_process"
import { existsSync, cpSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { bold, green, cyan, red, dim, yellow } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { hexToOklch, isValidHex } from "../utils/colors.mjs"
import { prompt, confirm, closePrompts } from "../utils/prompts.mjs"
import { fetchRegistryItem, resolveRegistryDependencies, writeLockfile } from "../utils/registry.mjs"
import { toPascalCase, replaceDeckConfig } from "../utils/deck-config.mjs"
import { ensureTsConfig } from "../utils/tsconfig.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLI_ROOT = join(__dirname, "..", "..")
const TEMPLATE_DIR = join(CLI_ROOT, "templates", "default")
const CLI_VERSION = JSON.parse(readFileSync(join(CLI_ROOT, "package.json"), "utf-8")).version

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
  const fromIdx = args.findIndex(a => a === "--from")
  const fromSlug = fromIdx >= 0 ? args[fromIdx + 1] : null
  const filteredArgs = args.filter((a, i) => a !== "--yes" && a !== "-y" && a !== "--from" && !(fromIdx >= 0 && i === fromIdx + 1))

  // 1. Parse directory name from args or prompt
  let dirName = filteredArgs[0]

  if (dirName === "--help" || dirName === "-h") {
    console.log(`  ${bold("Usage:")} promptslide create ${dim("[project-directory]")} ${dim("[options]")}`)
    console.log()
    console.log(`  Scaffolds a new PromptSlide slide deck project.`)
    console.log()
    console.log(`  ${bold("Options:")}`)
    console.log(`    -y, --yes              Skip prompts and use defaults`)
    console.log(`    --from <deck-slug>     Start from a published deck`)
    console.log()
    console.log(`  ${bold("Examples:")}`)
    console.log(`    promptslide create my-pitch-deck`)
    console.log(`    promptslide create my-pitch-deck --yes`)
    console.log(`    promptslide create --from promptic-pitch-deck`)
    console.log()
    process.exit(0)
  }

  // If --from is specified, fetch the deck info before the directory prompt
  let fromItem = null
  let fromAuth = null
  if (fromSlug) {
    fromAuth = requireAuth()

    try {
      fromItem = await fetchRegistryItem(fromSlug, fromAuth)
    } catch (err) {
      console.error(`  ${red("Error:")} ${err.message}`)
      closePrompts()
      process.exit(1)
    }

    if (fromItem.type !== "deck") {
      console.error(`  ${red("Error:")} "${fromSlug}" is a ${fromItem.type}, not a deck. Use --from with a published deck.`)
      closePrompts()
      process.exit(1)
    }

    const versionTag = fromItem.version ? ` ${dim(`v${fromItem.version}`)}` : ""
    console.log(`  Using deck ${bold(fromItem.title || fromItem.name)}${versionTag} as template`)

    if (fromItem.promptslideVersion) {
      const pubParts = fromItem.promptslideVersion.match(/^(\d+)\.(\d+)/)
      const localParts = CLI_VERSION.match(/^(\d+)\.(\d+)/)
      if (pubParts && localParts && pubParts[2] !== localParts[2]) {
        console.log()
        console.log(`  ${yellow("⚠")} This deck was published with promptslide ${bold(`v${fromItem.promptslideVersion}`)}`)
        console.log(`    You have ${bold(`v${CLI_VERSION}`)} installed — some slides may need updating.`)
      }
    }

    console.log()
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

  // 3. Ask for primary brand color (optional, skipped when using --from since deck provides its own)
  let primaryHex = "#3B82F6"
  if (!useDefaults && !fromSlug) {
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

  const replacements = [
    {
      path: join(targetDir, "package.json"),
      values: { "{{PROJECT_SLUG}}": dirName, "{{PROJECT_NAME}}": projectName, "{{PROMPTSLIDE_VERSION}}": `^${CLI_VERSION}` }
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
        "{{PRIMARY_COLOR}}": primaryOklch
      }
    }
  ]

  for (const { path, values } of replacements) {
    replaceInFile(path, values)
  }

  // 6. Scaffold lockfile with deck slug so publish metadata can be added later
  writeLockfile(targetDir, {
    deckSlug: dirName,
    deckMeta: { title: "", description: "", tags: [] },
    items: {}
  })

  // 7. Overlay deck files if --from was specified
  if (fromSlug) {
    let resolved
    try {
      resolved = await resolveRegistryDependencies(fromItem, fromAuth, targetDir)
    } catch (err) {
      console.error(`  ${red("Error:")} ${err.message}`)
      closePrompts()
      process.exit(1)
    }

    // Write all deck files (no conflict prompts — fresh project)
    for (const regItem of resolved.items) {
      if (!regItem.files?.length) continue
      for (const file of regItem.files) {
        const targetPath = join(targetDir, file.target, file.path)
        const targetFileDir = dirname(targetPath)
        mkdirSync(targetFileDir, { recursive: true })

        const dataUriPrefix = file.content.match(/^data:[^;]+;base64,/)
        if (dataUriPrefix) {
          writeFileSync(targetPath, Buffer.from(file.content.slice(dataUriPrefix[0].length), "base64"))
        } else {
          writeFileSync(targetPath, file.content, "utf-8")
        }
        console.log(`  ${green("✓")} Added ${cyan(file.target + file.path)}`)
      }
    }

    // Reconstruct deck-config.ts from deckConfig metadata
    if (fromItem.meta?.slides) {
      const slides = fromItem.meta.slides.map(s => ({
        componentName: s.componentName || toPascalCase(s.slug),
        importPath: `@/slides/${s.slug}`,
        steps: s.steps,
        section: s.section
      }))
      replaceDeckConfig(targetDir, slides, {
        transition: fromItem.meta.transition,
        directionalTransition: fromItem.meta.directionalTransition
      })
      console.log(`  ${green("✓")} Generated ${cyan("deck-config.ts")} ${dim(`(${slides.length} slides)`)}`)
    }

    // Add npm dependencies from the deck to package.json
    if (Object.keys(resolved.npmDeps).length > 0) {
      const pkgList = Object.entries(resolved.npmDeps).map(([name, ver]) => `${name}@${ver}`)
      const pkgPath = join(targetDir, "package.json")
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
      for (const [name, ver] of Object.entries(resolved.npmDeps)) {
        pkg.dependencies = pkg.dependencies || {}
        pkg.dependencies[name] = ver
      }
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8")
      console.log(`  ${green("✓")} Added ${dim(pkgList.join(", "))} to package.json`)
    }

    // New deck identity — deckSlug stays as dirName (set in initial lockfile scaffold)
    console.log(`  ${dim("Deck slug set to")} ${bold(dirName)} ${dim("(publish will create a new deck)")}`)

    console.log()
  }

  // 8. Generate tsconfig.json for editor support
  ensureTsConfig(targetDir)

  // 9. Install PromptSlide agent skill (defaults to yes; skipped with --yes since skills CLI is interactive)
  if (useDefaults) {
    console.log(`  ${dim("Tip: Run")} npx skills add prompticeu/promptslide ${dim("to install the agent skill")}`)
  } else {
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
        console.log(`  ${red("⚠")} Skill installation failed. You can install it later with:`)
        console.log(`    npx skills add prompticeu/promptslide`)
      }
    }
  }

  // 10. Success output
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
  console.log()

  closePrompts()
}
