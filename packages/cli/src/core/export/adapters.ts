import type { PptxExportAdapter } from "./types"

const adapters = new Map<string, PptxExportAdapter>()
/** Register in a slide module. Return the disposer for HMR or temporary adapters. */
export function registerPptxExportAdapter(adapter: PptxExportAdapter) {
  if (!adapter.id || adapters.has(adapter.id))
    throw new Error(`Duplicate PowerPoint adapter: ${adapter.id}`)
  adapters.set(adapter.id, adapter)
  return () => adapters.delete(adapter.id)
}
export function getPptxExportAdapters() {
  return [...adapters.values()]
}
