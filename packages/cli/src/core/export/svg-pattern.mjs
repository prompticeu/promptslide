// Bounded dot patterns with a single white radial alpha mask. Each dot remains
// a native ellipse; its center alpha is admitted only below a 1/255 error bound.
export function nativeDotPattern(e, { style, color, emit, issue, rootBox, opacity }) {
  if (e.tagName.toLowerCase() !== "rect") return false
  const s = style(e)
  const reference = value => {
    const match = /^url\(["']?([^"')]+)["']?\)$/.exec(value)
    if (!match) return null
    try {
      const url = new URL(match[1], document.baseURI)
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash)
        return null
      return document.getElementById(decodeURIComponent(url.hash.slice(1)))
    } catch {
      return null
    }
  }
  const number = (element, name, fallback = 0) => {
    const value = element.getAttribute(name)
    return value === null
      ? fallback
      : /^[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?$/i.test(value.trim())
        ? Number(value)
        : NaN
  }
  const fraction = (value, fallback) =>
    value === null
      ? fallback
      : /^[-+]?(?:\d*\.)?\d+%?$/.test(value.trim())
        ? parseFloat(value) / (value.endsWith("%") ? 100 : 1)
        : NaN
  const pattern = reference(s.fill),
    mask = reference(s.maskImage)
  const inherited = element =>
    element.hasAttribute("href") || element.hasAttributeNS("http://www.w3.org/1999/xlink", "href")
  if (
    pattern?.tagName.toLowerCase() !== "pattern" ||
    mask?.tagName.toLowerCase() !== "mask" ||
    s.stroke !== "none" ||
    s.filter !== "none" ||
    s.clipPath !== "none" ||
    s.mixBlendMode !== "normal" ||
    e.hasAttribute("transform") ||
    parseFloat(s.rx) > 0 ||
    parseFloat(s.ry) > 0
  )
    return false
  if (
    pattern.getAttribute("patternUnits") !== "userSpaceOnUse" ||
    pattern.hasAttribute("patternTransform") ||
    pattern.hasAttribute("viewBox") ||
    inherited(pattern) ||
    (pattern.getAttribute("patternContentUnits") || "userSpaceOnUse") !== "userSpaceOnUse"
  )
    return false
  if (
    pattern.children.length !== 1 ||
    pattern.firstElementChild.tagName.toLowerCase() !== "circle" ||
    mask.children.length !== 1 ||
    mask.firstElementChild.tagName.toLowerCase() !== "rect" ||
    (mask.getAttribute("maskContentUnits") || "userSpaceOnUse") !== "userSpaceOnUse" ||
    ["x", "y", "width", "height", "transform", "href"].some(a => mask.hasAttribute(a))
  )
    return false
  const circle = pattern.firstElementChild,
    cover = mask.firstElementChild,
    cs = style(circle),
    ms = style(cover)
  if (
    [circle, cover].some(child => child.hasAttribute("transform")) ||
    [cs, ms, style(pattern), style(mask)].some(
      value =>
        value.transform !== "none" ||
        value.clipPath !== "none" ||
        value.maskImage !== "none" ||
        value.mixBlendMode !== "normal"
    ) ||
    circle.children.length ||
    parseFloat(ms.rx) > 0 ||
    parseFloat(ms.ry) > 0 ||
    cs.stroke !== "none" ||
    cs.filter !== "none" ||
    cs.visibility !== "visible" ||
    cs.display === "none" ||
    ms.visibility !== "visible" ||
    ms.display === "none" ||
    Number(cs.opacity) !== 1 ||
    ms.stroke !== "none" ||
    ms.filter !== "none" ||
    Number(ms.opacity) !== 1
  )
    return false
  const gradient = reference(ms.fill)
  if (
    gradient?.tagName.toLowerCase() !== "radialgradient" ||
    (gradient.getAttribute("gradientUnits") || "objectBoundingBox") !== "objectBoundingBox" ||
    (gradient.getAttribute("spreadMethod") || "pad") !== "pad" ||
    inherited(gradient) ||
    ["gradientTransform", "fx", "fy", "fr"].some(a => gradient.hasAttribute(a))
  )
    return false
  const stops = [...gradient.children].map(stop => ({
    offset: fraction(stop.getAttribute("offset"), NaN),
    color: color(style(stop).stopColor),
    alpha: Number(style(stop).stopOpacity)
  }))
  if (
    stops.length < 2 ||
    stops.length > 16 ||
    gradient.children.length !== gradient.querySelectorAll(":scope > stop").length ||
    stops.some(
      (stop, i) =>
        !Number.isFinite(stop.offset) ||
        stop.offset < 0 ||
        stop.offset > 1 ||
        !Number.isFinite(stop.alpha) ||
        stop.alpha < 0 ||
        stop.alpha > 1 ||
        stop.color?.hex !== "FFFFFF" ||
        stop.color.alpha !== 1 ||
        (i && stop.offset <= stops[i - 1].offset)
    )
  )
    return false
  const fill = color(cs.fill),
    tileW = number(pattern, "width"),
    tileH = number(pattern, "height"),
    tileX = number(pattern, "x"),
    tileY = number(pattern, "y"),
    cx = number(circle, "cx"),
    cy = number(circle, "cy"),
    r = number(circle, "r"),
    x = number(e, "x"),
    y = number(e, "y"),
    w = number(e, "width"),
    h = number(e, "height"),
    mx = number(cover, "x"),
    my = number(cover, "y"),
    mw = number(cover, "width"),
    mh = number(cover, "height"),
    gx = fraction(gradient.getAttribute("cx"), 0.5),
    gy = fraction(gradient.getAttribute("cy"), 0.5),
    gr = fraction(gradient.getAttribute("r"), 0.5)
  if (
    ![tileW, tileH, tileX, tileY, cx, cy, r, x, y, w, h, mx, my, mw, mh, gx, gy, gr].every(
      Number.isFinite
    ) ||
    !fill ||
    tileW <= 0 ||
    tileH <= 0 ||
    r <= 0 ||
    w <= 0 ||
    h <= 0 ||
    mw <= 0 ||
    mh <= 0 ||
    gr <= 0 ||
    cx - r < 0 ||
    cy - r < 0 ||
    cx + r > tileW ||
    cy + r > tileH ||
    x < mx ||
    y < my ||
    x + w > mx + mw ||
    y + h > my + mh
  )
    return false
  for (const [element, expected] of [
    [e, { x, y, width: w, height: h }],
    [cover, { x: mx, y: my, width: mw, height: mh }],
    [circle, { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }]
  ]) {
    const actual = element.getBBox()
    if (Object.keys(expected).some(key => Math.abs(actual[key] - expected[key]) > 0.0001))
      return false
  }
  const slope = Math.max(
    ...stops
      .slice(1)
      .map((stop, i) => Math.abs(stop.alpha - stops[i].alpha) / (stop.offset - stops[i].offset))
  )
  const fillAlpha = fill.alpha * Number(cs.fillOpacity) * Number(s.fillOpacity)
  if (!Number.isFinite(fillAlpha) || fillAlpha <= 0 || fillAlpha > 1) return false
  if (((slope * r) / (Math.min(mw, mh) * gr)) * fillAlpha * opacity > 1 / 255) return false
  const matrix = e.getScreenCTM()
  if (!matrix) return false
  const scale = Math.hypot(matrix.a, matrix.b)
  if (
    !(scale > 0) ||
    Math.abs(scale - Math.hypot(matrix.c, matrix.d)) > 0.0001 ||
    Math.abs(matrix.a * matrix.c + matrix.b * matrix.d) > 0.0001 ||
    matrix.a * matrix.d - matrix.b * matrix.c <= 0
  )
    return false
  const alphaAt = distance => {
    if (distance <= stops[0].offset) return stops[0].alpha
    const index = stops.findIndex(stop => stop.offset >= distance)
    if (index < 0) return stops.at(-1).alpha
    const a = stops[index - 1],
      b = stops[index],
      t = (distance - a.offset) / (b.offset - a.offset)
    return a.alpha * (1 - t) + b.alpha * t
  }
  const firstX = Math.floor((x - tileX - cx - r) / tileW),
    lastX = Math.ceil((x + w - tileX - cx + r) / tileW),
    firstY = Math.floor((y - tileY - cy - r) / tileH),
    lastY = Math.ceil((y + h - tileY - cy + r) / tileH)
  if ((lastX - firstX + 1) * (lastY - firstY + 1) > 4096) return false
  const dots = []
  for (let row = firstY; row <= lastY; row++)
    for (let column = firstX; column <= lastX; column++) {
      const dx = tileX + column * tileW + cx,
        dy = tileY + row * tileH + cy
      if (dx + r <= x || dy + r <= y || dx - r >= x + w || dy - r >= y + h) continue
      if (dx - r < x || dy - r < y || dx + r > x + w || dy + r > y + h) return false
      const alpha = alphaAt(Math.hypot((dx - mx) / mw - gx, (dy - my) / mh - gy) / gr) * fillAlpha
      if (alpha > 0)
        dots.push({
          x: matrix.a * dx + matrix.c * dy + matrix.e - rootBox.x,
          y: matrix.b * dx + matrix.d * dy + matrix.f - rootBox.y,
          alpha
        })
    }
  if (!dots.length) return false
  for (const [index, dot] of dots.entries()) {
    const diameter = 2 * r * scale,
      rr = diameter / 2
    emit(
      e,
      "shape",
      {
        fill: { hex: fill.hex, alpha: dot.alpha },
        border: null,
        radii: Array.from({ length: 4 }, () => [rr, rr]),
        approximation: true
      },
      { x: dot.x - rr, y: dot.y - rr, width: diameter, height: diameter },
      `:pattern:${index}`,
      opacity
    )
  }
  issue(
    e,
    "SVG_PATTERN_MASK_APPROXIMATED",
    "Dot pattern uses native editable ellipses with sampled mask opacity; per-dot alpha variation is bounded to 1/255."
  )
  return true
}
