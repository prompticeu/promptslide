import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const DECK_CONFIG_PATH = "src/deck-config.ts"

/**
 * Convert a kebab-case filename to PascalCase component name.
 * e.g. "slide-hero-gradient" → "SlideHeroGradient"
 * e.g. "01-title" → "Slide01Title" (prefixed to ensure valid JS identifier)
 */
export function toPascalCase(kebab) {
  const raw = kebab
    .replace(/\.tsx?$/, "")
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
  // JS identifiers cannot start with a digit — prefix with "Slide"
  return /^\d/.test(raw) ? `Slide${raw}` : raw
}

/**
 * Derive import path from file target and path.
 * e.g. target="src/slides/", path="slide-hero.tsx" → "@/slides/slide-hero"
 */
export function deriveImportPath(target, filePath) {
  const dir = target.replace(/^src\//, "@/").replace(/\/$/, "")
  const name = filePath.replace(/\.tsx?$/, "")
  return `${dir}/${name}`
}

/**
 * Add a single slide to deck-config.ts.
 * Uses string manipulation to preserve existing content.
 *
 * @param {string} cwd - Project root directory
 * @param {{ componentName: string, importPath: string, steps: number }} opts
 */
export function addSlideToDeckConfig(cwd, { componentName, importPath, steps }) {
  const configPath = join(cwd, DECK_CONFIG_PATH)
  if (!existsSync(configPath)) {
    console.warn(`  Warning: ${DECK_CONFIG_PATH} not found. Skipping deck-config update.`)
    return false
  }

  let content = readFileSync(configPath, "utf-8")

  // Check if this component is already imported (handles spacing variations)
  if (new RegExp(`import\\s*\\{\\s*${componentName}\\s*\\}`).test(content)) {
    return false // Already exists
  }

  // Build import and slide entry strings
  const importLine = `import { ${componentName} } from "${importPath}"`
  const slideEntry = `  { component: ${componentName}, steps: ${steps} },`

  // Find insertion point for import:
  // Look for the last import from "@/slides/" or "@/layouts/"
  const importLines = content.split("\n")
  let lastSlideImportIdx = -1
  let lastAnyImportIdx = -1

  for (let i = 0; i < importLines.length; i++) {
    const line = importLines[i]
    if (/^import\s+/.test(line)) {
      lastAnyImportIdx = i
      if (line.includes('"@/slides/') || line.includes('"@/layouts/')) {
        lastSlideImportIdx = i
      }
    }
  }

  // Insert import after last slide import, or after last import, or at top
  const importInsertIdx = lastSlideImportIdx >= 0
    ? lastSlideImportIdx + 1
    : lastAnyImportIdx >= 0
      ? lastAnyImportIdx + 1
      : 0

  importLines.splice(importInsertIdx, 0, importLine)
  content = importLines.join("\n")

  // Find insertion point for slide entry in the slides array.
  // Look for the closing bracket of the slides array.
  // Strategy: find `]` that follows the last `}` or `,` in the slides array.
  const slidesArrayMatch = content.match(/export\s+const\s+slides\s*:\s*SlideConfig\[\]\s*=\s*\[/)
  if (!slidesArrayMatch) {
    console.warn(`  Warning: Could not find slides array in ${DECK_CONFIG_PATH}. Skipping.`)
    return false
  }

  const arrayStartIdx = content.indexOf(slidesArrayMatch[0]) + slidesArrayMatch[0].length
  // Find the matching closing bracket
  let bracketDepth = 1
  let arrayEndIdx = arrayStartIdx
  for (let i = arrayStartIdx; i < content.length; i++) {
    if (content[i] === "[") bracketDepth++
    if (content[i] === "]") bracketDepth--
    if (bracketDepth === 0) {
      arrayEndIdx = i
      break
    }
  }

  // Insert the slide entry before the closing bracket
  const beforeClose = content.slice(0, arrayEndIdx)
  const afterClose = content.slice(arrayEndIdx)

  // Check if the array is empty or has existing entries
  const arrayContent = content.slice(arrayStartIdx, arrayEndIdx).trim()
  if (arrayContent.length === 0) {
    // Empty array — insert with newline
    content = beforeClose + "\n" + slideEntry + "\n" + afterClose
  } else {
    // Has entries — ensure trailing newline + add entry
    const trimmedBefore = beforeClose.trimEnd()
    const needsComma = !trimmedBefore.endsWith(",")
    content = trimmedBefore + (needsComma ? "," : "") + "\n" + slideEntry + "\n" + afterClose
  }

  writeFileSync(configPath, content, "utf-8")
  return true
}

/**
 * Remove a slide from deck-config.ts by component name.
 * Removes the import line and the slides array entry.
 *
 * @param {string} cwd - Project root directory
 * @param {string} componentName - PascalCase component name (e.g. "SlideHeroGradient")
 * @returns {boolean} Whether any changes were made
 */
export function removeSlideFromDeckConfig(cwd, componentName) {
  const configPath = join(cwd, DECK_CONFIG_PATH)
  if (!existsSync(configPath)) return false

  let content = readFileSync(configPath, "utf-8")
  let changed = false

  // Remove import line
  const importRegex = new RegExp(
    `^import\\s*\\{\\s*${componentName}\\s*\\}\\s*from\\s*["'][^"']+["']\\s*;?\\s*\\n?`,
    "m"
  )
  if (importRegex.test(content)) {
    content = content.replace(importRegex, "")
    changed = true
  }

  // Remove slide entry from array
  const entryRegex = new RegExp(
    `^\\s*\\{[^}]*component:\\s*${componentName}[^}]*\\},?\\s*\\n?`,
    "m"
  )
  if (entryRegex.test(content)) {
    content = content.replace(entryRegex, "")
    changed = true
  }

  if (changed) {
    // Clean up triple+ blank lines
    content = content.replace(/\n{3,}/g, "\n\n")
    writeFileSync(configPath, content, "utf-8")
  }

  return changed
}

/**
 * Replace the entire deck-config.ts with a new slide manifest (for deck type).
 *
 * @param {string} cwd - Project root directory
 * @param {{ componentName: string, importPath: string, steps: number, section?: string }[]} slides
 * @param {{ transition?: string, directionalTransition?: boolean }} opts
 */
export function replaceDeckConfig(cwd, slides, opts = {}) {
  const configPath = join(cwd, DECK_CONFIG_PATH)

  const imports = [
    `import type { SlideConfig } from "promptslide"`,
    ...slides.map(s => `import { ${s.componentName} } from "${s.importPath}"`)
  ].join("\n")

  const slideEntries = slides
    .map(s => {
      const parts = [`component: ${s.componentName}`, `steps: ${s.steps}`]
      if (s.section) parts.push(`section: "${s.section}"`)
      return `  { ${parts.join(", ")} },`
    })
    .join("\n")

  const configLines = []
  if (opts.transition) {
    configLines.push(`export const transition = "${opts.transition}"`)
  }
  if (opts.directionalTransition !== undefined) {
    configLines.push(`export const directionalTransition = ${opts.directionalTransition}`)
  }
  const configBlock = configLines.length > 0 ? "\n" + configLines.join("\n") + "\n" : ""

  const content = [
    imports,
    configBlock,
    "export const slides: SlideConfig[] = [",
    slideEntries,
    "]",
    ""
  ].join("\n")

  writeFileSync(configPath, content, "utf-8")
  return true
}

/**
 * Parse deck-config.ts and extract the deckConfig structure for publishing.
 * Returns { transition?, directionalTransition?, slides } where slides is
 * an array of { slug, steps, section? }.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ transition?: string, directionalTransition?: boolean, slides: { slug: string, steps: number, section?: string }[] } | null}
 */
export function parseDeckConfig(cwd) {
  const configPath = join(cwd, DECK_CONFIG_PATH)
  if (!existsSync(configPath)) return null

  const content = readFileSync(configPath, "utf-8")

  // 1. Parse imports to build componentName -> slug map
  //    Handles: import { SlideTitle } from "@/slides/slide-title"
  //    Handles: import { default as SlideTitle } from "@/slides/slide-title"
  //    Handles: import { SlideTitle as Alias } from "@/slides/slide-title"
  const componentToSlug = {}
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']@\/slides\/([^"']+)["']/g
  for (const match of content.matchAll(importRegex)) {
    const importClause = match[1].trim()
    const slug = match[2].replace(/\.tsx?$/, "")
    // Handle "X", "X as Y" (use Y), "default as Y" (use Y)
    const asMatch = importClause.match(/(?:\w+\s+)?as\s+(\w+)/)
    const componentName = asMatch ? asMatch[1] : importClause.match(/(\w+)/)?.[1]
    if (componentName) {
      componentToSlug[componentName] = slug
    }
  }

  // 2. Parse transition exports
  let transition
  const transitionMatch = content.match(/export\s+const\s+transition\s*=\s*["']([^"']+)["']/)
  if (transitionMatch) transition = transitionMatch[1]

  let directionalTransition
  const dirMatch = content.match(/export\s+const\s+directionalTransition\s*=\s*(true|false)/)
  if (dirMatch) directionalTransition = dirMatch[1] === "true"

  // 3. Extract slides array content, then parse entries within it
  const slides = []
  const slidesArrayMatch = content.match(/export\s+const\s+slides\s*:\s*SlideConfig\[\]\s*=\s*\[/)
  if (slidesArrayMatch) {
    const arrayStartIdx = content.indexOf(slidesArrayMatch[0]) + slidesArrayMatch[0].length
    // Find matching closing bracket
    let bracketDepth = 1
    let arrayEndIdx = arrayStartIdx
    for (let i = arrayStartIdx; i < content.length; i++) {
      if (content[i] === "[") bracketDepth++
      if (content[i] === "]") bracketDepth--
      if (bracketDepth === 0) {
        arrayEndIdx = i
        break
      }
    }
    const arrayContent = content.slice(arrayStartIdx, arrayEndIdx)

    // Match entries within the slides array only
    const entryRegex = /\{([^}]+)\}/g
    for (const match of arrayContent.matchAll(entryRegex)) {
      const body = match[1]
      const componentMatch = body.match(/component:\s*(\w+)/)
      if (!componentMatch) continue
      const slug = componentToSlug[componentMatch[1]]
      if (!slug) continue // layout or unknown import — skip
      const stepsMatch = body.match(/steps:\s*(\d+)/)
      const entry = { slug, steps: stepsMatch ? parseInt(stepsMatch[1], 10) : 0 }
      const sectionMatch = body.match(/section:\s*["']([^"']+)["']/)
      if (sectionMatch) entry.section = sectionMatch[1]
      slides.push(entry)
    }
  }

  if (slides.length === 0) return null

  const result = { slides }
  if (transition) result.transition = transition
  if (directionalTransition !== undefined) result.directionalTransition = directionalTransition
  return result
}
