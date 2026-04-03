/**
 * MCP legacy write tools backed by shared services.
 */

import { copyFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { withLegacyNotice } from "../services/legacy.mjs"
import {
  applyWorkspaceOperations,
  createDeckWorkspace,
  loadMutableManifest,
  saveMutableManifest,
  updateDeckMetadata,
  writeWorkspaceFile,
} from "../services/mutations.mjs"
import {
  buildImportSpecifier,
  normalizeSlideId,
  readWorkspaceFile,
  resolveComponentFile,
  resolveDeckContext,
  resolveLayoutFile,
  resolveSlideFile,
} from "../services/workspace.mjs"
import { errorResponse, jsonResponse } from "./responses.mjs"

function legacy(tool, preferred, payload, note) {
  return withLegacyNotice(payload, {
    tool,
    preferred,
    note: note || `Legacy tool \`${tool}\` is still supported during migration. Prefer \`${preferred}\` for new agent workflows.`,
  })
}

function updateSlideSource(deckPath, slide, updater) {
  const resolved = resolveSlideFile(deckPath, slide)
  if (!resolved) {
    throw new Error(`Slide not found: ${slide}`)
  }

  const current = readWorkspaceFile(deckPath, resolved.relativePath).content
  const next = updater(current, resolved)
  writeWorkspaceFile(deckPath, resolved.relativePath, next)
  return resolved
}

export function registerWriteTools(server, context) {
  const { deckRoot } = context

  server.tool(
    "create_deck",
    `Create a new empty deck. Creates the directory structure, deck.json, globals.css, and tsconfig.json.`,
    {
      name: z.string().describe("Deck display name"),
      slug: z.string().optional().describe("URL-safe slug (auto-generated from name if omitted)"),
      theme: z.string().optional().describe("Theme name (optional)"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ name, slug, theme }) => {
      try {
        const { deckSlug, deckPath } = createDeckWorkspace(deckRoot, { name, slug, theme })
        return jsonResponse(legacy("create_deck", "apply", {
          slug: deckSlug,
          path: deckPath,
          message: "Deck created. Prefer `apply` for future file and manifest mutations.",
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "update_deck",
    `Update deck metadata in deck.json. Only the provided fields are updated; others remain unchanged.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().optional().describe("New deck display name"),
      transition: z.enum(["fade", "slide-left", "slide-right", "slide-up", "slide-down", "zoom", "zoom-fade", "morph", "none"]).optional().describe("Slide transition type"),
      directionalTransition: z.boolean().optional().describe("Enable directional transitions"),
      logo: z.string().nullable().optional().describe("Logo path or null to remove"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, name, transition, directionalTransition, logo }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const manifest = updateDeckMetadata(deckPath, {
          ...(name !== undefined ? { name } : {}),
          ...(transition !== undefined ? { transition } : {}),
          ...(directionalTransition !== undefined ? { directionalTransition } : {}),
          ...(logo !== undefined ? { logo } : {}),
        })
        return jsonResponse(legacy("update_deck", "apply", {
          success: true,
          updated: manifest,
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "write_layout",
    `Create or update a slide master layout as a TSX component.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().describe("Layout name (e.g. 'master', 'title', 'split')"),
      content: z.string().describe("TSX source code for the layout component"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, name, content }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const filename = name.endsWith(".tsx") ? name : `${name}.tsx`
        const relativePath = `src/layouts/${filename}`
        const existing = resolveLayoutFile(deckPath, name.replace(/\.tsx$/, ""))
        writeWorkspaceFile(deckPath, relativePath, content)
        const importPath = buildImportSpecifier(deckPath, {
          kind: "layouts",
          name: name.replace(/\.tsx$/, ""),
          fromFile: join(deckPath, "src", "slides", "slide-example.tsx"),
        })

        return jsonResponse(legacy("write_layout", "apply", {
          success: true,
          layout: name.replace(/\.tsx$/, ""),
          file: relativePath,
          message: `Layout ${existing ? "updated" : "created"}. Import in slides: import { ... } from "${importPath}"`,
        }, `Legacy tool \`write_layout\` is still supported during migration. Prefer \`apply\` for file mutations; import hints now reflect the effective workspace contract.`))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "write_component",
    `Create or update a reusable component as a TSX file.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().describe("Component name (e.g. 'card', 'stat-block')"),
      content: z.string().describe("TSX source code for the component"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, name, content }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const filename = name.endsWith(".tsx") ? name : `${name}.tsx`
        const relativePath = `src/components/${filename}`
        const existing = resolveComponentFile(deckPath, name.replace(/\.tsx$/, ""))
        writeWorkspaceFile(deckPath, relativePath, content)
        const importPath = buildImportSpecifier(deckPath, {
          kind: "components",
          name: name.replace(/\.tsx$/, ""),
          fromFile: join(deckPath, "src", "slides", "slide-example.tsx"),
        })

        return jsonResponse(legacy("write_component", "apply", {
          success: true,
          component: name.replace(/\.tsx$/, ""),
          file: relativePath,
          message: `Component ${existing ? "updated" : "created"}. Import in slides: import { ... } from "${importPath}"`,
        }, `Legacy tool \`write_component\` is still supported during migration. Prefer \`apply\` for file mutations; import hints now reflect the effective workspace contract.`))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "create_slide",
    `Add a new TSX slide to the deck. Creates a .tsx file under src/slides/ and adds it to deck.json.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      id: z.string().describe("Slide id (e.g. 'hero', 'problem') — becomes the filename"),
      content: z.string().describe("TSX source code for the slide component"),
      position: z.number().optional().describe("Position in deck (0-indexed, defaults to end)"),
      section: z.string().optional().describe("Section/chapter name for grouping"),
      title: z.string().optional().describe("Display title for the slide"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, id, content, position, section, title }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const slideId = normalizeSlideId(id)
        const relativePath = `src/slides/slide-${slideId}.tsx`
        applyWorkspaceOperations(deckPath, [{
          type: "upsert-slide",
          id: slideId,
          path: relativePath,
          content,
          position,
          section,
          title,
        }])

        return jsonResponse(legacy("create_slide", "apply", {
          id: slideId,
          file: relativePath,
          message: "Slide created and added to deck. Prefer `validate` before `render` when checking the result.",
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "write_slide",
    `Full rewrite of a slide's TSX source. Replaces the entire file.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero' or 'slide-hero')"),
      content: z.string().describe("New TSX source code for the slide"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, slide, content }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const resolved = resolveSlideFile(deckPath, slide)
        if (!resolved) return jsonResponse({ error: `Slide not found: ${slide}` })
        writeWorkspaceFile(deckPath, resolved.relativePath, content)
        return jsonResponse(legacy("write_slide", "apply", {
          success: true,
          file: resolved.relativePath,
          message: "Slide updated. Prefer `validate` before `render` when checking the result.",
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "edit_slide",
    `Surgical find-and-replace within a slide's TSX source.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Slide id (e.g. 'hero' or 'slide-hero')"),
      old_string: z.string().describe("Exact string to find in the slide source"),
      new_string: z.string().describe("Replacement string"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, slide, old_string, new_string }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const resolved = updateSlideSource(deckPath, slide, current => {
          if (!current.includes(old_string)) {
            throw new Error("old_string not found in slide. Make sure it matches exactly.")
          }

          const count = current.split(old_string).length - 1
          if (count > 1) {
            throw new Error(`old_string found ${count} times. It must be unique. Provide more context to make it unique.`)
          }

          return current.replace(old_string, new_string)
        })

        return jsonResponse(legacy("edit_slide", "apply", {
          success: true,
          file: resolved.relativePath,
          message: "Slide edited. Prefer `validate` before `render` when checking the result.",
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "reorder_slides",
    `Change the order of slides in the deck. Provide slide ids in the desired order.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      order: z.array(z.string()).describe('Slide ids in desired order (e.g. ["hero", "problem", "solution"])'),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, order }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const manifest = loadMutableManifest(deckPath)
        const normalizedOrder = order.map(normalizeSlideId)
        const existingIds = manifest.slides.map(slide => slide.id)
        const missingIds = existingIds.filter(id => !normalizedOrder.includes(id))
        const unknownIds = normalizedOrder.filter(id => !existingIds.includes(id))

        if (missingIds.length || unknownIds.length) {
          const problems = []
          if (missingIds.length) problems.push(`missing ids: ${missingIds.join(", ")}`)
          if (unknownIds.length) problems.push(`unknown ids: ${unknownIds.join(", ")}`)
          return jsonResponse({ error: `Invalid slide order: ${problems.join("; ")}` })
        }

        const slideMap = new Map(manifest.slides.map(slideEntry => [slideEntry.id, slideEntry]))
        manifest.slides = normalizedOrder.map(id => slideMap.get(id) || { id })
        saveMutableManifest(deckPath, manifest)

        return jsonResponse(legacy("reorder_slides", "apply", {
          success: true,
          order: manifest.slides.map(slideEntry => slideEntry.id),
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "duplicate_slide",
    `Copy a slide to create a new one. Creates a copy with a new id and adds it after the original in the manifest.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      slide: z.string().describe("Source slide id"),
      new_id: z.string().describe("New slide id"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, slide, new_id }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)
        const sourceId = normalizeSlideId(slide)
        const targetId = normalizeSlideId(new_id)
        const source = resolveSlideFile(deckPath, sourceId)
        if (!source) return jsonResponse({ error: `Source slide not found: ${slide}` })

        const targetPath = `src/slides/slide-${targetId}.tsx`
        const existing = resolveSlideFile(deckPath, targetId)
        if (existing) return jsonResponse({ error: `Target slide already exists: ${targetPath}` })

        copyFileSync(source.fullPath, join(deckPath, targetPath))

        const manifest = loadMutableManifest(deckPath)
        const originalIndex = manifest.slides.findIndex(entry => entry.id === sourceId)
        const nextEntry = { id: targetId }
        if (originalIndex >= 0) manifest.slides.splice(originalIndex + 1, 0, nextEntry)
        else manifest.slides.push(nextEntry)
        saveMutableManifest(deckPath, manifest)

        return jsonResponse(legacy("duplicate_slide", "apply", {
          id: targetId,
          file: targetPath,
          message: "Slide duplicated.",
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )
}
