import type { PptxExportAdapter } from "../core/export/types"
import type { ThemeConfig } from "../core/types"

// The scene/OOXML implementation is shared with the Node exporter.
// @ts-expect-error Shared JavaScript engine has no generated declarations.
import { exportBrowserPptx as run } from "./export.mjs"

export interface BrowserPptxOptions {
  manifest: Array<{ id: string; steps: number; title?: string; notes?: string }>
  /** Render at 1280 × 720 in this document; keep mounted until the next call. */
  render: (
    index: number,
    step: number,
    showAll: boolean,
    signal: AbortSignal
  ) => Promise<HTMLElement>
  theme?: ThemeConfig
  adapters?: PptxExportAdapter[]
  fontSources?: Array<{ family: string; url: string; weight?: number; style?: "normal" | "italic" }>
  signal?: AbortSignal
  onProgress?: (progress: {
    phase: string
    completed: number
    total: number
    slideId?: string
  }) => void
  mode?: "balanced" | "strict"
  profile?: "core-native" | "extended"
  buildMode?: "final" | "slides" | "native"
  fontPolicy?: "embed-when-permitted" | "require-installed"
  timeout?: number
  rasterScale?: 2 | 3
}
export interface BrowserPptxResult {
  pptx?: Uint8Array
  report: {
    status: string
    issues: Array<{
      code: string
      severity: string
      message: string
      source?: { slideId?: string }
    }>
    [key: string]: unknown
  }
}
/** No server job, process execution, registry credentials or hosted compute. */
export function exportBrowserPptx(options: BrowserPptxOptions): Promise<BrowserPptxResult> {
  return run(options)
}
