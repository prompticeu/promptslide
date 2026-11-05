// @ts-expect-error Shared PDF paint fixes used by the controlled Chromium exporter.
import * as pdfPaint from "../core/export/pdf-paint.mjs"
// @ts-expect-error Shared browser readiness implementation.
import { preparePdfDocument } from "../core/export/ready.mjs"
// @ts-expect-error Bounded, credential-free asset downloads.
import { assetBytes, dataUrl } from "./assets.mjs"
// @ts-expect-error Browser-only capture; does not invoke the PPTX/font conversion engine.
import { captureFallback } from "./capture.mjs"

export interface BrowserPdfIssue {
  code: "PDF_PATTERN_EXPANDED" | "PDF_GRADIENT_TEXT_GRAPHIC" | "PDF_PRINT_SCALE_NORMALIZED"
  page: number
  message: string
}

// Chromium can omit content on later PDF pages when a clipped subtree contains
// a transform-scaled group. An isolated, top-left uniform scale can use zoom
// instead, retaining native text/vectors without the transform print compositor.
function normalizePrintScales(slide: HTMLElement): number {
  if (!CSS.supports("zoom", "1")) return 0
  let converted = 0
  for (const element of slide.querySelectorAll<HTMLElement>("*")) {
    if (!(element instanceof HTMLElement) || element.parentElement?.children.length !== 1) continue
    const css = getComputedStyle(element)
    // The reproduced disappearing-chart case uses CSS's individual scale
    // property. Leave ordinary transform-only groups on their existing path.
    if (css.scale === "none") continue
    const matrix = new DOMMatrix(css.transform)
    const independent = css.scale.split(" ").map(Number)
    const x = matrix.a * independent[0]!
    const y = matrix.d * (independent[1] ?? independent[0]!)
    if (
      !matrix.is2D ||
      independent.length > 2 ||
      matrix.b ||
      matrix.c ||
      matrix.e ||
      matrix.f ||
      !(x > 0) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      Math.abs(x - y) > 1e-6 ||
      Math.abs(x - 1) < 1e-6 ||
      css.transformOrigin !== "0px 0px" ||
      css.rotate !== "none" ||
      css.translate !== "none"
    )
      continue
    let clipped = false
    for (
      let parent: HTMLElement | null = element.parentElement;
      parent && parent !== slide;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent)
      if ([style.overflowX, style.overflowY].some(value => value === "hidden" || value === "clip"))
        clipped = true
    }
    if (!clipped) continue
    const original = element.getAttribute("style")
    const before = element.getBoundingClientRect()
    const surrounding = [slide, ...slide.querySelectorAll("*")]
      .filter(node => node !== element && !element.contains(node))
      .map(node => ({ node, box: node.getBoundingClientRect() }))
    element.style.setProperty("zoom", String(x * Number(css.zoom || 1)), "important")
    element.style.setProperty("transform", "none", "important")
    element.style.setProperty("scale", "none", "important")
    const after = element.getBoundingClientRect()
    const moved = (first: DOMRect, second: DOMRect) =>
      (["x", "y", "width", "height"] as const).some(key => Math.abs(first[key] - second[key]) > 0.5)
    if (
      (["x", "y", "width"] as const).some(key => Math.abs(before[key] - after[key]) > 0.5) ||
      surrounding.some(({ node, box }) => moved(box, node.getBoundingClientRect()))
    ) {
      if (original === null) element.removeAttribute("style")
      else element.setAttribute("style", original)
    } else {
      element.setAttribute("data-ps-pdf-print-scale", "zoom")
      converted++
    }
  }
  return converted
}

/** Embed only the font faces needed to paint the gradient text in an SVG image. */
async function captureFontCss(elements: Element[], signal: AbortSignal) {
  const families = new Set(
    elements.flatMap(element =>
      [element, ...element.querySelectorAll("*")].flatMap(node =>
        getComputedStyle(node)
          .fontFamily.split(",")
          .map(name =>
            name
              .trim()
              .replace(/^['"]|['"]$/g, "")
              .toLowerCase()
          )
      )
    )
  )
  const faces: Array<{ css: string; base: string }> = []
  const visited = new Set<string>()
  const parse = async (text: string, base: string) => {
    for (const [css] of text.matchAll(/@font-face\s*\{[^}]+\}/gi)) {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(css)
      const rule = sheet.cssRules[0] as CSSFontFaceRule | undefined
      const family = rule?.style
        .getPropertyValue("font-family")
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .toLowerCase()
      if (family && families.has(family)) faces.push({ css, base })
    }
    for (const [, quoted, bare] of text.matchAll(
      /@import\s+(?:url\(\s*)?(?:["']([^"']+)["']|([^\s);]+))\s*\)?[^;]*;/gi
    ))
      await stylesheet(new URL(quoted || bare!, base).href)
  }
  const stylesheet = async (url: string): Promise<void> => {
    if (visited.has(url)) return
    visited.add(url)
    if (visited.size > 30) throw new Error("Too many PDF font stylesheets")
    const { bytes } = await assetBytes(url, { signal, maxBytes: 2 * 1024 * 1024 })
    await parse(bytes.toString(), url)
  }
  for (const sheet of document.styleSheets) {
    signal.throwIfAborted()
    let text: string
    try {
      text = [...sheet.cssRules].map(rule => rule.cssText).join("\n")
    } catch {
      if (sheet.href) await stylesheet(sheet.href)
      continue
    }
    await parse(text, sheet.href || document.baseURI)
  }
  const downloaded = new Map<string, Promise<string>>()
  let total = 0
  const result: string[] = []
  for (const face of faces) {
    let css = face.css
    for (const [match, quoted, single, bare] of face.css.matchAll(
      /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/gi
    )) {
      const url = new URL(quoted || single || bare!, face.base).href
      if (!downloaded.has(url))
        downloaded.set(
          url,
          assetBytes(url, { signal }).then(
            ({ bytes, type }: { bytes: Uint8Array; type: string }) => {
              total += bytes.length
              if (total > 50 * 1024 * 1024) throw new Error("PDF font assets exceed 50 MB")
              return dataUrl(bytes, type)
            }
          )
        )
      css = css.replace(match, `url("${await downloaded.get(url)}")`)
    }
    result.push(css)
  }
  return result.join("\n")
}

/**
 * Prepare an export-only document before window.print(). Keeps normal PDF text,
 * shapes and gradients; normalizes known problematic paint without a server.
 * This does not perform the controlled exporter's per-slide PDF printing/merge.
 */
export async function prepareBrowserPdf(
  root: HTMLElement,
  options: {
    signal?: AbortSignal
    timeoutMs?: number
    onIssue?: (issue: BrowserPdfIssue) => void
  } = {}
): Promise<void> {
  const controller = new AbortController()
  const signal = controller.signal
  const abort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener("abort", abort, { once: true })
  if (options.signal?.aborted) abort()
  let timer: ReturnType<typeof setTimeout> | undefined
  const operation = async () => {
    signal.throwIfAborted()
    await preparePdfDocument(root)
    signal.throwIfAborted()
    const slides = root.matches(".pdf-slide")
      ? [root]
      : [...root.querySelectorAll<HTMLElement>(".pdf-slide")]
    if (!slides.length) throw new Error("There are no PDF slides to print")
    let fontCss: string | undefined
    for (const [index, slide] of slides.entries()) {
      signal.throwIfAborted()
      if (normalizePrintScales(slide))
        options.onIssue?.({
          code: "PDF_PRINT_SCALE_NORMALIZED",
          page: index + 1,
          message:
            "Isolated uniform scaling uses equivalent print zoom to retain clipped content on later PDF pages."
        })
      const patterns = pdfPaint.normalizeDotPatterns(slide)
      for (let pattern = 0; pattern < patterns.length; pattern++)
        options.onIssue?.({
          code: "PDF_PATTERN_EXPANDED",
          page: index + 1,
          message: "Masked dot pattern uses explicit vector circles."
        })
      const targets = pdfPaint.gradientTextTargets(slide) as Array<{ id: string }>
      if (!targets.length) continue
      if (fontCss === undefined) fontCss = await captureFontCss(slides, signal)
      for (const target of targets) {
        const capture = await captureFallback(
          slide,
          { payload: { elementId: target.id, scope: "subtree" } },
          { fontCss, signal, scale: 2 }
        )
        signal.throwIfAborted()
        if (!capture) throw new Error("Gradient text could not be prepared for PDF printing")
        const origin = slide.getBoundingClientRect()
        await pdfPaint.replaceGradientText(slide, target.id, {
          data: capture.data,
          x: origin.x + capture.box.x,
          y: origin.y + capture.box.y,
          width: capture.box.width,
          height: capture.box.height
        })
        options.onIssue?.({
          code: "PDF_GRADIENT_TEXT_GRAPHIC",
          page: index + 1,
          message: "Gradient text uses localized 2× paint with selectable text underneath."
        })
      }
    }
    await preparePdfDocument(root)
    signal.throwIfAborted()
  }
  try {
    await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        const fail = () => reject(signal.reason)
        if (signal.aborted) fail()
        else signal.addEventListener("abort", fail, { once: true })
        timer = setTimeout(
          () =>
            controller.abort(
              new Error("PDF preparation timed out. Check the slide fonts and images.")
            ),
          options.timeoutMs ?? 60000
        )
      })
    ])
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener("abort", abort)
  }
}
