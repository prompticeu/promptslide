import { insideRoundedClip, intersectBoxes, clipSolidRectangle } from "./clip.mjs"
import { normalizedStops } from "./gradient-stops.mjs"
import { parseEllipticalGradient } from "./radial.mjs"
import { extractSvg } from "./svg.mjs"

// Browser-only extraction. Layout is resolved by Chromium, never reconstructed from JSX.
export function splitCss(value) {
  const result = []
  let depth = 0,
    quote = "",
    start = 0
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (quote) {
      if (c === quote && value[i - 1] !== "\\") quote = ""
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === "(") depth++
    else if (c === ")") depth--
    else if (c === "," && !depth) {
      result.push(value.slice(start, i).trim())
      start = i + 1
    }
  }
  result.push(value.slice(start).trim())
  return result
}

export function parseGradient(css, width, height, color) {
  const match = /^(linear|radial)-gradient\((.*)\)$/s.exec(css)
  if (!match) return null
  const args = splitCss(match[2])
  let angle = 180,
    kind = match[1],
    header = ""
  if (
    kind === "linear" &&
    (/^(?:to |[-+.\d].*(?:deg|turn|rad|grad))/.test(args[0]) || /^in /.test(args[0]))
  )
    header = args.shift()
  if (kind === "radial" && /(?:circle|ellipse| at |^at |closest|farthest|^in )/.test(args[0]))
    header = args.shift()
  if (/\bin\s+(?!srgb(?:\s|$))/.test(header)) return null
  if (
    kind === "radial" &&
    ((!/\bcircle\b/.test(header) && Math.abs(width - height) > 0.001) ||
      /closest|farthest-side|\d+(?:px|em|rem)/.test(header) ||
      (/\bat\b/.test(header) && !/at\s+(?:center(?:\s+center)?|50%\s+50%)(?:\s|$)/.test(header)))
  )
    return null
  if (kind === "linear" && header) {
    const a = /([-+.\d]+)(deg|turn|rad|grad)/.exec(header)
    if (a) angle = Number(a[1]) * { deg: 1, turn: 360, rad: 180 / Math.PI, grad: 0.9 }[a[2]]
    else if (/^to /.test(header)) {
      const x = /right/.test(header) ? 1 : /left/.test(header) ? -1 : 0
      const y = /bottom/.test(header) ? 1 : /top/.test(header) ? -1 : 0
      angle = (Math.atan2(x * height, -y * width) * 180) / Math.PI
    }
  }
  const radians = (angle * Math.PI) / 180
  const length =
    kind === "linear"
      ? Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))
      : Math.hypot(width, height) / 2
  const stops = []
  for (const arg of args) {
    const positions = [...arg.matchAll(/\s([-+.\d]+)(%|px)(?=\s|$)/g)]
    const colorText = positions.length ? arg.slice(0, positions[0].index).trim() : arg
    const c = color(colorText)
    if (!c) return null
    if (positions.length)
      for (const p of positions)
        stops.push({ color: c, position: Number(p[1]) / (p[2] === "%" ? 100 : length) })
    else stops.push({ color: c, position: null })
  }
  if (stops.length < 2 || stops.length > 256) return null
  stops[0].position ??= 0
  stops.at(-1).position ??= 1
  for (let i = 1; i < stops.length; i++)
    if (stops[i].position !== null)
      stops[i].position = Math.max(
        stops[i].position,
        stops
          .slice(0, i)
          .filter(s => s.position !== null)
          .at(-1).position
      )
  for (let i = 0; i < stops.length; i++)
    if (stops[i].position === null) {
      let end = i
      while (stops[end].position === null) end++
      const start = stops[i - 1].position
      for (let j = i; j < end; j++)
        stops[j].position = start + ((stops[end].position - start) * (j - i + 1)) / (end - i + 1)
      i = end
    }
  try {
    normalizedStops(stops)
  } catch {
    return null
  }
  return { kind, angle, stops }
}

// A bounded categorical circle can be expressed as a handful of editable
// sectors. Continuous interpolation, transparent colors and partial turns
// deliberately remain on the paint-fallback path.
export function parseHardStopConic(css, color) {
  const match = /^conic-gradient\((.*)\)$/s.exec(css)
  if (!match) return null
  const args = splitCss(match[1])
  const anglePattern = "([-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))(deg|turn|rad|grad|%)"
  const degrees = (value, unit) =>
    Number(value) * { deg: 1, turn: 360, rad: 180 / Math.PI, grad: 0.9, "%": 3.6 }[unit]
  let angle = 0
  if (/^(?:from |at )/.test(args[0])) {
    const header = new RegExp(
      `^(?:from ${anglePattern}(?: at (?:center(?: center)?|50% 50%))?|at (?:center(?: center)?|50% 50%))$`
    ).exec(args.shift())
    if (!header) return null
    if (header[1]) angle = degrees(header[1], header[2])
  }
  if (args.length < 2 || args.length > 24 || !Number.isFinite(angle)) return null
  const stops = []
  for (const arg of args) {
    const stop = new RegExp(`^(.*?)\\s+${anglePattern}(?:\\s+${anglePattern})?$`).exec(arg)
    if (!stop) return null
    const fill = color(stop[1])
    if (!fill || fill.alpha !== 1) return null
    stops.push({ color: fill, position: degrees(stop[2], stop[3]) })
    if (stop[4]) stops.push({ color: fill, position: degrees(stop[4], stop[5]) })
  }
  // Chromium expands double-position stops into pairs of single stops.
  if (stops.length < 4 || stops.length > 24 || stops.length % 2) return null
  const sectors = []
  let end = 0
  for (let i = 0; i < stops.length; i += 2) {
    const fill = stops[i].color,
      start = stops[i].position,
      next = stops[i + 1].position
    if (
      fill.hex !== stops[i + 1].color.hex ||
      !Number.isFinite(start) ||
      !Number.isFinite(next) ||
      Math.abs(start - end) > 1e-7 ||
      next <= start ||
      next > 360 + 1e-7
    )
      return null
    sectors.push({ color: fill, start: angle + start, end: angle + next })
    end = next
  }
  return Math.abs(end - 360) < 1e-7 ? sectors : null
}

export async function extractScene(root, { slideId, adapters = [], signal } = {}) {
  const rootBox = root.getBoundingClientRect()
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d", { willReadFrequently: true })
  canvas.width = canvas.height = 1
  const nodes = [],
    issues = [],
    elements = new Map(),
    textOwners = new Map()
  let serial = 0,
    visited = 0
  const styleCache = new WeakMap()
  const style = e => {
    if (!styleCache.has(e)) styleCache.set(e, getComputedStyle(e))
    return styleCache.get(e)
  }
  function color(value) {
    if (!value || value === "none" || !CSS.supports("color", value)) return null
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return {
      hex: [r, g, b]
        .map(c => c.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase(),
      alpha: a / 255
    }
  }
  function box(e) {
    const r = e.getBoundingClientRect()
    return { x: r.x - rootBox.x, y: r.y - rootBox.y, width: r.width, height: r.height }
  }
  function source(e, suffix = "") {
    if (!e.hasAttribute("data-ps-pptx-object")) {
      const id = e.getAttribute("data-pptx-id") || `object-${++serial}`
      if (elements.has(id)) throw new Error(`Duplicate PowerPoint object ID: ${id}`)
      e.setAttribute("data-ps-pptx-object", id)
      elements.set(id, e)
    }
    const elementId = e.getAttribute("data-ps-pptx-object")
    if (elements.has(elementId) && elements.get(elementId) !== e)
      throw new Error(`Duplicate PowerPoint object ID: ${elementId}`)
    elements.set(elementId, e)
    const objectId = elementId + suffix
    return {
      slideId,
      objectId,
      elementId,
      domPath:
        e.tagName.toLowerCase() + `[data-ps-pptx-object="${e.getAttribute("data-ps-pptx-object")}"]`
    }
  }
  function emit(e, kind, payload, geometry, suffix = "", opacity = 1) {
    const ref = source(e, suffix)
    let build = null
    for (let ancestor = e; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement)
      if (
        ancestor.hasAttribute("data-ps-build-step") &&
        (!build ||
          Number(ancestor.getAttribute("data-ps-build-step")) >
            Number(build.getAttribute("data-ps-build-step")))
      )
        build = ancestor
    const node = {
      id: ref.objectId,
      source: ref,
      kind,
      box: geometry || box(e),
      payload,
      opacity,
      paintOrder: nodes.length,
      name:
        e.getAttribute("data-pptx-name") ||
        e.getAttribute("aria-label") ||
        `${e.tagName.toLowerCase()} ${ref.objectId}`,
      altText: e.getAttribute("alt") || e.getAttribute("aria-label") || "",
      buildStep: Number(build?.getAttribute("data-ps-build-step") || 0),
      animation: build?.getAttribute("data-ps-build-animation") || "fade"
    }
    const link = e.closest("a[href]")
    if (link) node.hyperlink = link.getAttribute("href")
    nodes.push(node)
    return node
  }
  function issue(e, code, message, severity = "warning", suffix = "") {
    issues.push({ code, message, severity, source: source(e, suffix) })
  }
  function textCount(e) {
    return (e.innerText || e.textContent || "").length
  }
  function fallback(e, code, message, scope = "subtree", opacity = 1) {
    issue(e, code, message)
    return emit(
      e,
      "fallback",
      {
        elementId: source(e).objectId,
        scope,
        textCharacters: scope === "subtree" ? textCount(e) : 0,
        reason: code,
        cssPaint: scope === "paint" ? paintStyle(e) : undefined
      },
      undefined,
      scope === "paint" ? ":paint" : "",
      opacity
    )
  }
  function paintStyle(e) {
    const s = style(e),
      result = {}
    for (const p of [
      "background",
      "background-image",
      "background-color",
      "background-size",
      "background-position",
      "background-repeat",
      "background-origin",
      "background-clip",
      "border-top",
      "border-right",
      "border-bottom",
      "border-left",
      "border-radius",
      "box-shadow",
      "filter",
      "opacity"
    ])
      result[p] = s.getPropertyValue(p)
    result.width = s.width
    result.height = s.height
    result["box-sizing"] = s.boxSizing
    result.opacity = "1"
    return result
  }
  function intersects(a, b) {
    return (
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    )
  }
  function nativeTextGradient(e, width, height) {
    const s = style(e)
    if (
      !/text/.test(s.backgroundClip) ||
      s.backgroundColor !== "rgba(0, 0, 0, 0)" ||
      s.boxShadow !== "none" ||
      [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].some(
        v => parseFloat(v) > 0
      )
    )
      return null
    const b = box(e),
      gradient = parseGradient(s.backgroundImage, width || b.width, height || b.height, color)
    return gradient?.kind === "linear" && gradient.stops.every(stop => stop.color.alpha === 1)
      ? gradient
      : null
  }
  function stackingContext(e) {
    const s = style(e)
    return (
      s.transform !== "none" ||
      s.translate !== "none" ||
      s.rotate !== "none" ||
      s.scale !== "none" ||
      Number(s.opacity) < 1 ||
      s.isolation === "isolate" ||
      s.filter !== "none" ||
      s.backdropFilter !== "none" ||
      s.perspective !== "none" ||
      s.mixBlendMode !== "normal" ||
      s.clipPath !== "none" ||
      s.maskImage !== "none" ||
      /(?:paint|layout|strict|content)/.test(s.contain) ||
      /transform|opacity|filter/.test(s.willChange) ||
      ["fixed", "sticky"].includes(s.position) ||
      (s.zIndex !== "auto" &&
        (s.position !== "static" || /flex|grid/.test(style(e.parentElement).display)))
    )
  }
  function escapedStackRoots(e) {
    if (stackingContext(e)) return []
    const roots = []
    function scanStacking(parent) {
      for (const child of parent.children) {
        const s = style(child)
        if (s.display === "none" || s.visibility !== "visible") continue
        if (s.zIndex !== "auto") roots.push({ box: box(child), z: Number(s.zIndex) || 0 })
        else if (!stackingContext(child)) scanStacking(child)
      }
    }
    scanStacking(e)
    return roots
  }
  function transformNodes(start, before, after, scale) {
    const x = v => before.x + (v - after.x) * scale,
      y = v => before.y + (v - after.y) * scale
    const fonts = new Set()
    const mapBox = b => {
      b.x = x(b.x)
      b.y = y(b.y)
      b.width *= scale
      b.height *= scale
    }
    for (const n of nodes.slice(start)) {
      mapBox(n.box)
      const p = n.payload
      if (n.kind === "shape") {
        if (p.border) p.border.width *= scale
        if (p.radii) p.radii = p.radii.map(pair => pair.map(v => v * scale))
      } else if (n.kind === "paths") {
        for (const path of p.paths) {
          path.matrix = path.matrix.map(v => v * scale)
          path.strokeWidth *= scale
          if (path.dashValues) path.dashValues = path.dashValues.map(v => v * scale)
        }
      } else if (n.kind === "text") {
        for (const line of p.lines) {
          mapBox(line)
          if (Number.isFinite(line.baseline)) line.baseline = y(line.baseline)
          if (line.affine) {
            const m = line.affine.matrix
            line.affine.matrix = [
              m[0] * scale,
              m[1] * scale,
              m[2] * scale,
              m[3] * scale,
              x(m[4]),
              y(m[5])
            ]
          }
          for (const run of line.runs)
            if (!line.affine)
              if (!fonts.has(run.font)) {
                fonts.add(run.font)
                run.font.renderScale = (run.font.renderScale || 1) * scale
              }
        }
      } else if (n.kind === "fallback" && p.cssPaint) {
        for (const key of Object.keys(p.cssPaint))
          p.cssPaint[key] = p.cssPaint[key].replace(
            /(-?[\d.]+)px/g,
            (_, v) => `${Number(v) * scale}px`
          )
      }
    }
  }
  function transform(e) {
    const s = style(e),
      r = box(e)
    // A transformed ancestor requires a paint-safe fallback; local rotation/scale is supported.
    const m = new DOMMatrix(s.transform === "none" ? undefined : s.transform)
    if (s.rotate !== "none") {
      const value = parseFloat(s.rotate) || 0
      m.rotateSelf(
        s.rotate.endsWith("turn")
          ? value * 360
          : s.rotate.endsWith("rad")
            ? (value * 180) / Math.PI
            : s.rotate.endsWith("grad")
              ? value * 0.9
              : value
      )
    }
    if (s.scale !== "none") {
      const [x, y] = s.scale.split(/\s+/).map(Number)
      m.scaleSelf(x, y ?? x)
    }
    const flipH = m.a * m.d - m.b * m.c < 0
    const rotate = (Math.atan2(flipH ? -m.b : m.b, flipH ? -m.a : m.a) * 180) / Math.PI
    const sx = Math.hypot(m.a, m.b),
      sy = Math.hypot(m.c, m.d)
    const width = parseFloat(s.width),
      height = parseFloat(s.height)
    const horizontal =
      s.boxSizing === "border-box"
        ? width
        : width +
          parseFloat(s.paddingLeft) +
          parseFloat(s.paddingRight) +
          parseFloat(s.borderLeftWidth) +
          parseFloat(s.borderRightWidth)
    const vertical =
      s.boxSizing === "border-box"
        ? height
        : height +
          parseFloat(s.paddingTop) +
          parseFloat(s.paddingBottom) +
          parseFloat(s.borderTopWidth) +
          parseFloat(s.borderBottomWidth)
    return {
      box:
        Math.abs(rotate) < 0.0001 && Math.abs(sx - 1) < 0.0001 && Math.abs(sy - 1) < 0.0001
          ? r
          : {
              x: r.x + r.width / 2 - (horizontal * sx) / 2,
              y: r.y + r.height / 2 - (vertical * sy) / 2,
              width: horizontal * sx,
              height: vertical * sy
            },
      rotate,
      flipH,
      unsupported: !m.is2D || Math.abs(m.a * m.c + m.b * m.d) > 0.001 || s.perspective !== "none",
      sx,
      sy
    }
  }
  function radius(value, width, height) {
    const parts = value.split(" ")
    const size = (v, length) => (v.endsWith("%") ? (parseFloat(v) / 100) * length : parseFloat(v))
    return [size(parts[0], width), size(parts[1] || parts[0], height)]
  }
  function clipRegion(e) {
    const s = style(e)
    if (![s.overflowX, s.overflowY].every(v => ["hidden", "clip", "auto", "scroll"].includes(v)))
      return null
    if (
      [s.overflowX, s.overflowY].includes("scroll") ||
      ([s.overflowX, s.overflowY].includes("auto") &&
        (e.scrollWidth > e.clientWidth || e.scrollHeight > e.clientHeight)) ||
      parseFloat(s.overflowClipMargin) > 0
    )
      return null
    for (let ancestor = e; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
      const t = transform(ancestor)
      if (t.unsupported || t.flipH || Math.abs(t.rotate) > 0.0001 || Math.abs(t.sx - t.sy) > 0.0001)
        return null
    }
    const b = box(e),
      cssWidth =
        parseFloat(s.width) +
        (s.boxSizing === "border-box"
          ? 0
          : ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"].reduce(
              (sum, k) => sum + parseFloat(s[k]),
              0
            ))
    if (!(cssWidth > 0)) return null
    const scale = b.width / cssWidth
    const [top, right, bottom, left] = ["Top", "Right", "Bottom", "Left"].map(
      side => parseFloat(s[`border${side}Width`]) * scale
    )
    const radii = [
      s.borderTopLeftRadius,
      s.borderTopRightRadius,
      s.borderBottomRightRadius,
      s.borderBottomLeftRadius
    ].map(v => radius(v, b.width, b.height).map(n => n * (v.includes("%") ? 1 : scale)))
    if (!Number.isFinite(scale) || radii.some(pair => pair.some(v => !Number.isFinite(v))))
      return null
    const factor = Math.min(
      1,
      b.width / (radii[0][0] + radii[1][0] || 1),
      b.width / (radii[3][0] + radii[2][0] || 1),
      b.height / (radii[0][1] + radii[3][1] || 1),
      b.height / (radii[1][1] + radii[2][1] || 1)
    )
    const result = {
      x: b.x + left,
      y: b.y + top,
      width: Math.max(0, b.width - left - right),
      height: Math.max(0, b.height - top - bottom),
      radii: radii.map(([x, y], i) => [
        Math.max(0, x * factor - (i === 0 || i === 3 ? left : right)),
        Math.max(0, y * factor - (i < 2 ? top : bottom))
      ])
    }
    // The slide surface already provides this clip in every PPTX renderer.
    if (
      Math.abs(result.x) < 0.001 &&
      Math.abs(result.y) < 0.001 &&
      Math.abs(result.width - rootBox.width) < 0.001 &&
      Math.abs(result.height - rootBox.height) < 0.001 &&
      result.radii.every(pair => pair.every(v => !v))
    )
      return null
    return result
  }
  function singlePaintSubtree(e) {
    let paints = 0
    for (const child of [e, ...e.querySelectorAll("*")]) {
      const s = style(child)
      if (s.visibility !== "visible" || s.display === "none" || Number(s.opacity) === 0) continue
      if (
        s.filter !== "none" ||
        s.boxShadow !== "none" ||
        s.maskImage !== "none" ||
        s.backgroundImage !== "none" ||
        child instanceof SVGElement ||
        textOwners.has(child)
      )
        return false
      if (
        color(s.backgroundColor)?.alpha > 0 ||
        ["Top", "Right", "Bottom", "Left"].some(
          side =>
            parseFloat(s[`border${side}Width`]) > 0 && color(s[`border${side}Color`])?.alpha > 0
        )
      )
        paints++
      if (paints > 1) return false
    }
    return paints === 1
  }
  function overlappingPaint(e) {
    const bounds = []
    function scanPaint(target) {
      const s = style(target)
      if (s.display === "none" || s.visibility !== "visible" || Number(s.opacity) === 0)
        return false
      const atomic =
        target instanceof SVGElement ||
        ["CANVAS", "IMG", "VIDEO", "IFRAME", "TABLE"].includes(target.tagName)
      const ownPaint =
        color(s.backgroundColor)?.alpha > 0 ||
        s.backgroundImage !== "none" ||
        ["Top", "Right", "Bottom", "Left"].some(side => parseFloat(s[`border${side}Width`]) > 0)
      if (ownPaint && textOwners.has(target)) return true
      const painted = atomic || textOwners.has(target) || ownPaint
      if (painted) {
        const b = box(target)
        if (bounds.some(other => intersects(b, other))) return true
        bounds.push(b)
        if (bounds.length > 1024) return true
      }
      if (atomic) return false
      return [...target.children].some(scanPaint)
    }
    return scanPaint(e)
  }
  function background(e, opacity) {
    if (nativeTextGradient(e)) return
    const s = style(e),
      t = transform(e),
      b = t.box
    const widths = [
      s.borderTopWidth,
      s.borderRightWidth,
      s.borderBottomWidth,
      s.borderLeftWidth
    ].map((v, i) => parseFloat(v) * (i % 2 ? t.sx : t.sy))
    const colors = [
      s.borderTopColor,
      s.borderRightColor,
      s.borderBottomColor,
      s.borderLeftColor
    ].map(color)
    const radii = [
      s.borderTopLeftRadius,
      s.borderTopRightRadius,
      s.borderBottomRightRadius,
      s.borderBottomLeftRadius
    ].map(v =>
      radius(v, b.width / t.sx, b.height / t.sy).map(
        (value, index) => value * (index ? t.sy : t.sx)
      )
    )
    // CSS scales all corner radii by the same factor when opposing sums overlap.
    const factor = Math.min(
      1,
      b.width / (radii[0][0] + radii[1][0] || 1),
      b.width / (radii[3][0] + radii[2][0] || 1),
      b.height / (radii[0][1] + radii[3][1] || 1),
      b.height / (radii[1][1] + radii[2][1] || 1)
    )
    for (const pair of radii) {
      pair[0] *= factor
      pair[1] *= factor
    }
    const bg = color(s.backgroundColor),
      hasBorder = widths.some(v => v > 0)
    const gradient =
      s.backgroundImage !== "none"
        ? parseGradient(s.backgroundImage, b.width / t.sx, b.height / t.sy, color)
        : null
    const conic =
      opacity === 1 &&
      !hasBorder &&
      !t.rotate &&
      !t.flipH &&
      Math.abs(t.sx - 1) < 0.0001 &&
      Math.abs(t.sy - 1) < 0.0001 &&
      Math.abs(b.width - b.height) < 0.001 &&
      b.width > 0 &&
      radii.every(
        ([x, y]) => Math.abs(x - b.width / 2) < 0.001 && Math.abs(y - b.height / 2) < 0.001
      ) &&
      /^(?:auto|auto auto)$/.test(s.backgroundSize) &&
      /^(?:padding-box|border-box)$/.test(s.backgroundOrigin) &&
      /^(?:padding-box|border-box)$/.test(s.backgroundClip) &&
      s.backgroundPosition === "0% 0%"
        ? parseHardStopConic(s.backgroundImage, color)
        : null
    const borderUniform =
      widths.every(w => w === widths[0]) &&
      colors.every(c => JSON.stringify(c) === JSON.stringify(colors[0]))
    const borderStyles = [
      s.borderTopStyle,
      s.borderRightStyle,
      s.borderBottomStyle,
      s.borderLeftStyle
    ]
    const shadows =
      s.boxShadow === "none"
        ? []
        : splitCss(s.boxShadow)
            .map(value => {
              const match =
                /^(.*?\))\s+([-+.\d]+)px\s+([-+.\d]+)px\s+([-+.\d]+)px\s+([-+.\d]+)px(?:\s+(inset))?$/.exec(
                  value
                )
              return match
                ? {
                    color: color(match[1]),
                    x: Number(match[2]),
                    y: Number(match[3]),
                    blur: Number(match[4]),
                    spread: Number(match[5]),
                    inset: !!match[6]
                  }
                : null
            })
            .filter(shadow => !shadow || shadow.color?.alpha > 0)
    const rings = shadows.every(
      shadow =>
        shadow &&
        shadow.x === 0 &&
        shadow.y === 0 &&
        shadow.blur === 0 &&
        shadow.spread >= 0 &&
        !shadow.inset
    )
    const unequalRoundedBorder = !borderUniform && radii.some(r => r.some(v => v > 0))
    const unsupported =
      (Math.abs(t.sx - t.sy) > 0.0001 &&
        (hasBorder ||
          gradient?.kind === "radial" ||
          (gradient?.kind === "linear" && Math.abs(gradient.angle % 90) > 0.0001))) ||
      (Math.abs(t.rotate) > 0.0001 && hasBorder && !borderUniform) ||
      (s.backgroundImage !== "none" && !gradient && !conic) ||
      !rings ||
      (opacity < 1 && bg?.alpha > 0 && gradient?.stops.some(stop => stop.color.alpha < 1)) ||
      s.filter !== "none" ||
      /text/.test(s.backgroundClip) ||
      (hasBorder &&
        (unequalRoundedBorder || borderStyles.some(v => !["solid", "none"].includes(v))))
    const elliptical = ellipticalPaint(e)
    if (
      elliptical &&
      !t.rotate &&
      !t.flipH &&
      !t.unsupported &&
      Math.abs(t.sx - 1) < 0.0001 &&
      Math.abs(t.sy - 1) < 0.0001
    ) {
      const node = emit(
        e,
        "shape",
        { fill: elliptical, clip: ellipticalClip(e), approximation: true },
        b,
        ":paint",
        opacity
      )
      node.name = "Elliptical gradient (editable native strips)"
      issue(
        e,
        "ELLIPTICAL_GRADIENT_APPROXIMATED",
        "Elliptical alpha gradient uses bounded native linear-gradient strips. Qualified with Aspose; LibreOffice may show seams between strips.",
        "warning",
        ":paint"
      )
      return node
    }
    if (unsupported)
      return fallback(
        e,
        s.backgroundImage.includes("gradient") ? "UNSUPPORTED_GRADIENT" : "UNSUPPORTED_PAINT",
        "Background/border paint retained as a localized graphic.",
        t.rotate || Math.abs(t.sx - 1) > 0.0001 || Math.abs(t.sy - 1) > 0.0001
          ? "subtree"
          : "paint",
        t.rotate || Math.abs(t.sx - 1) > 0.0001 || Math.abs(t.sy - 1) > 0.0001 ? 1 : opacity
      )
    for (const [index, shadow] of shadows.entries())
      if (shadow.spread > 0)
        emit(
          e,
          "shape",
          {
            fill: null,
            border: { width: shadow.spread, color: shadow.color },
            radii: radii.map(([x, y]) => [x + shadow.spread, y + shadow.spread]),
            rotate: t.rotate
          },
          {
            x: b.x - shadow.spread,
            y: b.y - shadow.spread,
            width: b.width + 2 * shadow.spread,
            height: b.height + 2 * shadow.spread
          },
          `:ring:${index}`,
          opacity
        )
    if (conic) {
      const r = b.width / 2
      const point = angle => {
        const a = (angle * Math.PI) / 180
        return `${r + r * Math.sin(a)} ${r - r * Math.cos(a)}`
      }
      const path = (d, fill) => ({
        d,
        fill,
        matrix: [1, 0, 0, 1, 0, 0],
        fillOpacity: 1,
        stroke: null,
        strokeOpacity: 1,
        strokeWidth: 0
      })
      return emit(
        e,
        "paths",
        {
          paths: [
            path(
              `M${r} 0A${r} ${r} 0 1 1 ${r} ${b.height}A${r} ${r} 0 1 1 ${r} 0Z`,
              conic[0].color
            ),
            ...conic
              .slice(1)
              .map(sector =>
                path(
                  `M${r} ${r}L${point(sector.start)}A${r} ${r} 0 ${sector.end - sector.start > 180 ? 1 : 0} 1 ${point(sector.end)}Z`,
                  sector.color
                )
              )
          ]
        },
        b,
        ":paint",
        opacity
      )
    }
    if (gradient || bg?.alpha > 0 || (hasBorder && borderUniform)) {
      if (gradient && bg?.alpha > 0 && gradient.stops.some(stop => stop.color.alpha < 1))
        emit(
          e,
          "shape",
          { fill: bg, border: null, radii, rotate: t.rotate },
          b,
          ":base-paint",
          opacity
        )
      const node = emit(
        e,
        "shape",
        {
          fill: gradient || bg,
          border: hasBorder && borderUniform ? { width: widths[0], color: colors[0] } : null,
          radii,
          rotate: t.rotate,
          flipH: t.flipH
        },
        b,
        ":paint",
        opacity
      )
      if (gradient?.stops.some(stop => stop.color.alpha < 1))
        issue(
          e,
          "GRADIENT_INTERPOLATION_APPROXIMATED",
          "Transparent gradient uses sampled premultiplied-color native stops.",
          "warning",
          ":paint"
        )
      if (borderUniform) return node
    }
    if (hasBorder && !borderUniform) {
      const boxes = [
        { x: b.x, y: b.y, width: b.width, height: widths[0] },
        { x: b.x + b.width - widths[1], y: b.y, width: widths[1], height: b.height },
        { x: b.x, y: b.y + b.height - widths[2], width: b.width, height: widths[2] },
        { x: b.x, y: b.y, width: widths[3], height: b.height }
      ]
      if (
        widths.filter(w => w > 0).length > 1 &&
        colors.some(c => JSON.stringify(c) !== JSON.stringify(colors[0]))
      )
        return fallback(
          e,
          "BORDER_JOIN_FALLBACK",
          "Multi-color border joins retained as a graphic.",
          "paint",
          opacity
        )
      for (let index = 0; index < 4; index++)
        if (widths[index] > 0)
          emit(
            e,
            "shape",
            {
              fill: colors[index],
              border: null,
              radii: [
                [0, 0],
                [0, 0],
                [0, 0],
                [0, 0]
              ],
              rotate: t.rotate
            },
            boxes[index],
            `:border:${index}`,
            opacity
          )
    }
  }
  function ellipticalPaint(e) {
    const s = style(e),
      b = box(e)
    if (
      e.children.length ||
      textOwners.has(e) ||
      color(s.backgroundColor)?.alpha > 0 ||
      s.filter !== "none" ||
      s.maskImage !== "none" ||
      s.clipPath !== "none" ||
      s.mixBlendMode !== "normal" ||
      s.boxShadow !== "none" ||
      [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].some(
        v => parseFloat(v) > 0
      ) ||
      !/^(?:auto|auto auto)$/.test(s.backgroundSize) ||
      s.backgroundPosition !== "0% 0%" ||
      !["border-box", "padding-box"].includes(s.backgroundClip)
    )
      return null
    return parseEllipticalGradient(s.backgroundImage, b.width, b.height, color, splitCss)
  }
  function ellipticalClip(e) {
    const clip = { x: 0, y: 0, width: 1280, height: 720 }
    for (let a = e.parentElement; a && root.contains(a); a = a.parentElement) {
      const s = style(a),
        b = box(a)
      if ([s.overflowX, s.overflowY].some(v => ["hidden", "clip", "scroll", "auto"].includes(v))) {
        const right = Math.min(clip.x + clip.width, b.x + b.width),
          bottom = Math.min(clip.y + clip.height, b.y + b.height)
        clip.x = Math.max(clip.x, b.x)
        clip.y = Math.max(clip.y, b.y)
        clip.width = Math.max(0, right - clip.x)
        clip.height = Math.max(0, bottom - clip.y)
      }
    }
    return clip
  }
  function ellipticalClipContainer(e, children) {
    if (children.length !== 1) return false
    const fill = ellipticalPaint(children[0])
    if (!fill) return false
    const s = style(e),
      b = box(e),
      g = box(children[0])
    if (
      color(s.backgroundColor)?.alpha > 0 ||
      s.backgroundImage !== "none" ||
      s.boxShadow !== "none" ||
      [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].some(
        v => parseFloat(v) > 0
      )
    )
      return false
    const radii = [
      s.borderTopLeftRadius,
      s.borderTopRightRadius,
      s.borderBottomRightRadius,
      s.borderBottomLeftRadius
    ].map(v => radius(v, b.width, b.height))
    const extent = fill.stops.at(-1).position * fill.extent,
      paint = {
        x: g.x + (g.width * (1 - extent)) / 2,
        y: g.y + (g.height * (1 - extent)) / 2,
        width: g.width * extent,
        height: g.height * extent
      }
    const corners = [
      { x: b.x, y: b.y, width: radii[0][0], height: radii[0][1] },
      { x: b.x + b.width - radii[1][0], y: b.y, width: radii[1][0], height: radii[1][1] },
      {
        x: b.x + b.width - radii[2][0],
        y: b.y + b.height - radii[2][1],
        width: radii[2][0],
        height: radii[2][1]
      },
      { x: b.x, y: b.y + b.height - radii[3][1], width: radii[3][0], height: radii[3][1] }
    ]
    return !corners.some(
      c =>
        c.width > 0 &&
        c.height > 0 &&
        intersects(c, { x: 0, y: 0, width: 1280, height: 720 }) &&
        intersects(c, paint)
    )
  }
  function svg(e, opacity) {
    return extractSvg(e, { style, color, emit, fallback, issue, rootBox, opacity })
  }
  function text(e, textNodes, opacity) {
    const lines = [],
      fontRequests = []
    for (const tn of textNodes) {
      const parent = tn.parentElement,
        s = style(parent)
      if (s.visibility !== "visible" || s.display === "none") continue
      let inlineOpacity = 1
      for (let ancestor = parent; ancestor && ancestor !== e; ancestor = ancestor.parentElement)
        inlineOpacity *= Number(style(ancestor).opacity)
      if (!inlineOpacity) continue
      const font = {
        family: s.fontFamily,
        size: parseFloat(s.fontSize),
        weight: Number(s.fontWeight) || 400,
        style: s.fontStyle,
        variation: s.fontVariationSettings,
        features: s.fontFeatureSettings,
        letterSpacing: parseFloat(s.letterSpacing) || 0,
        color: color(s.color),
        opacity: inlineOpacity,
        decoration: s.textDecorationLine,
        language: parent.closest("[lang]")?.lang || document.documentElement.lang || "en",
        direction: s.direction
      }
      let gradientOwner = parent
      while (
        gradientOwner &&
        gradientOwner !== e &&
        !/text/.test(style(gradientOwner).backgroundClip)
      )
        gradientOwner = gradientOwner.parentElement
      if (!fontRequests.some(f => JSON.stringify(f) === JSON.stringify(font)))
        fontRequests.push(font)
      ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
      const metrics = ctx.measureText("Hg")
      for (let i = 0; i < tn.length; i++) {
        const range = document.createRange()
        range.setStart(tn, i)
        range.setEnd(tn, i + 1)
        const r = range.getBoundingClientRect()
        if (r.width < 0.01 || !r.height) continue
        const gradientRect =
          gradientOwner &&
          [...gradientOwner.getClientRects()].find(
            rect =>
              r.x + r.width / 2 >= rect.left - 0.1 &&
              r.x + r.width / 2 <= rect.right + 0.1 &&
              r.y + r.height / 2 >= rect.top - 0.1 &&
              r.y + r.height / 2 <= rect.bottom + 0.1
          )
        const fill =
          gradientRect && nativeTextGradient(gradientOwner, gradientRect.width, gradientRect.height)
        const runFont = fill ? { ...font, fill } : font
        let char = tn.textContent[i]
        if (s.textTransform === "uppercase") char = char.toUpperCase()
        else if (s.textTransform === "lowercase") char = char.toLowerCase()
        else if (
          s.textTransform === "capitalize" &&
          (i === 0 || !/[\p{L}\p{N}]/u.test(tn.textContent[i - 1]))
        )
          char = char.toUpperCase()
        const baseline = r.y - rootBox.y + (metrics.fontBoundingBoxAscent || r.height * 0.8)
        let line = lines.findLast(
          l => Math.abs(l.baseline - baseline) < Math.max(2, font.size * 0.15)
        )
        if (line && r.left - rootBox.x > line.x + line.width + 0.75) line = null
        if (!line) {
          line = {
            x: r.x - rootBox.x,
            y: r.y - rootBox.y,
            width: 0,
            height: r.height,
            baseline,
            runs: []
          }
          lines.push(line)
        }
        line.width = Math.max(line.width, r.right - rootBox.x - line.x)
        const last = line.runs.at(-1)
        const fontKey = JSON.stringify(runFont)
        const href = parent.closest("a[href]")?.getAttribute("href")
        if (last?.fontKey === fontKey && last.hyperlink === href) {
          last.text += char
          last.width = r.right - rootBox.x - last.x
        } else
          line.runs.push({
            text: char,
            fontKey,
            font: runFont,
            hyperlink: href,
            x: r.x - rootBox.x,
            width: r.width
          })
      }
    }
    lines.sort((a, b) => a.y - b.y)
    if (!lines.length) return
    // Keep inline formatting in one native line. Separate text boxes at each
    // color boundary expose renderer/font metric differences as artificial gaps.
    const node = emit(
      e,
      "text",
      {
        lines,
        fontRequests,
        textCharacters: lines.reduce(
          (sum, l) => sum + l.runs.reduce((s, r) => s + r.text.length, 0),
          0
        ),
        bullet:
          e.tagName === "LI" && style(e).listStyleType !== "none"
            ? {
                type: style(e).listStyleType,
                position: style(e).listStylePosition,
                start:
                  Number(e.parentElement?.getAttribute("start") || 1) +
                  [...(e.parentElement?.children || [])].filter(c => c.tagName === "LI").indexOf(e)
              }
            : null,
        text: lines.map(l => l.runs.map(r => r.text).join("")).join("\n")
      },
      undefined,
      ":text",
      opacity
    )
    if (lines.length > 1)
      issue(
        e,
        "TEXT_FRAGMENTED",
        "Measured lines remain editable; each line is independently positioned.",
        "info",
        ":text"
      )
    if (fontRequests.some(f => f.direction === "rtl" || f.features !== "normal"))
      issue(
        e,
        "TEXT_SHAPING_REQUIRES_VERIFICATION",
        "Complex shaping/features require target PowerPoint verification.",
        "warning",
        ":text"
      )
    return node
  }
  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let tn
  while ((tn = textWalker.nextNode())) {
    const parent = tn.parentElement
    if (
      !parent ||
      ["STYLE", "SCRIPT", "SVG", "TITLE"].includes(parent.tagName) ||
      parent.closest("svg") ||
      !tn.textContent.trim()
    )
      continue
    const owner = parent.closest("p,li,h1,h2,h3,h4,h5,h6,td,th") || parent
    if (!root.contains(owner)) continue
    if (!textOwners.has(owner)) textOwners.set(owner, [])
    textOwners.get(owner).push(tn)
  }
  async function visit(e, opacity = 1) {
    if (signal?.aborted) throw new Error("Export cancelled")
    if (++visited > 100000) throw new Error("LIMIT_EXCEEDED: too many DOM nodes")
    if (!(e instanceof Element) || ["STYLE", "SCRIPT", "LINK", "META"].includes(e.tagName)) return
    const s = style(e),
      b = box(e)
    if (
      s.display === "none" ||
      s.visibility === "hidden" ||
      Number(s.opacity) === 0 ||
      (!b.width && !b.height && !e.children.length && s.display !== "contents")
    )
      return
    if (b.x + b.width < 0 || b.y + b.height < 0 || b.x > 1280 || b.y > 720) return
    source(e)
    const alpha = opacity * Number(s.opacity)
    for (const adapter of adapters)
      if (adapter.match(e)) {
        await adapter.ready?.(e, signal)
        const result = await adapter.toScene(e, { box: b, slideId, signal })
        if (!Array.isArray(result) || !result.length)
          throw new Error(`Adapter ${adapter.id} produced no objects`)
        if (alpha < 1 && result.some(n => ["chart", "table"].includes(n.kind))) {
          fallback(
            e,
            "GROUP_COMPOSITING_FALLBACK",
            "Translucent chart/table retained as a localized graphic.",
            "subtree",
            1
          )
          return
        }
        for (const n of result) {
          if (
            typeof n.id !== "string" ||
            !n.id ||
            result.filter(other => other.id === n.id).length !== 1 ||
            !["shape", "text", "picture", "chart", "table"].includes(n.kind) ||
            !n.box ||
            Object.values(n.box).some(v => !Number.isFinite(v))
          )
            throw new Error(`Invalid output from adapter ${adapter.id}`)
          const converted = emit(e, n.kind, n.payload, n.box, `:adapter:${n.id}`, alpha)
          converted.name = n.name || converted.name
          converted.altText = n.altText || converted.altText
          converted.adapter = true
        }
        return
      }
    if (e.hasAttribute("data-pptx-chart")) {
      if (alpha < 1) {
        fallback(
          e,
          "GROUP_COMPOSITING_FALLBACK",
          "Translucent chart retained as a localized graphic.",
          "subtree",
          1
        )
        return
      }
      const data = JSON.parse(e.getAttribute("data-pptx-chart"))
      emit(
        e,
        "chart",
        { fontFamily: s.fontFamily, background: color(s.backgroundColor), ...data },
        b,
        "",
        alpha
      )
      return
    }
    if (e.tagName === "TABLE") {
      if (
        s.transform !== "none" ||
        s.rotate !== "none" ||
        s.scale !== "none" ||
        alpha !== 1 ||
        (s.borderCollapse !== "collapse" &&
          s.borderSpacing.split(/\s+/).some(v => parseFloat(v) > 0)) ||
        e.querySelector("img,svg,canvas,video,a,strong,em,span") ||
        [...e.querySelectorAll("td,th")].some(
          cell =>
            style(cell).backgroundImage !== "none" ||
            style(cell).writingMode !== "horizontal-tb" ||
            style(cell).visibility !== "visible" ||
            style(cell).display === "none" ||
            Number(style(cell).opacity) !== 1 ||
            (color(style(cell).color)?.alpha ?? 1) < 1 ||
            (color(style(cell).backgroundColor)?.alpha > 0 &&
              color(style(cell).backgroundColor)?.alpha < 1) ||
            [...cell.closest("tr").parentElement.children].some(
              row => style(row).display === "none" || style(row).visibility !== "visible"
            ) ||
            cell.rowSpan === 0
        )
      ) {
        fallback(
          e,
          "TABLE_COMPLEX_CONTENT_FALLBACK",
          "Styled/nested table content retained as a graphic; native table semantics are unavailable for this composite.",
          "subtree",
          1
        )
        return
      }
      const rows = [...e.rows].map(row =>
        [...row.cells].map(cell => ({
          elementId: source(cell).elementId,
          text: cell.innerText,
          colSpan: cell.colSpan,
          rowSpan: cell.rowSpan,
          box: box(cell),
          color: color(style(cell).color),
          fill: color(style(cell).backgroundColor),
          fontSize: parseFloat(style(cell).fontSize),
          family: style(cell).fontFamily,
          bold: Number(style(cell).fontWeight) >= 600,
          italic: style(cell).fontStyle === "italic",
          align: style(cell).textAlign,
          verticalAlign: style(cell).verticalAlign,
          padding: ["Top", "Right", "Bottom", "Left"].map(side =>
            parseFloat(style(cell)["padding" + side])
          ),
          borders: ["Top", "Right", "Bottom", "Left"].map(side => ({
            width: parseFloat(style(cell)["border" + side + "Width"]),
            color: color(style(cell)["border" + side + "Color"]),
            style: style(cell)["border" + side + "Style"]
          }))
        }))
      )
      emit(e, "table", { rows, textCharacters: e.innerText.length }, b, "", alpha)
      nodes.at(-1).payload.rowHeights = [...e.rows].map(row => box(row).height)
      return
    }
    const t = transform(e),
      children = [...e.children].filter(
        c => !["defs", "title", "desc"].includes(c.tagName.toLowerCase())
      )
    if (
      children.length &&
      Math.abs(t.sx - 1) > 0.0001 &&
      Math.abs(t.sx - t.sy) < 0.0001 &&
      t.sx > 0 &&
      Math.abs(t.rotate) < 0.0001 &&
      !t.flipH &&
      !t.unsupported &&
      (Number(s.opacity) === 1 || singlePaintSubtree(e)) &&
      !e.querySelector("table,img,[data-pptx-chart]") &&
      ![...e.querySelectorAll("*")].some(child => ellipticalPaint(child))
    ) {
      const original = e.getAttribute("style"),
        start = nodes.length
      for (const property of ["transform", "translate", "rotate", "scale"])
        e.style.setProperty(property, "none", "important")
      styleCache.delete(e)
      const unscaled = box(e)
      try {
        await visit(e, opacity)
      } finally {
        if (original === null) e.removeAttribute("style")
        else e.setAttribute("style", original)
        styleCache.delete(e)
      }
      transformNodes(start, b, unscaled, t.sx)
      return
    }
    // PowerPoint already clips every object at the slide boundary. A matching
    // rectangular viewport does not require flattening its editable children.
    const canvasClip =
      Math.abs(b.x) < 0.01 &&
      Math.abs(b.y) < 0.01 &&
      Math.abs(b.width - rootBox.width) < 0.01 &&
      Math.abs(b.height - rootBox.height) < 0.01 &&
      Math.abs(t.rotate) < 0.0001 &&
      Math.abs(t.sx - 1) < 0.0001 &&
      Math.abs(t.sy - 1) < 0.0001 &&
      !t.flipH &&
      [s.overflowX, s.overflowY].every(v => ["visible", "hidden", "clip"].includes(v)) &&
      [
        s.borderTopWidth,
        s.borderRightWidth,
        s.borderBottomWidth,
        s.borderLeftWidth,
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomRightRadius,
        s.borderBottomLeftRadius
      ].every(v => parseFloat(v) === 0)
    const clipsChildren =
      !canvasClip &&
      [s.overflowX, s.overflowY].some(v => ["hidden", "clip", "scroll", "auto"].includes(v)) &&
      children.some(c => {
        const r = box(c)
        return (
          r.x < b.x - 0.5 ||
          r.y < b.y - 0.5 ||
          r.x + r.width > b.x + b.width + 0.5 ||
          r.y + r.height > b.y + b.height + 0.5 ||
          (s.borderRadius !== "0px" && intersects(r, b) && style(c).transform !== "none")
        )
      })
    const clipsText =
      !canvasClip &&
      textOwners.has(e) &&
      [s.overflowX, s.overflowY].some(v => ["hidden", "clip", "scroll", "auto"].includes(v)) &&
      (e.scrollWidth > e.clientWidth + 0.5 || e.scrollHeight > e.clientHeight + 0.5)
    const overlappingChildren = children.some((c, i) =>
      children.slice(i + 1).some(other => intersects(box(c), box(other)))
    )
    const groupComposition = Number(s.opacity) < 1 && overlappingPaint(e)
    const compositeText =
      textOwners.has(e) &&
      [e, ...e.querySelectorAll("*")].some(child => {
        const cs = style(child)
        return (
          cs.textShadow !== "none" ||
          cs.textDecorationStyle !== "solid" ||
          cs.fontVariantCaps !== "normal" ||
          parseFloat(cs.webkitTextStrokeWidth) > 0 ||
          (/text/.test(cs.backgroundClip) && !nativeTextGradient(child)) ||
          cs.writingMode !== "horizontal-tb" ||
          Math.abs(parseFloat(cs.wordSpacing) || 0) > 0.001 ||
          (child !== e && (cs.transform !== "none" || cs.rotate !== "none" || cs.filter !== "none"))
        )
      })
    // Positioned grandchildren can participate in an ancestor's stacking context.
    // A simple recursive sibling sort cannot preserve that interleaving.
    const layers = children.map((child, index) => ({
      index,
      z: Number(style(child).zIndex) || 0,
      box: box(child),
      roots: escapedStackRoots(child)
    }))
    const interleavedStacking =
      layers.some(layer => layer.roots.some(layerRoot => layerRoot.z < 0)) ||
      (overlappingChildren &&
        layers.some(layer =>
          layer.roots.some(layerRoot =>
            layers.some(other => {
              if (layer === other) return false
              const nativeOrder = Math.sign(layer.z - other.z || layer.index - other.index)
              return [other, ...other.roots].some(
                target =>
                  intersects(layerRoot.box, target.box) &&
                  nativeOrder !== Math.sign(layerRoot.z - target.z || layer.index - other.index)
              )
            })
          )
        ))
    if (
      t.unsupported ||
      compositeText ||
      interleavedStacking ||
      s.filter !== "none" ||
      (/text/.test(s.backgroundClip) && !nativeTextGradient(e)) ||
      (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
      ((Math.abs(t.rotate) > 0.0001 ||
        Math.abs(t.sx - 1) > 0.0001 ||
        Math.abs(t.sy - 1) > 0.0001 ||
        t.flipH) &&
        (children.length || textOwners.has(e))) ||
      s.clipPath !== "none" ||
      s.maskImage !== "none" ||
      s.backdropFilter !== "none" ||
      s.mixBlendMode !== "normal" ||
      (clipsChildren && !clipRegion(e) && !ellipticalClipContainer(e, children)) ||
      clipsText ||
      groupComposition
    ) {
      fallback(
        e,
        groupComposition ? "GROUP_COMPOSITING_FALLBACK" : "COMPLEX_COMPOSITION_FALLBACK",
        `Composite retained as a localized image (${clipsChildren ? "overflow clipping" : t.unsupported || s.transform !== "none" || s.translate !== "none" || s.rotate !== "none" || s.scale !== "none" ? "transform" : Number(s.opacity) < 1 ? "group opacity" : "mask/filter/blending"}).`,
        "subtree",
        1
      )
      return
    }
    if (e.tagName.toLowerCase() === "svg") {
      svg(e, alpha)
      return
    }
    if (["CANVAS", "VIDEO", "IFRAME"].includes(e.tagName)) {
      fallback(
        e,
        "MEDIA_FALLBACK",
        "Canvas/video/embedded content exported as its current still image.",
        "subtree",
        1
      )
      return
    }
    if (e.tagName === "IMG") {
      if (!e.complete || !e.naturalWidth)
        throw new Error(`ASSET_UNAVAILABLE: ${e.getAttribute("src")}`)
      const corners = [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomRightRadius,
        s.borderBottomLeftRadius
      ]
      const insets = ["Top", "Right", "Bottom", "Left"].map(
        side => parseFloat(s["border" + side + "Width"]) + parseFloat(s["padding" + side])
      )
      if (
        !corners.every(c => c === corners[0]) ||
        !insets.every(v => v === insets[0]) ||
        s.objectPosition.split(/\s+/).length > 2 ||
        /calc\(/.test(s.objectPosition)
      ) {
        fallback(
          e,
          "IMAGE_BOX_FALLBACK",
          "Asymmetric image clip/box retained as a graphic.",
          "subtree",
          1
        )
        return
      }
      const layoutWidth = t.box.width / t.sx - insets[0] * 2,
        layoutHeight = t.box.height / t.sy - insets[0] * 2
      if (
        corners.some(value => parseFloat(value) > 0) &&
        s.objectFit !== "fill" &&
        s.objectFit !== "cover" &&
        (s.objectFit === "none"
          ? Math.abs(e.naturalWidth - layoutWidth) > 0.01 ||
            Math.abs(e.naturalHeight - layoutHeight) > 0.01
          : Math.abs(e.naturalWidth / e.naturalHeight - layoutWidth / layoutHeight) > 0.0001)
      ) {
        fallback(
          e,
          "IMAGE_BOX_FALLBACK",
          "Partially filled rounded image viewport retained as a localized graphic.",
          "subtree",
          1
        )
        return
      }
      background(e, alpha)
      const inset = insets[0],
        content = {
          x: t.box.x + inset * t.sx,
          y: t.box.y + inset * t.sy,
          width: Math.max(0, t.box.width - 2 * inset * t.sx),
          height: Math.max(0, t.box.height - 2 * inset * t.sy)
        }
      const [rx, ry] = radius(corners[0], t.box.width / t.sx, t.box.height / t.sy),
        factor = Math.min(
          1,
          t.box.width / t.sx / (2 * rx || 1),
          t.box.height / t.sy / (2 * ry || 1)
        )
      emit(
        e,
        "picture",
        {
          url: e.currentSrc || e.src,
          naturalWidth: e.naturalWidth,
          naturalHeight: e.naturalHeight,
          fit: s.objectFit,
          position: s.objectPosition,
          radius: [
            Math.max(0, rx * factor * t.sx - inset * t.sx),
            Math.max(0, ry * factor * t.sy - inset * t.sy)
          ],
          rotate: t.rotate,
          flipH: t.flipH,
          renderScaleX: t.sx,
          renderScaleY: t.sy
        },
        content,
        "",
        alpha
      )
      return
    }
    const componentStart = nodes.length
    background(e, alpha)
    const sorted = children
      .map((child, index) => ({ child, index, z: Number(style(child).zIndex) || 0 }))
      .sort((a, c) => a.z - c.z || a.index - c.index)
    for (const { child } of sorted) await visit(child, alpha)
    if (textOwners.has(e)) text(e, textOwners.get(e), alpha)
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(e, pseudo)
      if (ps.content !== "none" && ps.content !== "normal" && ps.display !== "none") {
        // Pseudo paint is isolated rather than silently dropped. Capture the element scope once.
        const own = nodes.filter(n => n.source.domPath === source(e).domPath)
        for (const node of own) nodes.splice(nodes.indexOf(node), 1)
        // Descendant contributions must also be consumed for a complete pseudo composite.
        for (let i = nodes.length - 1; i >= 0; i--) {
          const target = elements.get(nodes[i].payload?.elementId || nodes[i].id.split(":")[0])
          if (target && e.contains(target)) nodes.splice(i, 1)
        }
        fallback(
          e,
          "PSEUDO_ELEMENT_FALLBACK",
          "Pseudo-element composite retained as an image.",
          "subtree",
          1
        )
        break
      }
    }
    if (
      ((clipsChildren && clipRegion(e)) || e.hasAttribute("data-pptx-group")) &&
      nodes.length - componentStart > 1
    ) {
      let depth = 0
      for (
        let ancestor = e.parentElement;
        ancestor && root.contains(ancestor);
        ancestor = ancestor.parentElement
      )
        depth++
      const name =
        e.getAttribute("data-pptx-name") ||
        e.getAttribute("aria-label") ||
        e.querySelector("h1,h2,h3,[role=heading]")?.textContent?.trim() ||
        "Clipped component"
      const group = { id: source(e).elementId, name: name.slice(0, 120), depth }
      for (const node of nodes.slice(componentStart))
        node.componentGroups = [...(node.componentGroups || []), group]
    }
  }
  await visit(root)
  // Resolve ancestor overflow at the paint-leaf level, after temporary uniform
  // transforms have been restored. Interior text/shapes remain editable; only
  // paint that cannot express its intersection is captured with its real clips.
  const clippedFallbacks = []
  const discarded = new Set()
  for (const node of nodes) {
    if (node.kind === "fallback") continue
    // Native elliptical strips already carry their qualified ancestor clip.
    if (node.kind === "shape" && node.payload.fill?.kind === "elliptical" && node.payload.clip)
      continue
    const e = elements.get(node.source.elementId)
    if (!e) continue
    const clips = []
    for (
      let parent = e.parentElement;
      parent && root.contains(parent);
      parent = parent.parentElement
    ) {
      const clip = clipRegion(parent)
      if (clip) clips.push(clip)
    }
    if (!clips.length || clips.every(clip => insideRoundedClip(node.box, clip))) continue
    const visible = clips.reduce((b, clip) => intersectBoxes(b, clip), node.box)
    if (!visible.width || !visible.height) {
      discarded.add(node)
      continue
    }
    const p = node.payload
    if (
      node.kind === "shape" &&
      !p.fill?.kind &&
      !p.border &&
      !p.rotate &&
      !p.flipH &&
      p.radii?.every(pair => pair.every(v => !v))
    ) {
      let clipped = { box: node.box, radii: p.radii }
      for (const clip of clips) {
        if (insideRoundedClip(clipped.box, clip)) continue
        if (clipped.radii.some(pair => pair.some(Boolean))) {
          clipped = null
          break
        }
        clipped = clipSolidRectangle(clipped.box, clip)
        if (!clipped) break
      }
      if (clipped) {
        node.box = clipped.box
        p.radii = clipped.radii
        continue
      }
    }
    const scope =
      !node.adapter && !(e instanceof SVGElement) && ["shape", "paths"].includes(node.kind)
        ? "paint"
        : "subtree"
    if (!clippedFallbacks.some(entry => entry.e === e && entry.scope === scope))
      clippedFallbacks.push({ node, e, scope })
  }
  const captures = clippedFallbacks.filter(
    entry =>
      !clippedFallbacks.some(
        other => other !== entry && other.scope === "subtree" && other.e.contains(entry.e)
      )
  )
  const emittedCaptures = new Set()
  const clippedNodes = []
  for (const node of nodes) {
    const e = elements.get(node.source.elementId)
    const capture = captures.find(entry =>
      entry.scope === "subtree"
        ? entry.e === e || entry.e.contains(e)
        : entry.e === e && ["shape", "paths"].includes(node.kind)
    )
    if (capture) {
      if (!emittedCaptures.has(capture)) {
        emittedCaptures.add(capture)
        const { node: original, e: target, scope } = capture
        const bounds = box(target),
          cssPaint = scope === "paint" ? paintStyle(target) : undefined
        if (cssPaint) {
          const s = style(target),
            width =
              parseFloat(s.width) +
              (s.boxSizing === "border-box"
                ? 0
                : ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"].reduce(
                    (sum, k) => sum + parseFloat(s[k]),
                    0
                  )),
            scale = bounds.width / width
          for (const key of Object.keys(cssPaint))
            cssPaint[key] = cssPaint[key].replace(
              /(-?[\d.]+)px/g,
              (_, v) => `${Number(v) * scale}px`
            )
          cssPaint.width = `${bounds.width}px`
          cssPaint.height = `${bounds.height}px`
          cssPaint["box-sizing"] = "border-box"
        }
        const clips = []
        for (
          let parent = target.parentElement;
          parent && root.contains(parent);
          parent = parent.parentElement
        ) {
          const clip = clipRegion(parent)
          if (clip) clips.push(clip)
        }
        const id = original.id + ":clipped"
        clippedNodes.push({
          ...original,
          id,
          source: { ...original.source, objectId: id },
          kind: "fallback",
          box: bounds,
          opacity: scope === "paint" ? original.opacity : 1,
          payload: {
            elementId: original.source.elementId,
            scope,
            cssPaint,
            clips,
            reason: "CLIPPED_PAINT_FALLBACK",
            textCharacters: scope === "subtree" ? textCount(target) : 0
          }
        })
        issue(
          target,
          "CLIPPED_PAINT_FALLBACK",
          "Paint crossing an overflow boundary retained as a localized image; interior content remains editable."
        )
      }
    } else if (!discarded.has(node)) clippedNodes.push(node)
  }
  nodes.splice(0, nodes.length, ...clippedNodes)
  nodes.forEach((node, index) => {
    node.paintOrder = index
  })
  // A later clip may replace an admitted vector leaf with a graphic. Do not
  // report native approximations that were not actually retained in the file.
  for (let index = issues.length - 1; index >= 0; index--) {
    const entry = issues[index]
    if (
      !["SVG_PATTERN_MASK_APPROXIMATED", "GRADIENT_INTERPOLATION_APPROXIMATED"].includes(entry.code)
    )
      continue
    const retained = nodes.some(
      node =>
        node.kind !== "fallback" &&
        node.source.elementId === entry.source.elementId &&
        (entry.code === "SVG_PATTERN_MASK_APPROXIMATED"
          ? node.kind === "shape" && node.payload.approximation
          : node.payload.fill?.stops || node.payload.paths?.some(path => path.fill?.stops))
    )
    if (!retained) issues.splice(index, 1)
  }
  const fontFaces = [],
    unreadableSheets = []
  const sheets = new Set()
  function scan(sheet) {
    if (!sheet || sheets.has(sheet)) return
    sheets.add(sheet)
    let rules
    try {
      rules = sheet.cssRules
    } catch {
      if (sheet.href) unreadableSheets.push(sheet.href)
      return
    }
    for (const rule of rules) {
      if (rule.type === CSSRule.IMPORT_RULE) scan(rule.styleSheet)
      if (rule.type === CSSRule.FONT_FACE_RULE)
        fontFaces.push({
          family: rule.style.fontFamily.replace(/^['"]|['"]$/g, ""),
          weight: rule.style.fontWeight || "400",
          style: rule.style.fontStyle || "normal",
          urls: [...rule.style.src.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(
            m => new URL(m[1], sheet.href || document.baseURI).href
          )
        })
    }
  }
  for (const sheet of document.styleSheets) scan(sheet)
  return {
    schemaVersion: 1,
    slideId,
    width: 1280,
    height: 720,
    nodes,
    issues,
    fontFaces,
    unreadableSheets,
    declaredFonts: [...document.fonts].map(f => ({
      family: f.family,
      weight: f.weight,
      style: f.style,
      status: f.status
    }))
  }
}

export function makePaintPreview(root, node) {
  const clone = document.createElement("div")
  const saved = {
    root: root.style.visibility,
    html: document.documentElement.style.background,
    body: document.body.style.background
  }
  Object.assign(clone.style, {
    position: "fixed",
    left: `${node.box.x}px`,
    top: `${node.box.y}px`,
    margin: "0",
    visibility: "visible",
    zIndex: "2147483647"
  })
  for (const [key, value] of Object.entries(node.payload.cssPaint))
    clone.style.setProperty(key, value)
  clone.setAttribute("data-ps-pptx-paint", "true")
  root.style.visibility = "hidden"
  document.documentElement.style.background = "transparent"
  document.body.style.background = "transparent"
  const wrappers = []
  let parent = document.body
  let origin = { x: 0, y: 0 }
  for (const clip of node.payload.clips || []) {
    const wrapper = document.createElement("div")
    Object.assign(wrapper.style, {
      position: wrappers.length ? "absolute" : "fixed",
      left: `${clip.x - origin.x}px`,
      top: `${clip.y - origin.y}px`,
      width: `${clip.width}px`,
      height: `${clip.height}px`,
      overflow: "hidden",
      borderRadius:
        clip.radii.map(pair => `${pair[0]}px`).join(" ") +
        " / " +
        clip.radii.map(pair => `${pair[1]}px`).join(" "),
      visibility: "visible",
      zIndex: "2147483647"
    })
    parent.appendChild(wrapper)
    wrappers.push(wrapper)
    parent = wrapper
    origin = clip
  }
  if (wrappers.length)
    Object.assign(clone.style, {
      position: "absolute",
      left: `${node.box.x - origin.x}px`,
      top: `${node.box.y - origin.y}px`
    })
  parent.appendChild(clone)
  return () => {
    clone.remove()
    wrappers[0]?.remove()
    root.style.visibility = saved.root
    document.documentElement.style.background = saved.html
    document.body.style.background = saved.body
  }
}

/** Isolate the original subtree, retaining pseudo paint, overflowing descendants and ancestor clips. */
export function makeSubtreePreview(root, node) {
  const target =
    [...root.querySelectorAll("[data-ps-pptx-object]")].find(
      e => e.getAttribute("data-ps-pptx-object") === node.payload.elementId
    ) || (root.getAttribute("data-ps-pptx-object") === node.payload.elementId ? root : null)
  if (!target) throw new Error("Fallback source disappeared")
  const elements = [document.documentElement, document.body, root, ...root.querySelectorAll("*")]
  const original = elements.map(e => ({
    e,
    css: e.getAttribute("style"),
    visibility: getComputedStyle(e).visibility
  }))
  const svgDefinitions = new Set(root.querySelectorAll("svg defs, svg defs *"))
  for (const { e, visibility } of original)
    e.style.setProperty(
      "visibility",
      e === target || target.contains(e) || svgDefinitions.has(e) ? visibility : "hidden",
      "important"
    )
  document.documentElement.style.background = "transparent"
  document.body.style.background = "transparent"
  return () => {
    for (const { e, css } of original)
      if (css === null) e.removeAttribute("style")
      else e.setAttribute("style", css)
  }
}
