// Object-bounding-box SVG gradients can share the native fill writer when their
// full-range axis remains horizontal/vertical after the element's affine map.
export function svgLinearFill(element, matrix, { style, color }) {
  const s = style(element),
    match = /^url\(["']?([^"')]+)["']?\)$/.exec(s.fill)
  if (
    !match ||
    Math.abs(matrix.b) > 0.0001 ||
    Math.abs(matrix.c) > 0.0001 ||
    !matrix.a ||
    !matrix.d
  )
    return null
  let gradient
  try {
    const url = new URL(match[1], document.baseURI)
    if (url.origin !== location.origin || url.pathname !== location.pathname) return null
    const id = decodeURIComponent(url.hash.slice(1))
    const scope = element.closest("[data-ps-browser-export-root], [data-ps-pptx-root]")
    gradient = scope?.querySelector(`#${CSS.escape(id)}`) || document.getElementById(id)
  } catch {
    return null
  }
  if (
    gradient?.tagName.toLowerCase() !== "lineargradient" ||
    (gradient.getAttribute("gradientUnits") || "objectBoundingBox") !== "objectBoundingBox" ||
    (gradient.getAttribute("spreadMethod") || "pad") !== "pad" ||
    gradient.hasAttribute("gradientTransform") ||
    gradient.hasAttribute("href") ||
    gradient.hasAttributeNS("http://www.w3.org/1999/xlink", "href") ||
    !["srgb", "auto"].includes(style(gradient).colorInterpolation.toLowerCase())
  )
    return null
  const fraction = (name, fallback) => {
    const text = gradient.getAttribute(name)?.trim()
    return text === undefined
      ? fallback
      : /^[-+]?(?:\d*\.)?\d+%?$/.test(text)
        ? parseFloat(text) / (text.endsWith("%") ? 100 : 1)
        : NaN
  }
  const x1 = fraction("x1", 0),
    y1 = fraction("y1", 0),
    x2 = fraction("x2", 1),
    y2 = fraction("y2", 0)
  let angle
  if (x1 === x2 && [0, 1].includes(y1) && y2 === 1 - y1) angle = (y2 - y1) * matrix.d > 0 ? 180 : 0
  else if (y1 === y2 && [0, 1].includes(x1) && x2 === 1 - x1)
    angle = (x2 - x1) * matrix.a > 0 ? 90 : 270
  else return null
  const stops = [...gradient.children].map(stop => {
    const text = stop.getAttribute("offset")?.trim() || "0",
      c = color(style(stop).stopColor)
    return {
      tag: stop.tagName.toLowerCase(),
      children: stop.children.length,
      position: /^[-+]?(?:\d*\.)?\d+%?$/.test(text)
        ? parseFloat(text) / (text.endsWith("%") ? 100 : 1)
        : NaN,
      color: c ? { hex: c.hex, alpha: c.alpha * Number(style(stop).stopOpacity) } : null
    }
  })
  if (
    stops.length < 2 ||
    stops.length > 16 ||
    stops.some(
      (stop, i) =>
        stop.tag !== "stop" ||
        stop.children ||
        !Number.isFinite(stop.position) ||
        stop.position < 0 ||
        stop.position > 1 ||
        !stop.color ||
        !Number.isFinite(stop.color.alpha) ||
        stop.color.alpha < 0 ||
        stop.color.alpha > 1 ||
        (i && stop.position < stops[i - 1].position)
    )
  )
    return null
  if (stops.some(stop => stop.color.hex !== stops[0].color.hex)) return null
  return {
    kind: "linear",
    angle,
    stops: stops.map(stop => ({ position: stop.position, color: stop.color }))
  }
}
