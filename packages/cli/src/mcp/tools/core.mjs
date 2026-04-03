import { z } from "zod"

import { renderArtifact } from "../services/render.mjs"
import { ensureRuntimeContext, getRuntimeInfo } from "../services/runtime.mjs"
import { validateWorkspaceTarget } from "../services/validate.mjs"
import {
  buildImportSpecifier,
  getDeckSummary,
  getWorkspaceSummary,
  getWorkspaceTree,
  inspectFile,
  listWorkspaceFiles,
  readWorkspaceFile,
  resolveComponentFile,
  resolveDeckContext,
  resolveLayoutFile,
  resolveSlideFile,
  resolveThemeFile,
  searchWorkspaceFiles,
} from "../services/workspace.mjs"
import { applyWorkspaceOperations, createDeckWorkspace } from "../services/mutations.mjs"
import { appendTextNotice, errorResponse, imageResponse, jsonResponse, textResponse } from "./responses.mjs"

const scopeSchema = z.enum(["workspace", "deck", "file", "slide"])
const operationTypeField = z.string().optional()

const writeFileOperationSchema = z.object({
  type: z.enum(["write-file", "create-file", "update-file", "upsert", "create", "update"])
    .describe("Write or replace a file. Prefer 'write-file'."),
  path: z.string().describe("Path relative to the deck root"),
  content: z.string().describe("Full file contents to write"),
})

const deleteFileOperationSchema = z.object({
  type: z.enum(["delete-file", "delete", "remove"])
    .describe("Delete a file or directory. Prefer 'delete-file'."),
  path: z.string().describe("Path relative to the deck root"),
})

const renameFileOperationSchema = z.object({
  type: z.enum(["rename-file", "rename", "move"])
    .describe("Rename or move a file. Prefer 'rename-file'."),
  path: z.string().describe("Existing path relative to the deck root"),
  nextPath: z.string().describe("New path relative to the deck root"),
})

const createDeckOperationSchema = z.object({
  type: z.literal("create-deck"),
  name: z.string().describe("Deck display name"),
  slug: z.string().optional().describe("URL-safe deck slug"),
  theme: z.string().optional().describe("Optional theme name"),
})

const upsertSlideOperationSchema = z.object({
  type: z.literal("upsert-slide"),
  id: z.string().describe("Slide id"),
  content: z.string().optional().describe("Full slide file contents"),
  path: z.string().optional().describe("Custom slide file path relative to deck root"),
  title: z.string().optional().describe("Slide title in deck.json"),
  section: z.string().optional().describe("Slide section in deck.json"),
  transition: z.string().optional().describe("Optional per-slide transition"),
  notes: z.string().optional().describe("Optional notes metadata"),
  position: z.number().optional().describe("Optional slide position in deck.json"),
})

const removeSlideOperationSchema = z.object({
  type: z.literal("remove-slide"),
  id: z.string().describe("Slide id"),
  deleteFile: z.boolean().optional().describe("Delete the slide file as well as the deck.json entry"),
})

const updateDeckOperationSchema = z.object({
  type: z.literal("update-deck"),
  patch: z.object({
    name: z.string().optional(),
    slug: z.string().optional(),
    theme: z.string().optional(),
    transition: z.string().optional(),
    directionalTransition: z.boolean().optional(),
  }).passthrough().describe("Patch object merged into deck.json"),
})

const applyOperationSchema = z.union([
  createDeckOperationSchema,
  writeFileOperationSchema,
  deleteFileOperationSchema,
  renameFileOperationSchema,
  upsertSlideOperationSchema,
  removeSlideOperationSchema,
  updateDeckOperationSchema,
])

const rawApplyOperationSchema = z.object({
  type: operationTypeField,
  op: operationTypeField,
}).passthrough().superRefine((value, ctx) => {
  const normalized = normalizeApplyOperation(value)
  const result = applyOperationSchema.safeParse(normalized)
  if (result.success) return

  for (const issue of result.error.issues) {
    ctx.addIssue(issue)
  }
})

function normalizeApplyOperation(operation) {
  if (operation?.type || !operation?.op) return operation
  return {
    ...operation,
    type: operation.op,
  }
}

export function registerCoreTools(server, context) {
  const { deckRoot } = context

  server.tool(
    "inspect",
    `Inspect the current PromptSlide workspace, a deck, or a specific file. ` +
      `This is the semantic overview tool: use it for deck summaries, slide diagnostics, imports, steps, and runtime state.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      scope: scopeSchema.optional().default("deck").describe("Inspection scope: workspace, deck, file, or slide"),
      path: z.string().optional().describe("Path to inspect when scope is file"),
      slide: z.string().optional().describe("Slide id to inspect when scope is slide"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, scope, path, slide }) => {
      try {
        if (scope === "workspace") {
          return jsonResponse({
            ...getWorkspaceSummary(deckRoot),
            runtime: getRuntimeInfo(deckRoot),
          })
        }

        const { deckPath, deckSlug } = resolveDeckContext(deckRoot, deck)
        if (scope === "deck") {
          return jsonResponse({
            ...getDeckSummary(deckPath),
            runtime: getRuntimeInfo(deckRoot),
          })
        }

        if (scope === "file") {
          if (!path) return jsonResponse({ error: "path is required when scope is file" })
          return jsonResponse({
            deck: deckSlug,
            runtime: getRuntimeInfo(deckRoot),
            file: inspectFile(deckPath, path),
          })
        }

        if (!slide) return jsonResponse({ error: "slide is required when scope is slide" })
        const resolved = resolveSlideFile(deckPath, slide)
        if (!resolved) return jsonResponse({ error: `Slide not found: ${slide}` })
        return jsonResponse({
          deck: deckSlug,
          runtime: getRuntimeInfo(deckRoot),
          file: inspectFile(deckPath, resolved.relativePath),
        })
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "show_tree",
    `Show the PromptSlide workspace or deck file tree. ` +
      `Use this for structural orientation before reading specific files.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      scope: z.enum(["workspace", "deck"]).optional().default("deck").describe("Show the whole workspace or a single deck"),
      path: z.string().optional().describe("Optional directory path relative to the selected root"),
      depth: z.number().optional().default(4).describe("Maximum tree depth to include"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, scope, path, depth }) => {
      try {
        if (scope === "workspace") {
          return jsonResponse(getWorkspaceTree(deckRoot, { path, depth }))
        }

        const { deckPath, deckSlug } = resolveDeckContext(deckRoot, deck)
        return jsonResponse({
          deck: deckSlug,
          ...getWorkspaceTree(deckPath, { path, depth }),
        })
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "read",
    `Read PromptSlide workspace files by path or logical target. ` +
      `Supports raw file paths plus slide, layout, component, and theme targets. Use show_tree first when you need filesystem orientation.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      path: z.string().optional().describe("Path to read relative to the deck root"),
      slide: z.string().optional().describe("Slide id to read"),
      layout: z.string().optional().describe("Layout name to read"),
      component: z.string().optional().describe("Component name to read"),
      theme: z.string().optional().describe("Theme name to read"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, path, slide, layout, component, theme }) => {
      try {
        const { deckPath } = resolveDeckContext(deckRoot, deck)

        if (path) return jsonResponse(readWorkspaceFile(deckPath, path))
        if (slide) {
          const resolved = resolveSlideFile(deckPath, slide)
          if (!resolved) return jsonResponse({ error: `Slide not found: ${slide}` })
          return jsonResponse(inspectFile(deckPath, resolved.relativePath))
        }
        if (layout) {
          const resolved = resolveLayoutFile(deckPath, layout)
          if (!resolved) return jsonResponse({ error: `Layout not found: ${layout}` })
          return jsonResponse(inspectFile(deckPath, resolved.relativePath))
        }
        if (component) {
          const resolved = resolveComponentFile(deckPath, component)
          if (!resolved) return jsonResponse({ error: `Component not found: ${component}` })
          return jsonResponse(inspectFile(deckPath, resolved.relativePath))
        }
        if (theme) {
          const resolved = resolveThemeFile(deckPath, theme)
          if (!resolved) return jsonResponse({ error: `Theme not found: ${theme}` })
          return jsonResponse(inspectFile(deckPath, resolved.relativePath))
        }

        return jsonResponse({
          error: "Provide one of: path, slide, layout, component, theme",
        })
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "search",
    `Search PromptSlide workspace files for matching text or regex patterns before editing slides, layouts, themes, or components.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      query: z.string().describe("Search text or regex pattern"),
      regexp: z.boolean().optional().default(false).describe("Interpret query as a regular expression"),
      scope: z.enum(["workspace", "deck"]).optional().default("deck").describe("Search the whole workspace or a single deck"),
      max_results: z.number().optional().default(50).describe("Maximum number of matches to return"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, query, regexp, scope, max_results }) => {
      try {
        const root = scope === "workspace"
          ? deckRoot
          : resolveDeckContext(deckRoot, deck).deckPath

        return jsonResponse({
          root,
          query,
          regexp: Boolean(regexp),
          matches: searchWorkspaceFiles(root, {
            query,
            regexp: Boolean(regexp),
            maxResults: max_results || 50,
          }),
          files: scope === "workspace" ? listWorkspaceFiles(deckRoot).length : undefined,
        })
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "apply",
    `Apply structured PromptSlide workspace mutations across files and manifests. ` +
      `Supported operations are create-deck, write-file, delete-file, rename-file, upsert-slide, remove-slide, and update-deck. ` +
      `Natural aliases like upsert, create-file, update-file, delete, and rename are also accepted for file operations. ` +
      `Use it after the visual direction is clear and the current workspace has been inspected. Prefer write-file for arbitrary files and upsert-slide when deck.json should stay in sync with a slide file.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      operations: z.array(rawApplyOperationSchema).describe("Structured mutation operations to apply. Use `type` as the canonical field name; `op` is accepted as an alias."),
      validate: z.boolean().optional().default(true).describe("Run deck validation after applying mutations"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, operations, validate }) => {
      try {
        if (!operations?.length) return jsonResponse({ error: "operations must contain at least one item" })

        const normalizedOperations = operations.map(normalizeApplyOperation)

        const createDeckOp = normalizedOperations.find(operation => operation.type === "create-deck")
        let deckSlug = deck
        let deckPath = null
        const affectedPaths = []

        if (createDeckOp) {
          const created = createDeckWorkspace(deckRoot, createDeckOp)
          deckSlug = created.deckSlug
          deckPath = created.deckPath
          affectedPaths.push(...created.affectedPaths.map(path => `${created.deckSlug}/${path}`))
        } else {
          const context = resolveDeckContext(deckRoot, deck)
          deckSlug = context.deckSlug
          deckPath = context.deckPath
        }

        const filteredOperations = normalizedOperations.filter(operation => operation.type !== "create-deck")
        const mutationResult = filteredOperations.length
          ? applyWorkspaceOperations(deckPath, filteredOperations)
          : { affectedPaths: [] }
        affectedPaths.push(...(
          createDeckOp
            ? mutationResult.affectedPaths.map(path => `${deckSlug}/${path}`)
            : mutationResult.affectedPaths
        ))

        const payload = {
          deck: deckSlug,
          affectedPaths,
        }

        if (validate !== false) {
          payload.validation = await validateWorkspaceTarget({
            deckRoot,
            deck: deckSlug,
            scope: "deck",
            includeRuntime: false,
          })
        }

        return jsonResponse(payload)
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "validate",
    `Validate a PromptSlide workspace, deck, slide, or file and return structured diagnostics by phase. Use this before render so import failures, step mismatches, and runtime errors are visible early.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      scope: scopeSchema.optional().default("deck").describe("Validation scope: workspace, deck, file, or slide"),
      slide: z.string().optional().describe("Slide id when scope is slide"),
      path: z.string().optional().describe("Path when scope is file"),
      include_runtime: z.boolean().optional().default(true).describe("Include runtime checks and recent logs"),
      render_check: z.boolean().optional().default(false).describe("Also perform a render check for the target"),
      render_format: z.enum(["png", "html", "overview", "pdf"]).optional().default("png").describe("Render artifact format when render_check is enabled"),
      scale: z.number().optional().describe("Render scale for PNG captures"),
      output_path: z.string().optional().describe("Output path for PDF render checks"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, scope, slide, path, include_runtime, render_check, render_format, scale, output_path }) => {
      try {
        return jsonResponse(await validateWorkspaceTarget({
          deckRoot,
          deck,
          scope,
          slide,
          path,
          includeRuntime: include_runtime !== false,
          renderCheck: Boolean(render_check),
          renderFormat: render_format,
          scale,
          outputPath: output_path,
        }))
      } catch (error) {
        return errorResponse(error)
      }
    }
  )

  server.tool(
    "render",
    `Render PromptSlide artifacts from the live runtime. Supports slide PNG, slide HTML, deck overview PNG, and deck PDF outputs. Validate first when a slide may be broken or newly edited.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      format: z.enum(["png", "html", "overview", "pdf"]).describe("Artifact format to render"),
      slide: z.string().optional().describe("Slide id for slide-scoped formats"),
      scale: z.number().optional().default(1).describe("PNG capture scale"),
      output_path: z.string().optional().describe("Output path for PDF renders"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, format, slide, scale, output_path }) => {
      try {
        const scope = format === "overview" || format === "pdf" ? "deck" : "slide"
        const validation = await validateWorkspaceTarget({
          deckRoot,
          deck,
          scope,
          slide,
          includeRuntime: true,
          renderCheck: false,
        })

        const { deckSlug, port } = await ensureRuntimeContext({ deckRoot, deck })
        const result = await renderArtifact({
          deckRoot,
          deck: deckSlug,
          port,
          format,
          slide,
          scale,
          outputPath: output_path,
          staticDiagnostics: validation.diagnostics,
        })

        if (!result.ok || !result.data) {
          return jsonResponse(result)
        }

        if (result.data.mimeType === "image/png") {
          const image = imageResponse(result.data.data, "image/png")
          if (!validation.diagnostics.length) return image
          return appendTextNotice(image, JSON.stringify({
            ok: result.ok,
            target: result.target,
            diagnostics: validation.diagnostics,
            summary: validation.summary,
          }, null, 2))
        }

        if (result.data.mimeType === "text/html") {
          return textResponse(result.data.data)
        }

        return jsonResponse({
          ...result,
          path: result.data.path,
        })
      } catch (error) {
        return errorResponse(error)
      }
    }
  )
}

export function getLegacyImportHint(deckPath, kind, name, fromFile) {
  return buildImportSpecifier(deckPath, { kind, name, fromFile })
}
