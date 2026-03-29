/**
 * MCP Write tools: create_deck, update_deck, write_layout,
 * create_slide, write_slide, edit_slide,
 * reorder_slides, duplicate_slide
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { parseDeckManifest } from "../../html/parser.mjs"
import { resolveDeckPath } from "../deck-resolver.mjs"

export function registerWriteTools(server, context) {
  const { deckRoot } = context

  // ─── create_deck ───
  server.tool(
    "create_deck",
    `Create a new empty deck. Creates the directory structure and deck.json manifest. ` +
    `Slides use HTML with Tailwind CSS classes. Use data-step and data-animate attributes ` +
    `for click-to-reveal animations (types: fade, slide-up, slide-down, slide-left, slide-right, scale). ` +
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

      // Create directory structure
      const dirs = ["slides", "layouts", "themes", "assets"]
      for (const dir of dirs) {
        mkdirSync(join(deckPath, dir), { recursive: true })
      }

      // Create deck.json
      const manifest = {
        name,
        slug: deckSlug,
        theme: theme || "default",
        transition: "fade",
        directionalTransition: true,
        logo: null,
        slides: []
      }
      writeFileSync(join(deckPath, "deck.json"), JSON.stringify(manifest, null, 2))

      // Create default theme if it doesn't exist
      const defaultThemePath = join(deckPath, "themes", "default.css")
      if (!existsSync(defaultThemePath)) {
        writeFileSync(defaultThemePath, DEFAULT_THEME_CSS)
      }

      return { content: [{ type: "text", text: JSON.stringify({ slug: deckSlug, path: deckPath, message: "Deck created. Add slides with create_slide." }) }] }
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
    `Create or update a slide master layout. Layouts are HTML templates in layouts/ ` +
    `that provide consistent structure (headers, footers, spacing) across slides. ` +
    `Use <!-- content --> as the placeholder where slide content is injected. ` +
    `Use <!-- slideNumber --> and <!-- totalSlides --> for page numbers. ` +
    `Slides reference layouts via data-layout="name" on their <section> element.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().describe("Layout name (e.g. 'master', 'title', 'split')"),
      content: z.string().describe("HTML template content. Must include <!-- content --> placeholder.")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, name, content }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      if (!content.includes("<!-- content -->")) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Layout template must include <!-- content --> placeholder for slide content injection." }) }] }
      }

      const filename = name.endsWith(".html") ? name : `${name}.html`
      const layoutsDir = join(deckPath, "layouts")
      mkdirSync(layoutsDir, { recursive: true })
      const layoutFile = join(layoutsDir, filename)
      const isNew = !existsSync(layoutFile)
      writeFileSync(layoutFile, content)
      return { content: [{ type: "text", text: JSON.stringify({
        success: true,
        layout: name.replace(".html", ""),
        message: `Layout ${isNew ? "created" : "updated"}. Use data-layout="${name.replace(".html", "")}" on slides to apply it.`
      }) }] }
    }
  )

  // ─── create_slide ───
  server.tool(
    "create_slide",
    `Add a new HTML slide to the deck. Creates a .html file and adds it to the deck manifest. ` +
    `Slides use Tailwind CSS classes and semantic colors (text-foreground, bg-primary, ` +
    `text-muted-foreground, bg-background, bg-card, border-border). ` +
    `Use data-step="N" and data-animate="type" attributes for click-to-reveal animations ` +
    `(types: fade, slide-up, slide-down, slide-left, slide-right, scale). ` +
    `Use data-layout="name" to wrap in a slide master layout from layouts/. ` +
    `Dimensions: 1280x720 (16:9).`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().describe("Slide filename without extension (e.g. 'hero', 'problem')"),
      content: z.string().describe("HTML content of the slide (wrap in <section>)"),
      position: z.number().optional().describe("Position in deck (0-indexed, defaults to end)"),
      section: z.string().optional().describe("Section/chapter name for grouping")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, name, content, position, section }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const filename = name.endsWith(".html") ? name : `${name}.html`
      const slidePath = join(deckPath, "slides", filename)

      // Write the slide file
      mkdirSync(join(deckPath, "slides"), { recursive: true })
      writeFileSync(slidePath, content)

      // Update deck.json
      const manifestPath = join(deckPath, "deck.json")
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
        const entry = { file: filename }
        if (section) entry.section = section

        if (position !== undefined && position >= 0 && position <= manifest.slides.length) {
          manifest.slides.splice(position, 0, entry)
        } else {
          manifest.slides.push(entry)
        }
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      }

      return { content: [{ type: "text", text: JSON.stringify({ file: filename, message: "Slide created and added to deck." }) }] }
    }
  )

  // ─── write_slide ───
  server.tool(
    "write_slide",
    `Full rewrite of a slide's HTML content. Replaces the entire .html file. ` +
    `Use for major changes or starting over. For small changes, prefer edit_slide.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide filename (e.g. 'hero.html' or 'hero')"),
      content: z.string().describe("New HTML content for the slide")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, slide, content }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const filename = slide.endsWith(".html") ? slide : `${slide}.html`
      const slidePath = join(deckPath, "slides", filename)

      if (!existsSync(slidePath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${filename}` }) }] }
      }

      writeFileSync(slidePath, content)
      return { content: [{ type: "text", text: JSON.stringify({ success: true, file: filename }) }] }
    }
  )

  // ─── edit_slide ───
  server.tool(
    "edit_slide",
    `Surgical find-and-replace within a slide's HTML. Use for text changes, ` +
    `class tweaks, adding/removing attributes — anything. old_string must match exactly. ` +
    `Prefer this over write_slide for small changes.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide filename (e.g. 'hero.html' or 'hero')"),
      old_string: z.string().describe("Exact string to find in the slide HTML"),
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

      const filename = slide.endsWith(".html") ? slide : `${slide}.html`
      const slidePath = join(deckPath, "slides", filename)

      if (!existsSync(slidePath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Slide not found: ${filename}` }) }] }
      }

      const content = readFileSync(slidePath, "utf-8")

      if (!content.includes(old_string)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "old_string not found in slide. Make sure it matches exactly." }) }] }
      }

      // Count occurrences
      const count = content.split(old_string).length - 1
      if (count > 1) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `old_string found ${count} times. It must be unique. Provide more context to make it unique.` }) }] }
      }

      const updated = content.replace(old_string, new_string)
      writeFileSync(slidePath, updated)

      return { content: [{ type: "text", text: JSON.stringify({ success: true, file: filename }) }] }
    }
  )

  // ─── reorder_slides ───
  server.tool(
    "reorder_slides",
    `Change the order of slides in the deck. Provide the slide filenames in the desired order.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      order: z.array(z.string()).describe('Slide filenames in desired order (e.g. ["hero.html", "problem.html", "solution.html"])')
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

      // Normalize filenames
      const normalizedOrder = order.map(f => f.endsWith(".html") ? f : `${f}.html`)

      // Build new slides array preserving metadata (section, transition)
      const slideMap = new Map(manifest.slides.map(s => [s.file, s]))
      const newSlides = normalizedOrder
        .map(f => slideMap.get(f) || { file: f })
        .filter(s => existsSync(join(deckPath, "slides", s.file)))

      manifest.slides = newSlides
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

      return { content: [{ type: "text", text: JSON.stringify({ success: true, order: newSlides.map(s => s.file) }) }] }
    }
  )

  // ─── duplicate_slide ───
  server.tool(
    "duplicate_slide",
    `Copy a slide to create a new one. Creates a copy with a new name and adds it after the original in the manifest.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Source slide filename"),
      new_name: z.string().describe("New slide filename (without .html extension)")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, slide, new_name }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const sourceFile = slide.endsWith(".html") ? slide : `${slide}.html`
      const targetFile = new_name.endsWith(".html") ? new_name : `${new_name}.html`
      const sourcePath = join(deckPath, "slides", sourceFile)
      const targetPath = join(deckPath, "slides", targetFile)

      if (!existsSync(sourcePath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Source slide not found: ${sourceFile}` }) }] }
      }

      if (existsSync(targetPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Target slide already exists: ${targetFile}` }) }] }
      }

      copyFileSync(sourcePath, targetPath)

      // Update deck.json — insert after the original
      const manifestPath = join(deckPath, "deck.json")
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
        const originalIndex = manifest.slides.findIndex(s => s.file === sourceFile)
        const newEntry = { file: targetFile }
        if (originalIndex >= 0) {
          manifest.slides.splice(originalIndex + 1, 0, newEntry)
        } else {
          manifest.slides.push(newEntry)
        }
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      }

      return { content: [{ type: "text", text: JSON.stringify({ file: targetFile, message: "Slide duplicated." }) }] }
    }
  )
}

const DEFAULT_THEME_CSS = `@import "tailwindcss";

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
