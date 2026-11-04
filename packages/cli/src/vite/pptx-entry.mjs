import { fileURLToPath } from "node:url"

export const PPTX_ENTRY = "virtual:promptslide-pptx"
export function getPptxHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PromptSlide PowerPoint export</title></head><body><div id="root"></div><script type="module" src="/@id/${PPTX_ENTRY}"></script></body></html>`
}
export function getPptxEntry(root) {
  const path = root.replaceAll("\\", "/")
  const measure = fileURLToPath(new URL("../core/export/measure.mjs", import.meta.url)).replaceAll(
    "\\",
    "/"
  )
  return `
import { createElement, useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { AnimationProvider, SlideThemeProvider, SlideErrorBoundary, getPptxExportAdapters } from "promptslide"
import { extractScene, makePaintPreview, makeSubtreePreview } from ${JSON.stringify(measure)}
import ${JSON.stringify(path + "/src/globals.css")}
import { slides } from ${JSON.stringify(path + "/src/deck-config")}
let theme = {}
try { const module = await import(${JSON.stringify(path + "/src/theme")}); theme = module.theme || module.default || {} } catch {}
const style = document.createElement("style")
style.textContent = "html,body,#root{margin:0;padding:0;width:1280px;height:720px;background:transparent}*[data-ps-pptx-root]{width:1280px;height:720px;position:relative;overflow:hidden;background:#000}"
document.head.appendChild(style)
let update, pending, serial = 0, cleanupPaint
const api = window.__promptslidePptx = {
  available: false,
  manifest: slides.map((slide, index) => ({ id: slide.id || 'legacy-' + (index + 1), legacy: !slide.id, title: slide.title || '', notes: slide.notes || '', steps: slide.steps || 0 })),
  theme,
  render(index, step, showAll = true) {
    if (!update || !slides[index] || pending) throw new Error("Invalid or concurrent export render")
    return new Promise((resolve, reject) => { pending = { resolve, reject }; update({ index, step, showAll, key: ++serial }) })
  },
  async measure() {
    const root = document.querySelector('[data-ps-pptx-root]')
    const error = root?.querySelector('[data-slide-error]')
    if (error) throw new Error(error.getAttribute('data-slide-error'))
    return extractScene(root, { slideId: api.manifest[api.index].id, adapters: getPptxExportAdapters(), signal: new AbortController().signal })
  },
  paint(node) { cleanupPaint?.(); cleanupPaint = makePaintPreview(document.querySelector('[data-ps-pptx-root]'), node) },
  isolate(node) { cleanupPaint?.(); cleanupPaint = makeSubtreePreview(document.querySelector('[data-ps-pptx-root]'), node) },
  restorePaint() { cleanupPaint?.(); cleanupPaint = null }
}
function ExportView() {
  const [selection, setSelection] = useState(null)
  useEffect(() => { update = setSelection; api.available = true; return () => { update = null; api.available = false } }, [])
  useEffect(() => {
    if (!selection) return
    let cancelled = false
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
    ;(async () => {
      try {
        await frame(); await frame()
        // fonts.ready can resolve before a newly mounted slide has requested its
        // faces. Explicitly load every rendered text style before measurement.
        const requests = new Map()
        for (const element of document.querySelectorAll('[data-ps-pptx-root] *')) {
          if (![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) continue
          const css = getComputedStyle(element)
          const font = css.fontStyle + ' ' + css.fontWeight + ' ' + css.fontSize + ' ' + css.fontFamily
          requests.set(font, (requests.get(font) || '') + element.textContent)
        }
        await Promise.allSettled([...requests].map(([font, text]) => document.fonts.load(font, text)))
        await document.fonts.ready
        await Promise.all([...document.querySelectorAll('[data-ps-pptx-root] img')].map(async image => {
          if (!image.getClientRects().length || getComputedStyle(image).visibility !== 'visible') return
          image.loading = 'eager'
          try { await image.decode() }
          catch { throw new Error('ASSET_UNAVAILABLE: A slide image could not be loaded. Check its source before exporting: ' + (image.currentSrc || image.getAttribute('src') || '(empty source)')) }
        }))
        await frame(); await frame()
        const error = document.querySelector('[data-slide-error]')
        if (error) throw new Error(error.getAttribute('data-slide-error'))
        if (!cancelled) { api.index = selection.index; const waiter = pending; pending = null; waiter?.resolve(true) }
      } catch(error) { if (!cancelled) { const waiter = pending; pending = null; waiter?.reject(error) } }
    })()
    return () => { cancelled = true }
  }, [selection])
  if (!selection) return null
  const slide = slides[selection.index]
  return createElement('div', { 'data-ps-pptx-root': true, key: selection.key },
    createElement(AnimationProvider, { currentStep: selection.step, totalSteps: slide.steps || 0, showAllAnimations: selection.showAll, isExporting: true },
      createElement(SlideErrorBoundary, { slideIndex: selection.index, slideTitle: slide.title },
        createElement(slide.component, { slideNumber: selection.index + 1, totalSlides: slides.length }))))
}
createRoot(document.getElementById('root')).render(createElement(SlideThemeProvider, { theme }, createElement(ExportView)))
`
}
