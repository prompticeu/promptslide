import { exportPdf } from "../pdf-export.mjs"
import { captureSlideHtml, takeDeckOverview, takeScreenshot } from "../screenshot.mjs"
import { createResult, diagnosticFromError, mergeDiagnostics } from "./diagnostics.mjs"
import { getRecentRuntimeDiagnostics } from "./runtime.mjs"
import { resolveDeckContext } from "./workspace.mjs"

export async function renderArtifact({
  deckRoot,
  deck,
  port,
  format,
  slide,
  scale,
  outputPath,
  staticDiagnostics = [],
} = {}) {
  const { deckPath, deckSlug } = resolveDeckContext(deckRoot, deck)
  const runtimeDiagnostics = getRecentRuntimeDiagnostics(deckRoot)
  const target = slide ? `slide:${slide}` : `deck:${deckSlug}`

  try {
    if (format === "png") {
      const data = await takeScreenshot({
        deckRoot: deckPath,
        deckSlug,
        slideId: slide,
        devServerPort: port,
        scale: scale || 1,
      })

      return createResult({
        target,
        diagnostics: staticDiagnostics,
        data: { mimeType: "image/png", data },
      })
    }

    if (format === "html") {
      const html = await captureSlideHtml({
        deckRoot: deckPath,
        deckSlug,
        slideId: slide,
        devServerPort: port,
      })

      return createResult({
        target,
        diagnostics: staticDiagnostics,
        data: { mimeType: "text/html", data: html },
      })
    }

    if (format === "overview") {
      const data = await takeDeckOverview({
        deckRoot: deckPath,
        deckSlug,
        devServerPort: port,
      })

      return createResult({
        target,
        diagnostics: staticDiagnostics,
        data: { mimeType: "image/png", data },
      })
    }

    if (format === "pdf") {
      const path = await exportPdf({
        deckRoot: deckPath,
        deckSlug,
        devServerPort: port,
        outputPath,
      })

      return createResult({
        target,
        diagnostics: staticDiagnostics,
        data: { path },
      })
    }

    throw new Error(`Unsupported render format: ${format}`)
  } catch (error) {
    return createResult({
      target,
      diagnostics: mergeDiagnostics(
        staticDiagnostics,
        runtimeDiagnostics,
        [diagnosticFromError(error, {
          phase: "render",
          severity: "error",
          target,
          hint: "Inspect runtime diagnostics to see whether the failure started in import resolution, browser execution, or render readiness.",
        })],
      ),
    })
  }
}
