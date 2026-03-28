import { execSync } from "node:child_process"
import { existsSync, cpSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { bold, green, cyan, red, dim, yellow } from "../utils/ansi.mjs"
import { requireAuth } from "../utils/auth.mjs"
import { hexToOklch } from "../utils/colors.mjs"
import { confirm, closePrompts } from "../utils/prompts.mjs"
import { fetchRegistryItem, resolveRegistryDependencies, updateLockfilePublishConfig, writeLockfile } from "../utils/registry.mjs"
import { toPascalCase, replaceDeckConfig } from "../utils/deck-config.mjs"
import { ensureTsConfig } from "../utils/tsconfig.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CLI_ROOT = join(__dirname, "..", "..")
const TEMPLATE_DIR = join(CLI_ROOT, "templates", "default")
const CLI_VERSION = JSON.parse(readFileSync(join(CLI_ROOT, "package.json"), "utf-8")).version

function replaceInFile(filePath, replacements) {
  let content = readFileSync(filePath, "utf-8")
  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, value)
  }
  writeFileSync(filePath, content, "utf-8")
}

export async function clone(args) {
  console.log()
  console.log(`  ${bold("promptslide")} ${dim("clone")}`)
  console.log()

  if (args[0] === "--help" || args[0] === "-h") {
    console.log(`  ${bold("Usage:")} promptslide clone ${dim("<deck-slug>")}`)
    console.log()
    console.log(`  Clone a published deck to continue working on it locally.`)
    console.log(`  The deck stays linked for pull/publish.`)
    console.log()
    console.log(`  ${bold("Examples:")}`)
    console.log(`    promptslide clone statworx-slide-master`)
    console.log()
    process.exit(0)
  }

  const slug = args[0]

  if (!slug) {
    console.error(`  ${red("Error:")} Please provide a deck slug.`)
    console.error(`  ${dim("Usage:")} promptslide clone ${dim("<deck-slug>")}`)
    console.log()
    process.exit(1)
  }

  // 1. Authenticate and fetch deck
  const auth = requireAuth()

  let item
  try {
    item = await fetchRegistryItem(slug, auth)
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

  if (item.type !== "deck") {
    console.error(`  ${red("Error:")} "${slug}" is a ${item.type}, not a deck. Only decks can be cloned.`)
    process.exit(1)
  }

  const versionTag = item.version ? ` ${dim(`v${item.version}`)}` : ""
  console.log(`  Cloning ${bold(item.title || item.name)}${versionTag}`)

  if (item.promptslideVersion) {
    const pubParts = item.promptslideVersion.match(/^(\d+)\.(\d+)/)
    const localParts = CLI_VERSION.match(/^(\d+)\.(\d+)/)
    if (pubParts && localParts && pubParts[2] !== localParts[2]) {
      console.log()
      console.log(`  ${yellow("⚠")} This deck was published with promptslide ${bold(`v${item.promptslideVersion}`)}`)
      console.log(`    You have ${bold(`v${CLI_VERSION}`)} installed — some slides may need updating.`)
    }
  }

  console.log()

  // 2. Use slug as directory name
  const dirName = slug
  const targetDir = resolve(process.cwd(), dirName)

  if (existsSync(targetDir)) {
    console.error(`  ${red("Error:")} Directory "${dirName}" already exists.`)
    process.exit(1)
  }

  // 3. Scaffold base template
  cpSync(TEMPLATE_DIR, targetDir, { recursive: true })

  const projectName = item.title || slug
  const primaryOklch = hexToOklch("#3B82F6")

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
      values: { "{{PRIMARY_COLOR}}": primaryOklch }
    }
  ]

  for (const { path, values } of replacements) {
    replaceInFile(path, values)
  }

  // 4. Create lockfile linked to the original deck
  writeLockfile(targetDir, {
    deckSlug: slug,
    deckMeta: { title: "", description: "", tags: [] },
    items: {}
  })

  // 5. Resolve dependencies and write deck files
  let resolved
  try {
    resolved = await resolveRegistryDependencies(item, auth, targetDir)
  } catch (err) {
    console.error(`  ${red("Error:")} ${err.message}`)
    process.exit(1)
  }

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

  // 6. Generate deck-config.ts
  if (item.meta?.slides) {
    const slides = item.meta.slides.map(s => ({
      componentName: toPascalCase(s.slug),
      importPath: `@/slides/${s.slug}`,
      steps: s.steps,
      section: s.section
    }))
    replaceDeckConfig(targetDir, slides, {
      transition: item.meta.transition,
      directionalTransition: item.meta.directionalTransition
    })
    console.log(`  ${green("✓")} Generated ${cyan("deck-config.ts")} ${dim(`(${slides.length} slides)`)}`)
  }

  // 7. Add npm dependencies
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

  // 8. Fetch annotations
  if (item.id) {
    try {
      const annotationsRes = await fetch(`${auth.registry}/api/items/${item.id}/annotations`, {
        headers: { Authorization: `Bearer ${auth.token}`, ...(auth.organizationId ? { "X-Organization-Id": auth.organizationId } : {}) }
      })
      if (annotationsRes.ok) {
        const data = await annotationsRes.json()
        const annotations = data.annotations ?? []
        if (annotations.length > 0) {
          const annotationsFile = { version: 1, annotations: annotations.map(a => ({
            id: a.id,
            slideIndex: a.slideIndex,
            slideTitle: a.slideTitle,
            target: a.target,
            body: a.body,
            createdAt: a.createdAt,
            status: a.status,
            ...(a.resolution ? { resolution: a.resolution } : {})
          })) }
          writeFileSync(join(targetDir, "annotations.json"), JSON.stringify(annotationsFile, null, 2) + "\n", "utf-8")
          console.log(`  ${green("✓")} Pulled ${cyan("annotations.json")} ${dim(`(${annotations.length} annotation${annotations.length === 1 ? "" : "s"})`)}`)
        }
      }
    } catch {
      // Annotations are non-critical; don't fail the clone
    }
  }

  // 9. Generate tsconfig.json
  ensureTsConfig(targetDir)

  // 10. Success output
  console.log()
  console.log(`  ${green("✓")} Cloned ${bold(projectName)} in ${cyan(dirName)}/`)
  console.log()
  console.log(`  ${bold("Next steps:")}`)
  console.log()
  console.log(`    cd ${dirName}`)
  console.log(`    bun install`)
  console.log(`    bun run dev`)
  console.log()

  closePrompts()
}
