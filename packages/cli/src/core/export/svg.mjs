import { svgLinearFill } from "./svg-gradient.mjs"
// SVG paint is planned per leaf, so a masked background does not consume its
// editable foreground paths and text. Coordinates come from Chromium's CTMs.
import { nativeDotPattern } from "./svg-pattern.mjs"

export function extractSvg(
  element,
  { style, color, emit: emitNode, fallback, issue, rootBox, opacity: rootOpacity }
) {
  const svgGroup = element.getAttribute("data-ps-pptx-object")
  function grouped(node) {
    if (node) {
      node.svgGroup = svgGroup
      node.svgGroupName = element.getAttribute("aria-label") || "SVG illustration"
    }
    return node
  }
  const emit = (...args) => grouped(emitNode(...args))
  const definitions = new Set([
    "defs",
    "pattern",
    "mask",
    "clippath",
    "filter",
    "lineargradient",
    "radialgradient",
    "stop",
    "title",
    "desc"
  ])
  function localFallback(e, code, message) {
    return grouped(fallback(e, code, message, "subtree", 1))
  }
  function visit(e, opacity, approximate = false, isRoot = false) {
    const s = style(e),
      tag = e.tagName.toLowerCase()
    if (
      definitions.has(tag) ||
      s.display === "none" ||
      s.visibility !== "visible" ||
      Number(s.opacity) === 0
    )
      return
    const alpha = opacity * (isRoot ? 1 : Number(s.opacity))
    if (nativeDotPattern(e, { style, color, emit, issue, rootBox, opacity: alpha })) return
    if (
      s.clipPath !== "none" ||
      (s.mask !== "none" && s.maskImage !== "none") ||
      s.filter !== "none" ||
      s.mixBlendMode !== "normal"
    )
      return localFallback(
        e,
        "SVG_EFFECT_FALLBACK",
        "SVG mask, filter or clipping retained as a localized graphic."
      )
    if (["svg", "g", "a"].includes(tag)) {
      const translucent = !isRoot && Number(s.opacity) < 1 && e.children.length > 1
      if (translucent)
        issue(
          e,
          "SVG_GROUP_OPACITY_APPROXIMATED",
          "SVG group opacity is applied to native child objects; overlapping edges may differ."
        )
      for (const child of e.children) visit(child, alpha, approximate || translucent)
      return
    }
    const matrix = e.getScreenCTM()
    if (!matrix) return
    const scale = Math.hypot(matrix.a, matrix.b),
      otherScale = Math.hypot(matrix.c, matrix.d)
    const orthogonal =
      Math.abs(matrix.a * matrix.c + matrix.b * matrix.d) < 0.0001 &&
      Math.abs(scale - otherScale) < 0.0001 &&
      matrix.a * matrix.d - matrix.b * matrix.c > 0
    if (tag === "text") {
      const text = e.textContent || ""
      if (!text.trim()) return
      if (
        matrix.a * matrix.d - matrix.b * matrix.c <= 1e-10 ||
        e.querySelector("tspan,textPath") ||
        (!orthogonal && !/^[\x20-\x7e]+$/.test(text)) ||
        (s.stroke !== "none" && color(s.stroke)?.alpha > 0) ||
        /url\(/.test(s.fill)
      )
        return localFallback(
          e,
          "SVG_TEXT_AFFINE_FALLBACK",
          "Skewed or complex SVG text retained as a localized graphic."
        )
      const start = e.getStartPositionOfChar(0),
        fontSize = parseFloat(s.fontSize)
      const width = e.getComputedTextLength() * scale,
        height = fontSize * scale
      const center = new DOMPoint(
        start.x + e.getComputedTextLength() / 2,
        start.y - fontSize / 2
      ).matrixTransform(matrix)
      const b = {
        x: center.x - rootBox.x - width / 2,
        y: center.y - rootBox.y - height / 2,
        width,
        height
      }
      const font = {
        family: s.fontFamily,
        size: fontSize,
        renderScale: orthogonal ? scale : 1,
        weight: Number(s.fontWeight) || 400,
        style: s.fontStyle,
        variation: s.fontVariationSettings,
        features: s.fontFeatureSettings,
        letterSpacing: parseFloat(s.letterSpacing) || 0,
        color: color(s.fill),
        opacity: Number(s.fillOpacity),
        decoration: s.textDecorationLine,
        language: document.documentElement.lang || "en",
        direction: s.direction
      }
      const localBox = {
        x: start.x,
        y: start.y - fontSize,
        width: e.getComputedTextLength() + 2,
        height: fontSize
      }
      let glyphOrigins
      if (!orthogonal) {
        const original = e.getBBox(),
          saved = e.style.cssText
        try {
          e.style.setProperty("dominant-baseline", "alphabetic", "important")
          e.style.setProperty("alignment-baseline", "baseline", "important")
          const baselineShift = original.y - e.getBBox().y
          glyphOrigins = Array.from(text, (_, i) => {
            const point = e.getStartPositionOfChar(i)
            return { x: point.x, y: point.y + baselineShift }
          })
        } finally {
          e.style.cssText = saved
        }
      }
      const actual = e.getBoundingClientRect()
      const bounds = orthogonal
        ? b
        : {
            x: actual.x - rootBox.x,
            y: actual.y - rootBox.y,
            width: actual.width,
            height: actual.height
          }
      const node = emit(
        e,
        "text",
        {
          lines: [
            {
              ...b,
              baseline: b.y + height,
              rotate: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
              ...(!orthogonal
                ? {
                    affine: {
                      localBox,
                      glyphOrigins,
                      matrix: [
                        matrix.a,
                        matrix.b,
                        matrix.c,
                        matrix.d,
                        matrix.e - rootBox.x,
                        matrix.f - rootBox.y
                      ]
                    }
                  }
                : {}),
              runs: [{ text, font }]
            }
          ],
          textCharacters: text.length,
          approximation: approximate
        },
        bounds,
        "",
        alpha
      )
      node.name = text
      return
    }
    if (!["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"].includes(tag))
      return localFallback(
        e,
        "SVG_FEATURE_FALLBACK",
        "Unsupported SVG element retained as a localized graphic."
      )
    const gradientFill = svgLinearFill(e, matrix, { style, color })
    if (
      (/url\(|gradient/.test(s.fill) && !gradientFill) ||
      /url\(|gradient/.test(s.stroke) ||
      e.getAttribute("fill-rule") === "evenodd" ||
      s.fillRule === "evenodd" ||
      [s.markerStart, s.markerMid, s.markerEnd].some(v => v && v !== "none") ||
      (s.stroke !== "none" && !orthogonal) ||
      parseFloat(s.strokeDashoffset) !== 0
    )
      return localFallback(
        e,
        "SVG_FEATURE_FALLBACK",
        "Unsupported SVG paint retained as a localized graphic."
      )
    const n = key => e[key]?.baseVal?.value ?? Number(e.getAttribute(key) || 0)
    let d =
      s.d === "none" && tag === "path"
        ? null
        : s.d
          ? /^path\(["'](.*)["']\)$/.exec(s.d)?.[1]
          : e.getAttribute("d")
    if (tag === "rect") {
      const bounds = e.getBBox()
      const length = key =>
        !s[key] || s[key] === "auto"
          ? null
          : /^[-+\d.]+(?:px)?$/.test(s[key])
            ? parseFloat(s[key])
            : NaN
      let rx = length("rx"),
        ry = length("ry")
      if (Number.isNaN(rx) || Number.isNaN(ry))
        return localFallback(
          e,
          "SVG_GEOMETRY_FALLBACK",
          "Unsupported SVG corner geometry retained as a localized graphic."
        )
      rx = Math.min(rx ?? ry ?? 0, bounds.width / 2)
      ry = Math.min(ry ?? rx, bounds.height / 2)
      const { x, y, width: w, height: h } = bounds
      if (w <= 0 || h <= 0) return
      d =
        rx || ry
          ? `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
          : `M${x} ${y}h${w}v${h}h${-w}Z`
    } else if (["circle", "ellipse"].includes(tag)) {
      const bounds = e.getBBox(),
        rx = bounds.width / 2,
        ry = bounds.height / 2,
        x = bounds.x + rx,
        y = bounds.y + ry
      if (rx <= 0 || ry <= 0) return
      d = `M${x - rx} ${y}A${rx} ${ry} 0 1 0 ${x + rx} ${y}A${rx} ${ry} 0 1 0 ${x - rx} ${y}Z`
    } else if (tag === "line") d = `M${n("x1")} ${n("y1")}L${n("x2")} ${n("y2")}`
    else if (["polygon", "polyline"].includes(tag))
      d = "M" + e.getAttribute("points") + (tag === "polygon" ? "Z" : "")
    if (!d) return
    const width = parseFloat(s.strokeWidth) * scale
    let dashValues =
      s.strokeDasharray === "none"
        ? null
        : s.strokeDasharray
            .split(/[ ,]+/)
            .filter(Boolean)
            .map(v => parseFloat(v) * scale)
    if (
      dashValues &&
      (dashValues.length > 32 || dashValues.some(v => !Number.isFinite(v) || v <= 0))
    )
      return localFallback(
        e,
        "SVG_DASH_FALLBACK",
        "Unsupported SVG dash pattern retained as a localized graphic."
      )
    if (dashValues?.length % 2) dashValues = [...dashValues, ...dashValues]
    const r = e.getBoundingClientRect(),
      pad = gradientFill && s.stroke === "none" ? 0 : Math.max(0.5, width / 2)
    const b = {
      x: r.x - rootBox.x - pad,
      y: r.y - rootBox.y - pad,
      width: r.width + 2 * pad,
      height: r.height + 2 * pad
    }
    if (gradientFill?.stops.some(stop => stop.color.alpha < 1))
      issue(
        e,
        "GRADIENT_INTERPOLATION_APPROXIMATED",
        "Transparent SVG gradient uses sampled premultiplied-color native stops."
      )
    return emit(
      e,
      "paths",
      {
        approximation: approximate || !!gradientFill?.stops.some(stop => stop.color.alpha < 1),
        paths: [
          {
            d,
            matrix: [
              matrix.a,
              matrix.b,
              matrix.c,
              matrix.d,
              matrix.e - rootBox.x - b.x,
              matrix.f - rootBox.y - b.y
            ],
            fill: gradientFill || color(s.fill),
            stroke: color(s.stroke),
            fillOpacity: Number(s.fillOpacity),
            strokeOpacity: Number(s.strokeOpacity),
            strokeWidth: width,
            cap: s.strokeLinecap,
            join: s.strokeLinejoin,
            dashValues
          }
        ]
      },
      b,
      "",
      alpha
    )
  }
  visit(element, rootOpacity, false, true)
}
