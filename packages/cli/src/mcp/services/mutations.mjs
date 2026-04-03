import { existsSync, mkdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"

import { ensureTsConfig } from "../../utils/tsconfig.mjs"
import { normalizeSlideId, readJsonFile, resolveSlideFile, resolveWithinDeck } from "./workspace.mjs"

function ensureParentDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true })
}

function defaultManifest(deckPath) {
  const slug = basename(deckPath)
  return {
    name: slug,
    slug,
    transition: "fade",
    directionalTransition: true,
    slides: [],
  }
}

export function loadMutableManifest(deckPath) {
  return readJsonFile(join(deckPath, "deck.json"), defaultManifest(deckPath))
}

export function saveMutableManifest(deckPath, manifest) {
  ensureParentDir(join(deckPath, "deck.json"))
  writeFileSync(join(deckPath, "deck.json"), JSON.stringify(manifest, null, 2))
}

export function writeWorkspaceFile(deckPath, path, content) {
  const absolutePath = resolveWithinDeck(deckPath, path)
  ensureParentDir(absolutePath)
  writeFileSync(absolutePath, content)
  return absolutePath
}

export function deleteWorkspacePath(deckPath, path) {
  const absolutePath = resolveWithinDeck(deckPath, path)
  if (!existsSync(absolutePath)) {
    throw new Error(`Path not found: ${path}`)
  }

  if (statSync(absolutePath).isDirectory()) {
    rmSync(absolutePath, { recursive: true, force: true })
  } else {
    unlinkSync(absolutePath)
  }

  return absolutePath
}

export function renameWorkspacePath(deckPath, path, nextPath) {
  const absolutePath = resolveWithinDeck(deckPath, path)
  const nextAbsolutePath = resolveWithinDeck(deckPath, nextPath)
  if (!existsSync(absolutePath)) {
    throw new Error(`Path not found: ${path}`)
  }

  ensureParentDir(nextAbsolutePath)
  renameSync(absolutePath, nextAbsolutePath)
  return { from: absolutePath, to: nextAbsolutePath }
}

export function upsertSlideEntry(deckPath, entry, { position } = {}) {
  const manifest = loadMutableManifest(deckPath)
  const slideId = normalizeSlideId(entry.id)
  const nextEntry = { ...entry, id: slideId }
  const currentIndex = manifest.slides.findIndex(slide => slide.id === slideId)

  if (currentIndex >= 0) {
    manifest.slides[currentIndex] = { ...manifest.slides[currentIndex], ...nextEntry }
    if (position != null && position !== currentIndex) {
      const [moved] = manifest.slides.splice(currentIndex, 1)
      manifest.slides.splice(Math.max(0, Math.min(position, manifest.slides.length)), 0, moved)
    }
  } else if (position != null) {
    manifest.slides.splice(Math.max(0, Math.min(position, manifest.slides.length)), 0, nextEntry)
  } else {
    manifest.slides.push(nextEntry)
  }

  saveMutableManifest(deckPath, manifest)
  return manifest
}

export function removeSlideEntry(deckPath, slideId) {
  const manifest = loadMutableManifest(deckPath)
  manifest.slides = manifest.slides.filter(slide => slide.id !== normalizeSlideId(slideId))
  saveMutableManifest(deckPath, manifest)
  return manifest
}

export function updateDeckMetadata(deckPath, patch) {
  const manifest = loadMutableManifest(deckPath)
  Object.assign(manifest, patch)
  saveMutableManifest(deckPath, manifest)
  return manifest
}

export function createDeckWorkspace(deckRoot, { name, slug, theme } = {}) {
  const deckSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const deckPath = join(deckRoot, deckSlug)
  const dirs = ["src/slides", "src/layouts", "src/components", "themes", "assets"]

  for (const dir of dirs) mkdirSync(join(deckPath, dir), { recursive: true })

  const manifest = {
    name,
    slug: deckSlug,
    transition: "fade",
    directionalTransition: true,
    slides: [],
  }
  if (theme) manifest.theme = theme

  saveMutableManifest(deckPath, manifest)

  const globalsCssPath = join(deckPath, "src", "globals.css")
  if (!existsSync(globalsCssPath)) {
    writeFileSync(globalsCssPath, DEFAULT_GLOBALS_CSS)
  }

  ensureTsConfig(deckPath)

  return {
    deckSlug,
    deckPath,
    affectedPaths: ["deck.json", "src/globals.css", "tsconfig.json"],
  }
}

export function applyWorkspaceOperations(deckPath, operations = []) {
  const affectedPaths = new Set()

  for (const operation of operations) {
    switch (normalizeOperationType(operation.type)) {
      case "write-file": {
        const absolutePath = writeWorkspaceFile(deckPath, operation.path, operation.content || "")
        affectedPaths.add(relativePath(deckPath, absolutePath))
        break
      }

      case "delete-file": {
        const absolutePath = deleteWorkspacePath(deckPath, operation.path)
        affectedPaths.add(relativePath(deckPath, absolutePath))
        break
      }

      case "rename-file": {
        const renamed = renameWorkspacePath(deckPath, operation.path, operation.nextPath)
        affectedPaths.add(relativePath(deckPath, renamed.from))
        affectedPaths.add(relativePath(deckPath, renamed.to))
        break
      }

      case "upsert-slide": {
        const slideId = normalizeSlideId(operation.id)
        const slidePath = operation.path || `src/slides/slide-${slideId}.tsx`
        if (operation.content !== undefined) {
          const absolutePath = writeWorkspaceFile(deckPath, slidePath, operation.content)
          affectedPaths.add(relativePath(deckPath, absolutePath))
        }

        upsertSlideEntry(deckPath, {
          id: slideId,
          ...(operation.section !== undefined ? { section: operation.section } : {}),
          ...(operation.title !== undefined ? { title: operation.title } : {}),
          ...(operation.transition !== undefined ? { transition: operation.transition } : {}),
          ...(operation.notes !== undefined ? { notes: operation.notes } : {}),
        }, { position: operation.position })
        affectedPaths.add("deck.json")
        break
      }

      case "remove-slide": {
        const slideId = normalizeSlideId(operation.id)
        removeSlideEntry(deckPath, slideId)
        affectedPaths.add("deck.json")

        if (operation.deleteFile !== false) {
          const resolved = resolveSlideFile(deckPath, slideId)
          if (resolved) {
            deleteWorkspacePath(deckPath, resolved.relativePath)
            affectedPaths.add(resolved.relativePath)
          }
        }
        break
      }

      case "update-deck": {
        updateDeckMetadata(deckPath, operation.patch || {})
        affectedPaths.add("deck.json")
        break
      }

      default:
        throw new Error(`Unsupported apply operation type: ${operation.type}`)
    }
  }

  return { affectedPaths: [...affectedPaths] }
}

function relativePath(deckPath, absolutePath) {
  return absolutePath.replace(`${deckPath}/`, "")
}

function normalizeOperationType(type) {
  switch (type) {
    case "upsert":
    case "create":
    case "update":
    case "create-file":
    case "update-file":
      return "write-file"
    case "delete":
    case "remove":
      return "delete-file"
    case "rename":
    case "move":
      return "rename-file"
    default:
      return type
  }
}

const DEFAULT_GLOBALS_CSS = `@import "tailwindcss";

/* PromptSlide Default Theme */

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.55 0.2 250);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.159 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --primary: oklch(0.6 0.2 250);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.305 0 0);
  --muted-foreground: oklch(0.712 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.269 0 0);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.439 0 0);
}

* {
  border-color: var(--border);
}

body {
  background: var(--background);
  color: var(--foreground);
  margin: 0;
}
`
