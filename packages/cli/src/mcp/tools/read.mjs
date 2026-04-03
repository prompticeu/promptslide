/**
 * MCP legacy read tools backed by shared services.
 */

import { z } from "zod"

import { getGuideContent } from "../guides/index.mjs"
import { withLegacyNotice } from "../services/legacy.mjs"
import { renderArtifact } from "../services/render.mjs"
import { ensureRuntimeContext, getRuntimeInfo } from "../services/runtime.mjs"
import { validateWorkspaceTarget } from "../services/validate.mjs"
import {
  getDeckSummary,
  getWorkspaceSummary,
  inspectFile,
  resolveComponentFile,
  resolveDeckContext,
  resolveLayoutFile,
  resolveSlideFile,
} from "../services/workspace.mjs"
import { appendTextNotice, errorResponse, imageResponse, jsonResponse, textResponse } from "./responses.mjs"

function legacyNote(tool, preferred) {
  return `Legacy tool \`${tool}\` is still supported during migration. Prefer \`${preferred}\` for new agent workflows.`
}

export function registerReadTools(server, context) {
  const { deckRoot } = context

  server.tool(
    "list_decks",
    `List all available decks. Returns name, slug, slide count, and theme for each deck.`,
    {},
    { readOnlyHint: true, destructiveHint: false },
    async () => jsonResponse(withLegacyNotice({
      decks: getWorkspaceSummary(deckRoot).decks,
    }, {
      tool: "list_decks",
      preferred: "inspect { scope: \"workspace\" }",
      note: legacyNote("list_decks", "inspect"),
    }))
  )

  server.tool(
    "get_deck_info",
    `Get an overview of a deck. Returns deck name, slug, theme, transition, slide list, and discovered files.`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        return jsonResponse(withLegacyNotice({
          ...getDeckSummary(deckPath),
          runtime: getRuntimeInfo(deckRoot),
        }, {
          tool: "get_deck_info",
          preferred: "inspect { scope: \"deck\" }",
          note: legacyNote("get_deck_info", "inspect"),
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "list_layouts",
    `List all available slide master layouts for a deck. Returns layout names and a source preview.`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const layouts = getDeckSummary(deckPath).layouts.map(layout => {
          const file = inspectFile(deckPath, layout.path)
          return {
            name: layout.name,
            file: layout.file,
            preview: file.content.substring(0, 300),
          }
        })

        return jsonResponse(withLegacyNotice({ layouts }, {
          tool: "list_layouts",
          preferred: "inspect or search",
          note: legacyNote("list_layouts", "inspect / search"),
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "get_layout",
    `Read a slide master layout's TSX source. Returns the raw source code.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      layout: z.string().describe("Layout name (e.g. 'master')"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, layout }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const resolved = resolveLayoutFile(deckPath, layout)
        if (!resolved) return jsonResponse({ error: `Layout not found: ${layout}` })
        return appendTextNotice(textResponse(inspectFile(deckPath, resolved.relativePath).content), legacyNote("get_layout", "read { layout }"))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "list_components",
    `List all reusable components for a deck. Returns component names and a source preview.`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const components = getDeckSummary(deckPath).components.map(component => {
          const file = inspectFile(deckPath, component.path)
          return {
            name: component.name,
            file: component.file,
            preview: file.content.substring(0, 300),
          }
        })

        return jsonResponse(withLegacyNotice({ components }, {
          tool: "list_components",
          preferred: "inspect or search",
          note: legacyNote("list_components", "inspect / search"),
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "get_component",
    `Read a reusable component's TSX source.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      component: z.string().describe("Component name (e.g. 'card')"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, component }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const resolved = resolveComponentFile(deckPath, component)
        if (!resolved) return jsonResponse({ error: `Component not found: ${component}` })
        return appendTextNotice(textResponse(inspectFile(deckPath, resolved.relativePath).content), legacyNote("get_component", "read { component }"))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "get_slide",
    `Read one slide's TSX source code. Returns the raw source of the slide file.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero' or 'slide-hero')"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, slide }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const resolved = resolveSlideFile(deckPath, slide)
        if (!resolved) return jsonResponse({ error: `Slide not found: ${slide}` })
        return appendTextNotice(textResponse(inspectFile(deckPath, resolved.relativePath).content), legacyNote("get_slide", "read { slide }"))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "get_screenshot",
    `Capture a visual preview of a rendered slide as base64 PNG. Starts the dev server automatically if not already running.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero')"),
      scale: z.number().optional().default(1).describe("Screenshot scale (1 or 2)"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, slide, scale }) => {
      try {
        const validation = await validateWorkspaceTarget({
          deckRoot,
          deck,
          scope: "slide",
          slide,
          includeRuntime: true,
        })
        const { deckSlug, port } = await ensureRuntimeContext({ deckRoot, deck })
        const result = await renderArtifact({
          deckRoot,
          deck: deckSlug,
          port,
          format: "png",
          slide,
          scale: scale || 1,
          staticDiagnostics: validation.diagnostics,
        })

        if (!result.ok || !result.data?.data) return jsonResponse(withLegacyNotice(result, {
          tool: "get_screenshot",
          preferred: "render { format: \"png\" }",
          note: legacyNote("get_screenshot", "render"),
        }))

        return appendTextNotice(imageResponse(result.data.data, "image/png"), legacyNote("get_screenshot", "render { format: \"png\" }"))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "get_slide_html",
    `Get a slide's rendered HTML with all CSS inlined. Used by the preview widget for crisp rendering.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero')"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, slide }) => {
      try {
        const validation = await validateWorkspaceTarget({
          deckRoot,
          deck,
          scope: "slide",
          slide,
          includeRuntime: true,
        })
        const { deckSlug, port } = await ensureRuntimeContext({ deckRoot, deck })
        const result = await renderArtifact({
          deckRoot,
          deck: deckSlug,
          port,
          format: "html",
          slide,
          staticDiagnostics: validation.diagnostics,
        })

        if (!result.ok || !result.data?.data) return jsonResponse(withLegacyNotice(result, {
          tool: "get_slide_html",
          preferred: "render { format: \"html\" }",
          note: legacyNote("get_slide_html", "render"),
        }))

        return appendTextNotice(textResponse(result.data.data), legacyNote("get_slide_html", "render { format: \"html\" }"))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "get_deck_overview",
    `Get a thumbnail grid of all slides in the deck as a single base64 PNG image. Starts the dev server automatically if not already running.`,
    { deck: z.string().optional().describe("Deck slug (optional if only one deck exists)") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck }) => {
      try {
        const validation = await validateWorkspaceTarget({
          deckRoot,
          deck,
          scope: "deck",
          includeRuntime: true,
        })
        const { deckSlug, port } = await ensureRuntimeContext({ deckRoot, deck })
        const result = await renderArtifact({
          deckRoot,
          deck: deckSlug,
          port,
          format: "overview",
          staticDiagnostics: validation.diagnostics,
        })

        if (!result.ok || !result.data?.data) return jsonResponse(withLegacyNotice(result, {
          tool: "get_deck_overview",
          preferred: "render { format: \"overview\" }",
          note: legacyNote("get_deck_overview", "render"),
        }))

        return appendTextNotice(imageResponse(result.data.data, "image/png"), legacyNote("get_deck_overview", "render { format: \"overview\" }"))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "get_guide",
    `Get framework documentation. Two guides available: ` +
      `"framework" — comprehensive reference for slide format, animations, layouts, theming, and workflow (read once at start). ` +
      `"design-recipes" — code snippets for backgrounds, card styles, layout patterns, data viz, and typography.`,
    {
      topic: z.enum(["framework", "design-recipes"]).describe('Guide topic: "framework" (comprehensive reference) or "design-recipes" (code snippets)'),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ topic }) => textResponse(getGuideContent(topic))
  )
}

export function registerGuideTools(server) {
  server.tool(
    "get_guide",
    `Get PromptSlide authoring guidance. Two guides available: ` +
      `"framework" — design-first workflow, slide format, layouts, theming, and validation/render guidance. ` +
      `"design-recipes" — code snippets for backgrounds, card styles, layout patterns, data viz, and typography.`,
    {
      topic: z.enum(["framework", "design-recipes"]).describe('Guide topic: "framework" (comprehensive reference) or "design-recipes" (code snippets)'),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ topic }) => textResponse(getGuideContent(topic))
  )
}
