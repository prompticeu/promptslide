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
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    return []
  }
}

function writeAnnotationsFile(deckPath, annotations) {
  writeFileSync(join(deckPath, "annotations.json"), JSON.stringify(annotations, null, 2))
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
        const filename = slide.endsWith(".html") ? slide : `${slide}.html`
        annotations = annotations.filter(a =>
          a.slideTitle === filename || a.slideTitle === slide
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
      slide: z.string().describe("Slide filename (e.g. 'hero.html' or 'hero')"),
      text: z.string().describe("Annotation/feedback text"),
      author: z.string().optional().describe("Author name (defaults to 'agent')")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, slide, text, author }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const annotations = readAnnotations(deckPath)
      const filename = slide.endsWith(".html") ? slide : `${slide}.html`

      const annotation = {
        id: crypto.randomUUID(),
        slideTitle: filename,
        text,
        author: author || "agent",
        timestamp: new Date().toISOString(),
        status: "open",
        resolved: false
      }

      annotations.push(annotation)
      writeAnnotationsFile(deckPath, annotations)

      return { content: [{ type: "text", text: JSON.stringify({ success: true, id: annotation.id, message: "Annotation added." }) }] }
    }
  )

  // ─── resolve_annotation ───
  server.tool(
    "resolve_annotation",
    `Mark an annotation as resolved. Call this after addressing the feedback.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      annotation_id: z.string().describe("Annotation ID to resolve")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, annotation_id }) => {
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
      writeAnnotationsFile(deckPath, annotations)

      return { content: [{ type: "text", text: JSON.stringify({ success: true, message: "Annotation resolved." }) }] }
    }
  )
}
