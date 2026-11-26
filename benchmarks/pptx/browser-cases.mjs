// Runs inside the browser against the public entry, not a mocked converter.
import { exportBrowserPptx } from "promptslide/browser"

export async function runBrowserCases() {
  const frame = () =>
    new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const style = document.createElement("style")
  const base = new URL("./", location.href)
  style.textContent =
    Array.from(
      { length: 90 },
      (_, index) =>
        `@font-face{font-family:"Unused Host ${index}";src:url("${base}unused-font-${index}.ttf")}`
    ).join("") +
    `@font-face{font-family:"Fallback Face";src:url("${base}missing-font.woff2"),url("${base}fonts/regular.ttf")}`
  document.head.append(style)
  const roots = []
  const root = html => {
    const element = document.createElement("div")
    Object.assign(element.style, {
      position: "fixed",
      left: "-20000px",
      top: "0",
      width: "1280px",
      height: "720px",
      fontFamily: '"DejaVu Sans Mono"'
    })
    element.innerHTML = html
    document.body.append(element)
    roots.push(element)
    return element
  }
  const run = async (id, element, extra = {}) => {
    await frame()
    const result = await exportBrowserPptx({
      manifest: [{ id, steps: 0 }],
      render: async () => element,
      ...extra
    })
    return { bytes: Array.from(result.pptx), report: result.report }
  }
  try {
    const fallbackRoot = root("<p style=\"font:24px 'Fallback Face'\">Editable fallback source</p>")
    await document.fonts.load('24px "Fallback Face"')
    const font = await run("font-sources", fallbackRoot)
    if (
      font.report.fonts.length !== 1 ||
      font.report.issues.some(issue => issue.code === "FONT_UNAVAILABLE")
    )
      throw Error("Fallback font URL was not embedded")
    const hidden = await run(
      "hidden-image",
      root(
        `<img src="${base}missing-hidden.png" style="display:none"/><div style="position:absolute;left:100px;top:100px;width:100px;height:100px;background:red;filter:blur(2px)"/>`
      )
    )
    if (hidden.report.metrics.rasterFallbackObjects !== 1)
      throw Error("Hidden image broke the retained effect: " + JSON.stringify(hidden.report))
    const svgImage = await run(
      "external-svg-image",
      root(
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" style="filter:blur(1px)"><image href="${base}asset.svg" x="20" y="20" width="100" height="100"/></svg>`
      )
    )
    if (svgImage.report.metrics.rasterFallbackObjects !== 1)
      throw Error("SVG image disappeared from fallback")
    const huge = root('<canvas width="20000" height="20000" style="width:10px;height:10px"/>')
    let canvasLimit = false
    try {
      await run("canvas-limit", huge)
    } catch (error) {
      canvasLimit = error.message.startsWith("LIMIT_EXCEEDED: source canvas pixels")
    }
    if (!canvasLimit) throw Error("Source canvas was encoded without a pixel limit")
    // A custom renderer may keep older slide roots connected. Only the current
    // root may be queried when text fallbacks absorb their native descendants.
    const first = root("<p>First</p>"),
      second = root("<p>Second</p>")
    let oldMarkerCleared = false
    await exportBrowserPptx({
      manifest: [
        { id: "first", steps: 0 },
        { id: "second", steps: 0 }
      ],
      render: async index => {
        if (index === 0) return first
        return second
      },
      onProgress: progress => {
        if (progress.phase === "rendering" && progress.completed === 2)
          oldMarkerCleared = !first.hasAttribute("data-ps-browser-export-root")
      }
    })
    if (!oldMarkerCleared || second.hasAttribute("data-ps-browser-export-root"))
      throw Error("Old export root remained marked")
    return { font, hidden, svgImage, canvasLimit, oldMarkerCleared }
  } finally {
    style.remove()
    roots.forEach(element => element.remove())
  }
}
