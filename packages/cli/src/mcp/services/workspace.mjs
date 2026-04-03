import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path"

import { readDeckManifest } from "../../utils/deck-manifest.mjs"
import { listDeckSlugs, resolveDeckPath } from "../deck-resolver.mjs"
import { analyzeStepMetadata, getEffectiveStepCount, inspectSourceImports } from "./analysis.mjs"

const DEFAULT_SOURCE_EXTENSIONS = new Set([".tsx", ".jsx"])
const SEARCHABLE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js", ".mjs", ".css", ".json", ".md", ".html"])
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", ".promptslide"])
const RESOLVABLE_EXTENSIONS = ["", ".tsx", ".jsx", ".ts", ".js", ".mjs", ".css", ".json"]
const EXTERNAL_SPECIFIER_PREFIXES = ["asset://", "http://", "https://", "data:"]

function listFiles(dir, extensions) {
  if (!existsSync(dir)) return []

  return readdirSync(dir)
    .filter(file => extensions.has(extname(file)))
    .map(file => ({
      name: file.replace(/\.(tsx|jsx|ts|js|mjs|css)$/, ""),
      file,
      fullPath: join(dir, file),
    }))
}

function safeRelative(root, absolutePath) {
  const value = relative(root, absolutePath).replace(/\\/g, "/")
  return value || "."
}

function isWithinRoot(root, candidate) {
  const rel = relative(root, candidate)
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}

function walkFiles(root, currentDir, files) {
  if (!existsSync(currentDir)) return files

  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue
      walkFiles(root, join(currentDir, entry.name), files)
      continue
    }

    const absolutePath = join(currentDir, entry.name)
    if (!SEARCHABLE_EXTENSIONS.has(extname(entry.name))) continue
    files.push({
      path: safeRelative(root, absolutePath),
      absolutePath,
      size: statSync(absolutePath).size,
    })
  }

  return files
}

function listTreeEntries(root, currentDir, depth, maxDepth) {
  if (!existsSync(currentDir) || !statSync(currentDir).isDirectory()) return []

  const entries = readdirSync(currentDir, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith("."))
    .filter(entry => !(entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

  return entries.map(entry => {
    const fullPath = join(currentDir, entry.name)
    const relativePath = safeRelative(root, fullPath)

    if (entry.isDirectory()) {
      const node = {
        name: entry.name,
        path: `${relativePath}/`,
        type: "directory",
      }

      if (depth < maxDepth) {
        node.children = listTreeEntries(root, fullPath, depth + 1, maxDepth)
      }

      return node
    }

    return {
      name: entry.name,
      path: relativePath,
      type: "file",
      size: statSync(fullPath).size,
    }
  })
}

function resolveExistingPath(basePath) {
  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = `${basePath}${extension}`
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }

  if (existsSync(basePath) && statSync(basePath).isDirectory()) {
    for (const extension of RESOLVABLE_EXTENSIONS.slice(1)) {
      const indexPath = join(basePath, `index${extension}`)
      if (existsSync(indexPath) && statSync(indexPath).isFile()) return indexPath
    }
  }

  return null
}

function isExternalSpecifier(specifier) {
  return EXTERNAL_SPECIFIER_PREFIXES.some(prefix => specifier.startsWith(prefix)) ||
    (!specifier.startsWith("./") && !specifier.startsWith("../") && !specifier.startsWith("@/") && !specifier.startsWith("/"))
}

export function normalizeSlideId(slideId) {
  return slideId.replace(/\.(tsx|jsx)$/, "").replace(/^slide-/, "")
}

export function resolveDeckContext(deckRoot, deck) {
  const deckPath = resolveDeckPath(deckRoot, deck)
  if (!existsSync(deckPath)) {
    throw new Error(deck ? `Deck not found: ${deck}` : "Resolved deck path does not exist.")
  }

  const manifest = readDeckManifest(deckPath)
  return {
    deckPath,
    deckSlug: manifest?.slug || basename(deckPath),
    manifest,
  }
}

export function resolveWithinDeck(deckPath, path) {
  const absolutePath = isAbsolute(path) ? path : resolve(deckPath, path)
  if (!isWithinRoot(deckPath, absolutePath)) {
    throw new Error(`Path escapes deck root: ${path}`)
  }
  return absolutePath
}

export function resolveNamedFile(dir, name, extensions = [".tsx", ".jsx"]) {
  for (const extension of extensions) {
    const fullPath = join(dir, `${name}${extension}`)
    if (existsSync(fullPath)) {
      return {
        file: `${name}${extension}`,
        fullPath,
      }
    }
  }
  return null
}

export function resolveSlideFile(deckPath, slideId) {
  const normalizedId = normalizeSlideId(slideId)
  const slidesDir = join(deckPath, "src", "slides")
  const candidates = [
    `${normalizedId}.tsx`,
    `${normalizedId}.jsx`,
    `slide-${normalizedId}.tsx`,
    `slide-${normalizedId}.jsx`,
  ]

  for (const candidate of candidates) {
    const fullPath = join(slidesDir, candidate)
    if (existsSync(fullPath)) {
      return {
        id: normalizedId,
        file: candidate,
        fullPath,
        relativePath: safeRelative(deckPath, fullPath),
      }
    }
  }

  return null
}

export function resolveLayoutFile(deckPath, layout) {
  const layoutsDir = join(deckPath, "src", "layouts")
  const resolved = resolveNamedFile(layoutsDir, layout, [".tsx", ".jsx"])
  return resolved ? { ...resolved, relativePath: safeRelative(deckPath, resolved.fullPath) } : null
}

export function resolveComponentFile(deckPath, component) {
  const componentsDir = join(deckPath, "src", "components")
  const resolved = resolveNamedFile(componentsDir, component, [".tsx", ".jsx"])
  return resolved ? { ...resolved, relativePath: safeRelative(deckPath, resolved.fullPath) } : null
}

export function resolveThemeFile(deckPath, theme) {
  const filename = theme.endsWith(".css") ? theme : `${theme}.css`
  const fullPath = join(deckPath, "themes", filename)
  if (!existsSync(fullPath)) return null

  return {
    file: filename,
    fullPath,
    relativePath: safeRelative(deckPath, fullPath),
  }
}

export function resolveAssetFile(deckPath, name) {
  const fullPath = join(deckPath, "assets", name)
  if (!existsSync(fullPath)) return null

  return {
    file: name,
    fullPath,
    relativePath: safeRelative(deckPath, fullPath),
  }
}

export function readTextFile(filePath) {
  return readFileSync(filePath, "utf-8")
}

export function readWorkspaceFile(deckPath, path) {
  const absolutePath = resolveWithinDeck(deckPath, path)
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${path}`)
  }

  return {
    path: safeRelative(deckPath, absolutePath),
    fullPath: absolutePath,
    content: readTextFile(absolutePath),
  }
}

export function getWorkspaceTree(root, { path = ".", depth = 4 } = {}) {
  const absolutePath = isAbsolute(path) ? path : resolve(root, path)
  if (!isWithinRoot(root, absolutePath)) {
    throw new Error(`Path escapes root: ${path}`)
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`Path not found: ${path}`)
  }

  if (!statSync(absolutePath).isDirectory()) {
    return {
      root,
      path: safeRelative(root, absolutePath),
      tree: [{
        name: basename(absolutePath),
        path: safeRelative(root, absolutePath),
        type: "file",
        size: statSync(absolutePath).size,
      }],
    }
  }

  return {
    root,
    path: safeRelative(root, absolutePath),
    tree: listTreeEntries(root, absolutePath, 1, Math.max(1, depth)),
  }
}

export function readJsonFile(filePath, fallback = null) {
  if (!existsSync(filePath)) return fallback
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"))
  } catch {
    return fallback
  }
}

export function loadTsConfig(deckPath) {
  const tsconfigPath = join(deckPath, "tsconfig.json")
  const tsconfig = readJsonFile(tsconfigPath)
  return {
    path: existsSync(tsconfigPath) ? tsconfigPath : null,
    config: tsconfig,
  }
}

export function getAliasSummary(deckPath) {
  const { path: tsconfigPath, config } = loadTsConfig(deckPath)
  const aliases = []

  for (const [alias, targets] of Object.entries(config?.compilerOptions?.paths || {})) {
    aliases.push({
      alias,
      targets: Array.isArray(targets) ? targets : [targets],
      source: tsconfigPath ? safeRelative(deckPath, tsconfigPath) : "tsconfig.json",
    })
  }

  if (!aliases.some(entry => entry.alias === "@/*")) {
    aliases.unshift({
      alias: "@/*",
      targets: ["src/*"],
      source: "promptslide-vite-plugin",
    })
  }

  return aliases
}

export function getAliasDiagnostics(deckPath) {
  const { config } = loadTsConfig(deckPath)
  const promptslideAlias = config?.compilerOptions?.paths?.promptslide
  const targets = Array.isArray(promptslideAlias) ? promptslideAlias : (promptslideAlias ? [promptslideAlias] : [])

  if (!targets.length) return []

  return [{
    phase: "workspace",
    severity: "warning",
    target: `deck:${basename(deckPath)}`,
    path: "tsconfig.json",
    code: "tsconfig.promptslide-alias",
    message: "tsconfig.json defines a custom `promptslide` path alias.",
    hint: "Remove the `promptslide` alias and keep only `@/*`. Framework imports should resolve from the installed package, not a specific file path inside node_modules.",
    detail: `Configured targets: ${targets.join(", ")}`,
  }]
}

export function supportsAlias(deckPath, alias = "@/*") {
  return getAliasSummary(deckPath).some(entry => entry.alias === alias)
}

export function buildImportSpecifier(deckPath, { kind, name, fromFile } = {}) {
  const baseName = name.replace(/\.(tsx|jsx|ts|js|css)$/, "")

  if (supportsAlias(deckPath)) {
    return `@/${kind}/${baseName}`
  }

  if (!fromFile) {
    return `src/${kind}/${baseName}`
  }

  const targetPath = join(deckPath, "src", kind, baseName)
  const specifier = relative(dirname(fromFile), targetPath).replace(/\\/g, "/")
  return specifier.startsWith(".") ? specifier : `./${specifier}`
}

export function resolveImportSpecifier(deckPath, importerPath, specifier) {
  if (isExternalSpecifier(specifier)) {
    return { specifier, kind: "external", exists: true, path: null }
  }

  let absolutePath
  if (specifier.startsWith("@/")) {
    absolutePath = resolve(deckPath, "src", specifier.slice(2))
  } else if (specifier.startsWith("/")) {
    absolutePath = resolve(deckPath, `.${specifier}`)
  } else {
    absolutePath = resolve(dirname(importerPath), specifier)
  }

  const resolvedPath = resolveExistingPath(absolutePath)
  return {
    specifier,
    kind: "local",
    exists: Boolean(resolvedPath),
    path: resolvedPath ? safeRelative(deckPath, resolvedPath) : null,
  }
}

export function analyzeWorkspaceSource(deckPath, { fullPath, relativePath, content, target } = {}) {
  const stepAnalysis = analyzeStepMetadata(content, { path: relativePath, target })
  const importResolutions = inspectSourceImports(content).map(specifier => resolveImportSpecifier(deckPath, fullPath, specifier))
  const importDiagnostics = importResolutions
    .filter(entry => entry.kind === "local" && !entry.exists)
    .map(entry => ({
      phase: "static",
      severity: "error",
      target,
      path: relativePath,
      code: "import.unresolved",
      message: `Cannot resolve import \`${entry.specifier}\` from ${relativePath}`,
      hint: "Check the import path or create the referenced file before rendering.",
    }))

  return {
    ...stepAnalysis,
    importResolutions,
    importDiagnostics,
    diagnostics: [...stepAnalysis.diagnostics, ...importDiagnostics],
  }
}

export function listDeckSummaries(deckRoot) {
  return listDeckSlugs(deckRoot).map(slug => {
    const deckPath = join(deckRoot, slug)
    const manifest = readDeckManifest(deckPath)
    return {
      slug,
      name: manifest?.name || slug,
      theme: manifest?.theme || null,
      slides: manifest?.slides?.length || 0,
      path: deckPath,
    }
  })
}

export function getWorkspaceSummary(deckRoot) {
  return {
    root: deckRoot,
    decks: listDeckSummaries(deckRoot),
  }
}

export function listWorkspaceFiles(root) {
  return walkFiles(root, root, [])
}

export function getDeckSummary(deckPath) {
  const manifest = readDeckManifest(deckPath)
  const layouts = listFiles(join(deckPath, "src", "layouts"), DEFAULT_SOURCE_EXTENSIONS)
    .map(file => ({ name: file.name, file: file.file, path: safeRelative(deckPath, file.fullPath) }))
  const components = listFiles(join(deckPath, "src", "components"), DEFAULT_SOURCE_EXTENSIONS)
    .map(file => ({ name: file.name, file: file.file, path: safeRelative(deckPath, file.fullPath) }))
  const themes = listFiles(join(deckPath, "themes"), new Set([".css"]))
    .map(file => ({ name: file.name, file: file.file, path: safeRelative(deckPath, file.fullPath) }))
  const assetsDir = join(deckPath, "assets")
  const assets = existsSync(assetsDir)
    ? readdirSync(assetsDir).map(name => {
        const fullPath = join(assetsDir, name)
        return { name, path: safeRelative(deckPath, fullPath), size: statSync(fullPath).size }
      })
    : []

  const slides = (manifest?.slides || []).map(entry => {
    const resolved = resolveSlideFile(deckPath, entry.id)
    if (!resolved) {
      return {
        id: entry.id,
        file: null,
        section: entry.section,
        title: entry.title,
        transition: entry.transition,
        steps: 0,
        diagnostics: [createMissingSlideDiagnostic(entry.id)],
      }
    }

    const content = readTextFile(resolved.fullPath)
    const analysis = analyzeWorkspaceSource(deckPath, {
      fullPath: resolved.fullPath,
      relativePath: resolved.relativePath,
      content,
      target: entry.id,
    })

    return {
      id: entry.id,
      file: resolved.file,
      path: resolved.relativePath,
      section: entry.section,
      title: entry.title,
      transition: entry.transition,
      steps: analysis.declaredSteps ?? analysis.inferredSteps ?? 0,
      declaredSteps: analysis.declaredSteps,
      inferredSteps: analysis.inferredSteps,
      diagnostics: analysis.diagnostics,
      imports: analysis.importResolutions,
    }
  })

  const { path: tsconfigPath, config: tsconfig } = loadTsConfig(deckPath)
  const aliasDiagnostics = getAliasDiagnostics(deckPath)

  return {
    ...(manifest || {
      name: basename(deckPath),
      slug: basename(deckPath),
      theme: null,
      transition: "fade",
      directionalTransition: true,
      slides: [],
    }),
    deckPath,
    config: {
      tsconfigPath: tsconfigPath ? safeRelative(deckPath, tsconfigPath) : null,
      baseUrl: tsconfig?.compilerOptions?.baseUrl || null,
      aliases: getAliasSummary(deckPath),
    },
    diagnostics: aliasDiagnostics,
    slides,
    layouts,
    components,
    themes,
    assets,
  }
}

function createMissingSlideDiagnostic(slideId) {
  return {
    phase: "workspace",
    severity: "error",
    target: slideId,
    message: `Manifest references missing slide: ${slideId}`,
    code: "slide.missing",
  }
}

export function inspectFile(deckPath, path) {
  const file = readWorkspaceFile(deckPath, path)
  const summary = {
    path: file.path,
    size: statSync(file.fullPath).size,
  }

  if (file.path.startsWith("src/slides/") && DEFAULT_SOURCE_EXTENSIONS.has(extname(file.path))) {
    summary.kind = "slide"
    summary.steps = getEffectiveStepCount(file.content)
    summary.analysis = analyzeWorkspaceSource(deckPath, {
      fullPath: file.fullPath,
      relativePath: file.path,
      content: file.content,
      target: basename(file.path),
    })
  } else if (file.path.startsWith("src/layouts/")) {
    summary.kind = "layout"
  } else if (file.path.startsWith("src/components/")) {
    summary.kind = "component"
  } else if (file.path.startsWith("themes/")) {
    summary.kind = "theme"
  } else if (file.path === "deck.json") {
    summary.kind = "manifest"
  } else {
    summary.kind = "file"
  }

  return {
    ...summary,
    content: file.content,
  }
}

export function searchWorkspaceFiles(root, { query, regexp = false, maxResults = 50 } = {}) {
  if (!query) return []

  const files = walkFiles(root, root, [])
  const matcher = regexp ? new RegExp(query, "g") : null
  const results = []

  for (const file of files) {
    const content = readTextFile(file.absolutePath)
    const lines = content.split(/\r?\n/)

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      const matched = regexp ? matcher.test(line) : line.includes(query)
      if (!matched) continue

      results.push({
        path: file.path,
        line: index + 1,
        excerpt: line.trim(),
      })

      if (regexp) matcher.lastIndex = 0
      if (results.length >= maxResults) return results
    }
  }

  return results
}
