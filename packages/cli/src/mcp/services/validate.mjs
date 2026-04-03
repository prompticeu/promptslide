import { existsSync } from "node:fs"
import { join } from "node:path"

import { createDiagnostic, createResult, diagnosticFromError, mergeDiagnostics } from "./diagnostics.mjs"
import { renderArtifact } from "./render.mjs"
import { ensureRuntimeContext, getRecentRuntimeDiagnostics, getRuntimeInfo } from "./runtime.mjs"
import {
  getDeckSummary,
  getWorkspaceSummary,
  inspectFile,
  resolveDeckContext,
  resolveSlideFile,
} from "./workspace.mjs"

function collectDeckDiagnostics(deckSummary) {
  return [
    ...(deckSummary.diagnostics || []),
    ...deckSummary.slides.flatMap(slide => slide.diagnostics || []),
  ]
}

export async function validateWorkspaceTarget({
  deckRoot,
  deck,
  scope = "deck",
  slide,
  path,
  includeRuntime = true,
  renderCheck = false,
  renderFormat = "png",
  scale,
  outputPath,
} = {}) {
  if (scope === "workspace") {
    const workspace = getWorkspaceSummary(deckRoot)
    const diagnostics = []

    for (const summary of workspace.decks) {
      const deckInfo = getDeckSummary(summary.path)
      diagnostics.push(...collectDeckDiagnostics(deckInfo))
    }

    return createResult({
      target: `workspace:${deckRoot}`,
      diagnostics,
      data: workspace,
      runtime: getRuntimeInfo(deckRoot),
    })
  }

  let deckContext
  try {
    deckContext = resolveDeckContext(deckRoot, deck)
  } catch (error) {
    return createResult({
      target: deck ? `deck:${deck}` : "deck",
      diagnostics: [diagnosticFromError(error, { phase: "workspace", severity: "error" })],
    })
  }

  const diagnostics = []
  let data
  let target = `deck:${deckContext.deckSlug}`

  const manifestPath = join(deckContext.deckPath, "deck.json")
  if (!existsSync(manifestPath)) {
    diagnostics.push(createDiagnostic({
      phase: "workspace",
      severity: "error",
      target,
      path: "deck.json",
      code: "deck.missing-manifest",
      message: "Deck is missing deck.json",
      hint: "Create deck.json or recreate the deck structure before validating.",
    }))
  }

  if (scope === "deck") {
    data = getDeckSummary(deckContext.deckPath)
    diagnostics.push(...collectDeckDiagnostics(data))
  } else if (scope === "slide") {
    target = `slide:${slide}`
    const resolved = resolveSlideFile(deckContext.deckPath, slide || "")
    if (!resolved) {
      diagnostics.push(createDiagnostic({
        phase: "workspace",
        severity: "error",
        target,
        message: `Slide not found: ${slide}`,
        code: "slide.not-found",
      }))
    } else {
      data = inspectFile(deckContext.deckPath, resolved.relativePath)
      diagnostics.push(...(data.analysis?.diagnostics || []))
    }
  } else if (scope === "file") {
    target = `file:${path}`
    try {
      data = inspectFile(deckContext.deckPath, path)
      diagnostics.push(...(data.analysis?.diagnostics || []))
    } catch (error) {
      diagnostics.push(diagnosticFromError(error, {
        phase: "workspace",
        severity: "error",
        target,
      }))
    }
  } else {
    diagnostics.push(createDiagnostic({
      phase: "workspace",
      severity: "error",
      target,
      message: `Unsupported validation scope: ${scope}`,
      code: "validate.scope.invalid",
    }))
  }

  let runtime = getRuntimeInfo(deckRoot)
  if (includeRuntime) {
    try {
      const runtimeContext = await ensureRuntimeContext({ deckRoot, deck: deckContext.deckSlug })
      runtime = runtimeContext.runtime
    } catch (error) {
      diagnostics.push(diagnosticFromError(error, {
        phase: "runtime",
        severity: "error",
        target,
      }))
    }
  }

  diagnostics.push(...getRecentRuntimeDiagnostics(deckRoot))

  if (renderCheck) {
    const renderResult = await renderArtifact({
      deckRoot,
      deck: deckContext.deckSlug,
      port: runtime?.port,
      format: renderFormat,
      slide,
      scale,
      outputPath,
      staticDiagnostics: diagnostics,
    })

    return createResult({
      target,
      diagnostics: mergeDiagnostics(renderResult.diagnostics),
      data,
      artifact: renderResult.data,
      runtime,
    })
  }

  return createResult({
    target,
    diagnostics,
    data,
    runtime,
  })
}
