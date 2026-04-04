/**
 * MCP Write tools: create_deck, update_deck, write_layout, write_component,
 * create_slide, write_slide, edit_slide,
 * reorder_slides, duplicate_slide
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"
import { ensureTsConfig } from "../../utils/tsconfig.mjs"
import { getDevServerPort } from "../dev-server.mjs"

/**
 * Check for Vite compilation errors after writing a slide file.
 * Clears the error buffer, waits for HMR to process, then checks for new errors.
 * Returns an array of warning strings, or empty if no errors.
 */
async function checkPostWriteErrors() {
  const port = getDevServerPort()
  if (!port) return []

  try {
    // Clear existing errors
    await fetch(`http://localhost:${port}/__promptslide_errors`, { method: "DELETE" })
    // Wait for Vite HMR to process the file change
    await new Promise(r => setTimeout(r, 600))
    // Check for new errors
    const res = await fetch(`http://localhost:${port}/__promptslide_errors`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.errors || []).map(e => e.message)
  } catch {
    return []
  }
}

/**
 * Resolve slide file path for a given slide id.
 * Checks: src/slides/{id}.tsx, src/slides/slide-{id}.tsx, and .jsx variants.
 */
function resolveSlideFile(deckPath, slideId) {
  const slidesDir = join(deckPath, "src", "slides")
  const candidates = [
    `${slideId}.tsx`,
    `${slideId}.jsx`,
    `slide-${slideId}.tsx`,
    `slide-${slideId}.jsx`
  ]
  for (const candidate of candidates) {
    const fullPath = join(slidesDir, candidate)
    if (existsSync(fullPath)) return { file: candidate, fullPath }
  }
  return null
}

function normalizeSlideId(slideId) {
  return slideId.replace(/\.(tsx|jsx)$/, "").replace(/^slide-/, "")
}

export function registerWriteTools(server, context) {
  const { deckRoot } = context

  // ─── create_deck ───
  server.tool(
    "create_deck",
    `Create a new empty deck. Creates the directory structure, deck.json, globals.css, and tsconfig.json. ` +
    `After creating a deck, create 1-2 slide master layouts first (write_layout) ` +
    `for consistent structure across slides. Then create slides that import and use layouts. ` +
    `Slide dimensions: 1280x720 (16:9).`,
    {
      name: z.string().describe("Deck display name"),
      slug: z.string().optional().describe("URL-safe slug (auto-generated from name if omitted)"),
      theme: z.string().optional().describe("Theme name (optional)")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ name, slug, theme }) => {
      const deckSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const deckPath = join(deckRoot, deckSlug)

      if (existsSync(join(deckPath, "deck.json"))) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Deck "${deckSlug}" already exists. Use update_deck to modify it, or choose a different name/slug.` }) }], isError: true }
      }

      // Create directory structure
      const dirs = ["src/slides", "src/layouts", "src/components", "themes", "assets"]
      for (const dir of dirs) {
        mkdirSync(join(deckPath, dir), { recursive: true })
      }

      // Create deck.json
      const manifest = {
        name,
        slug: deckSlug,
        transition: "fade",
        directionalTransition: true,
        slides: []
      }
      if (theme) manifest.theme = theme
      writeFileSync(join(deckPath, "deck.json"), JSON.stringify(manifest, null, 2))

      // Create globals.css (Tailwind + theme)
      const globalsCssPath = join(deckPath, "src", "globals.css")
      if (!existsSync(globalsCssPath)) {
        writeFileSync(globalsCssPath, DEFAULT_GLOBALS_CSS)
      }

      ensureTsConfig(deckPath)

      return { content: [{ type: "text", text: JSON.stringify({ slug: deckSlug, path: deckPath, message: "Deck created. Create layouts with write_layout, then add slides with create_slide." }) }] }
    }
  )

  // ─── update_deck ───
  server.tool(
    "update_deck",
    `Update deck metadata in deck.json. Only the provided fields are updated; others remain unchanged.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().optional().describe("New deck display name"),
      transition: z.enum(["fade", "slide-left", "slide-right", "slide-up", "slide-down", "zoom", "zoom-fade", "morph", "none"]).optional().describe("Slide transition type"),
      directionalTransition: z.boolean().optional().describe("Enable directional transitions"),
      logo: z.string().nullable().optional().describe("Logo path or null to remove")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, name, transition, directionalTransition, logo }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const manifestPath = join(deckPath, "deck.json")
      if (!existsSync(manifestPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No deck.json found." }) }] }
      }

      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))

      if (name !== undefined) manifest.name = name
      if (transition !== undefined) manifest.transition = transition
      if (directionalTransition !== undefined) manifest.directionalTransition = directionalTransition
      if (logo !== undefined) manifest.logo = logo

      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

      return { content: [{ type: "text", text: JSON.stringify({ success: true, message: "Deck metadata updated.", updated: manifest }) }] }
    }
  )

  // ─── write_layout ───
  server.tool(
    "write_layout",
    `Create or update a slide layout as a TSX component. ` +
    `Layouts define repeating structure (headers, footers, backgrounds, padding) shared across slides. ` +
    `Create 2-4 different layouts per deck for visual variety (e.g. content, title, split, section-break). ` +
    `The layout receives { children, slideNumber, totalSlides } as props. ` +
    `Slides import layouts: import { ContentLayout } from "@/layouts/content"`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().describe("Layout name (e.g. 'content', 'title', 'split', 'section-break')"),
      content: z.string().describe("TSX source code for the layout component")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, name, content }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const filename = name.endsWith(".tsx") ? name : `${name}.tsx`
      const layoutsDir = join(deckPath, "src", "layouts")
      mkdirSync(layoutsDir, { recursive: true })
      const layoutFile = join(layoutsDir, filename)
      const isNew = !existsSync(layoutFile)
      writeFileSync(layoutFile, content)

      const layoutName = name.replace(/\.tsx$/, "")
      const exportMatch = content.match(/export\s+(?:function|const|class)\s+(\w+)/)
      const exportName = exportMatch ? exportMatch[1] : titleCase(layoutName)
      return { content: [{ type: "text", text: JSON.stringify({
        success: true,
        layout: layoutName,
        file: `src/layouts/${filename}`,
        message: `Layout ${isNew ? "created" : "updated"}. Import in slides: import { ${exportName} } from "@/layouts/${layoutName}"`
      }) }] }
    }
  )

  // ─── write_component ───
  server.tool(
    "write_component",
    `Create or update a reusable component as a TSX file. ` +
    `Components are shared building blocks (cards, stat blocks, etc.) used across slides. ` +
    `Slides import components: import { Card } from "@/components/card"`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().describe("Component name (e.g. 'card', 'stat-block')"),
      content: z.string().describe("TSX source code for the component")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, name, content }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const filename = name.endsWith(".tsx") ? name : `${name}.tsx`
      const componentsDir = join(deckPath, "src", "components")
      mkdirSync(componentsDir, { recursive: true })
      const componentFile = join(componentsDir, filename)
      const isNew = !existsSync(componentFile)
      writeFileSync(componentFile, content)

      const componentName = name.replace(/\.tsx$/, "")
      const exportMatch = content.match(/export\s+(?:function|const|class)\s+(\w+)/)
      const exportName = exportMatch ? exportMatch[1] : titleCase(componentName)
      return { content: [{ type: "text", text: JSON.stringify({
        success: true,
        component: componentName,
        file: `src/components/${filename}`,
        message: `Component ${isNew ? "created" : "updated"}. Import in slides: import { ${exportName} } from "@/components/${componentName}"`
      }) }] }
    }
  )

  // ─── create_slide ───
  server.tool(
    "create_slide",
    `Add a new TSX slide to the deck. Creates a .tsx file under src/slides/ and adds it to deck.json. ` +
    `Slides are React components that receive { slideNumber, totalSlides } props. ` +
    `Use Animated, AnimatedGroup, Morph from "promptslide" for animations. ` +
    `Import layouts from "@/layouts/..." and components from "@/components/...". ` +
    `Use Tailwind CSS classes and semantic colors (text-foreground, bg-primary, etc.). ` +
    `PDF-safe styling only: NO blur (backdrop-blur), NO gradients (bg-gradient-to-*), NO shadows (shadow-*). ` +
    `Use solid colors with opacity instead (bg-primary/10, bg-white/5). ` +
    `Export const meta = { steps: N } for animation step count. ` +
    `Dimensions: 1280x720 (16:9).`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      id: z.string().describe("Slide id (e.g. 'hero', 'problem') — becomes the filename"),
      content: z.string().describe("TSX source code for the slide component"),
      position: z.number().optional().describe("Position in deck (0-indexed, defaults to end)"),
      section: z.string().optional().describe("Section/chapter name for grouping"),
      title: z.string().optional().describe("Display title for the slide")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, id, content, position, section, title }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const filename = `slide-${id}.tsx`
      const slidePath = join(deckPath, "src", "slides", filename)

      // Write the slide file
      mkdirSync(join(deckPath, "src", "slides"), { recursive: true })
      writeFileSync(slidePath, content)

      // Update deck.json
      const manifestPath = join(deckPath, "deck.json")
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
        const entry = { id }
        if (section) entry.section = section
        if (title) entry.title = title

        if (position !== undefined && position >= 0 && position <= manifest.slides.length) {
          manifest.slides.splice(position, 0, entry)
        } else {
          manifest.slides.push(entry)
        }
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      }

      const warnings = await checkPostWriteErrors()
      const result = { id, file: `src/slides/${filename}`, message: "Slide created and added to deck. Use get_screenshot to verify the visual result." }
      if (warnings.length) result.warnings = warnings
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    }
  )

  // ─── write_slide ───
  server.tool(
    "write_slide",
    `Full rewrite of a slide's TSX source. Replaces the entire file. ` +
    `Use for major changes or starting over. For small changes, prefer edit_slide.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero' or 'slide-hero')"),
      content: z.string().describe("New TSX source code for the slide")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, slide, content }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const resolved = resolveSlideFile(deckPath, slide)
      if (!resolved) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${slide}` }) }] }
      }

      writeFileSync(resolved.fullPath, content)
      const warnings = await checkPostWriteErrors()
      const result = { success: true, file: `src/slides/${resolved.file}`, message: "Slide updated. Use get_screenshot to verify the visual result." }
      if (warnings.length) result.warnings = warnings
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    }
  )

  // ─── edit_slide ───
  server.tool(
    "edit_slide",
    `Surgical find-and-replace within a slide's TSX source. Use for text changes, ` +
    `class tweaks, prop changes — anything. old_string must match exactly. ` +
    `Prefer this over write_slide for small changes.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero' or 'slide-hero')"),
      old_string: z.string().describe("Exact string to find in the slide source"),
      new_string: z.string().describe("Replacement string")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, slide, old_string, new_string }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const resolved = resolveSlideFile(deckPath, slide)
      if (!resolved) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${slide}` }) }] }
      }

      const content = readFileSync(resolved.fullPath, "utf-8")

      if (!content.includes(old_string)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "old_string not found in slide. Make sure it matches exactly." }) }] }
      }

      // Count occurrences
      const count = content.split(old_string).length - 1
      if (count > 1) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `old_string found ${count} times. It must be unique. Provide more context to make it unique.` }) }] }
      }

      const updated = content.replace(old_string, new_string)
      writeFileSync(resolved.fullPath, updated)

      const warnings = await checkPostWriteErrors()
      const result = { success: true, file: `src/slides/${resolved.file}`, message: "Slide edited. Use get_screenshot to verify the visual result." }
      if (warnings.length) result.warnings = warnings
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    }
  )

  // ─── reorder_slides ───
  server.tool(
    "reorder_slides",
    `Change the order of slides in the deck. Provide slide ids in the desired order.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      order: z.array(z.string()).describe('Slide ids in desired order (e.g. ["hero", "problem", "solution"])')
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, order }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const manifestPath = join(deckPath, "deck.json")
      if (!existsSync(manifestPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No deck.json found." }) }] }
      }

      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
      const normalizedOrder = order.map(normalizeSlideId)
      const existingIds = manifest.slides.map(s => s.id)
      const missingIds = existingIds.filter(id => !normalizedOrder.includes(id))
      const unknownIds = normalizedOrder.filter(id => !existingIds.includes(id))

      if (missingIds.length || unknownIds.length) {
        const problems = []
        if (missingIds.length) problems.push(`missing ids: ${missingIds.join(", ")}`)
        if (unknownIds.length) problems.push(`unknown ids: ${unknownIds.join(", ")}`)
        return { content: [{ type: "text", text: JSON.stringify({ error: `Invalid slide order: ${problems.join("; ")}` }) }] }
      }

      // Build new slides array preserving metadata (section, transition, title)
      const slideMap = new Map(manifest.slides.map(s => [s.id, s]))
      const newSlides = normalizedOrder
        .map(id => slideMap.get(id) || { id })

      manifest.slides = newSlides
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

      return { content: [{ type: "text", text: JSON.stringify({ success: true, order: newSlides.map(s => s.id) }) }] }
    }
  )

  // ─── duplicate_slide ───
  server.tool(
    "duplicate_slide",
    `Copy a slide to create a new one. Creates a copy with a new id and adds it after the original in the manifest.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Source slide id"),
      new_id: z.string().describe("New slide id")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, slide, new_id }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const sourceId = normalizeSlideId(slide)
      const targetId = normalizeSlideId(new_id)
      const resolved = resolveSlideFile(deckPath, sourceId)
      if (!resolved) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Source slide not found: ${slide}` }) }] }
      }

      const targetFile = `slide-${targetId}.tsx`
      const targetPath = join(deckPath, "src", "slides", targetFile)

      if (existsSync(targetPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Target slide already exists: ${targetFile}` }) }] }
      }

      copyFileSync(resolved.fullPath, targetPath)

      // Update deck.json — insert after the original
      const manifestPath = join(deckPath, "deck.json")
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
        const originalIndex = manifest.slides.findIndex(s => s.id === sourceId)
        const newEntry = { id: targetId }
        if (originalIndex >= 0) {
          manifest.slides.splice(originalIndex + 1, 0, newEntry)
        } else {
          manifest.slides.push(newEntry)
        }
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      }

      return { content: [{ type: "text", text: JSON.stringify({ id: targetId, file: `src/slides/${targetFile}`, message: "Slide duplicated." }) }] }
    }
  )
}

function titleCase(str) {
  return str.replace(/(^|[-_])(\w)/g, (_, _sep, c) => c.toUpperCase())
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
