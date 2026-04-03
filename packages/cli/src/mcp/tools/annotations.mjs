/**
 * MCP Annotation tools: get_annotations, add_annotation, resolve_annotation
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"

function readAnnotations(deckPath) {
  const path = join(deckPath, "annotations.json")
  if (!existsSync(path)) return []
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"))
    // Support both formats: { version, annotations: [...] } and flat [...]
    return Array.isArray(raw) ? raw : (raw.annotations || [])
  } catch {
    return []
  }
}

function writeAnnotationsFile(deckPath, annotations) {
  const data = { version: 1, annotations }
  writeFileSync(join(deckPath, "annotations.json"), JSON.stringify(data, null, 2) + "\n")
}

export function registerAnnotationTools(server, context) {
  const { deckRoot } = context

  // ─── get_annotations ───
  server.tool(
    "get_annotations",
    `Read feedback/annotations for the deck. Returns annotations with slide index, ` +
    `body text, status (open/resolved), and target position. ` +
    `Filter by slide name or status to find relevant feedback.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().optional().describe("Filter by slide filename (optional)"),
      status: z.enum(["open", "resolved"]).optional().describe("Filter by status (optional)")
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, slide, status }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      let annotations = readAnnotations(deckPath)

      if (slide) {
        annotations = annotations.filter(a =>
          // Match by slideTitle (display name), slide id, or slideIndex
          a.slideTitle === slide || a.slide === slide ||
          a.slideTitle?.replace(/\.tsx$/, "") === slide
        )
      }

      if (status) {
        annotations = annotations.filter(a => a.status === status)
      }

      return { content: [{ type: "text", text: JSON.stringify(annotations, null, 2) }] }
    }
  )

  // ─── add_annotation ───
  server.tool(
    "add_annotation",
    `Add a feedback annotation to a slide. Creates a new annotation entry in annotations.json.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero')"),
      text: z.string().describe("Annotation/feedback text"),
      xPercent: z.number().optional().describe("X position as percentage of slide width (0-100, defaults to 50)"),
      yPercent: z.number().optional().describe("Y position as percentage of slide height (0-100, defaults to 50)"),
      contentNearPin: z.string().optional().describe("Text content of the HTML element near the annotation pin"),
      author: z.string().optional().describe("Author name (defaults to 'agent')")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, slide, text, xPercent, yPercent, contentNearPin, author }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const annotations = readAnnotations(deckPath)
      // Read deck manifest to find slide index and title
      let slideIndex = 0
      let slideTitle = slide
      try {
        const manifest = JSON.parse(readFileSync(join(deckPath, "deck.json"), "utf-8"))
        const idx = manifest.slides.findIndex(s => s.id === slide)
        if (idx >= 0) slideIndex = idx
        slideTitle = manifest.slides[idx]?.title || slide
      } catch {}

      const annotation = {
        id: crypto.randomUUID(),
        slideIndex,
        slideTitle,
        target: { contentNearPin: contentNearPin || "", position: { xPercent: xPercent ?? 50, yPercent: yPercent ?? 50 } },
        body: text,
        createdAt: new Date().toISOString(),
        status: "open"
      }

      annotations.push(annotation)
      writeAnnotationsFile(deckPath, annotations)

      return { content: [{ type: "text", text: JSON.stringify({ success: true, id: annotation.id, message: "Annotation added." }) }] }
    }
  )

  // ─── resolve_annotation ───
  server.tool(
    "resolve_annotation",
    `Mark an annotation as resolved. Call this after addressing the feedback. Optionally include a resolution note explaining what was done.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      annotation_id: z.string().describe("Annotation ID to resolve"),
      resolution: z.string().optional().describe("Resolution note explaining what was done to address the feedback")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, annotation_id, resolution }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const annotations = readAnnotations(deckPath)
      const annotation = annotations.find(a => a.id === annotation_id)

      if (!annotation) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Annotation not found: ${annotation_id}` }) }] }
      }

      annotation.status = "resolved"
      if (resolution) {
        annotation.resolution = resolution
      }
      writeAnnotationsFile(deckPath, annotations)

      return { content: [{ type: "text", text: JSON.stringify({ success: true, message: "Annotation resolved." }) }] }
    }
  )
}
