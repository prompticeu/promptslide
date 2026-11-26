import svgpath from "svgpath"

import { normalizedStops } from "../../core/export/gradient-stops.mjs"
export { normalizedStops } from "../../core/export/gradient-stops.mjs"

import { colorXml, emu, escapeXml } from "./xml.mjs"

export function pathXml(d, matrix = [1, 0, 0, 1, 0, 0], maxSegments = 10000) {
  if (
    typeof d !== "string" ||
    d.length > 2_000_000 ||
    !Array.isArray(matrix) ||
    matrix.length !== 6 ||
    matrix.some(v => !Number.isFinite(v))
  )
    throw new Error("Invalid SVG path")
  const path = svgpath(d).matrix(matrix).scale(1000).unshort().unarc().abs()
  if (path.err) throw new Error(`Invalid SVG: ${path.err}`)
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    result = "",
    segments = 0
  const pt = (a, b) => {
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 1e12 || Math.abs(b) > 1e12)
      throw new Error("Invalid path coordinate")
    return `<a:pt x="${Math.round(a)}" y="${Math.round(b)}"/>`
  }
  path.iterate(([cmd, ...v]) => {
    if (++segments > maxSegments) throw new Error("LIMIT_EXCEEDED: SVG path segments")
    if (cmd === "M" || cmd === "L") {
      result += `<a:${cmd === "M" ? "moveTo" : "lnTo"}>${pt(v[0], v[1])}</a:${cmd === "M" ? "moveTo" : "lnTo"}>`
      ;[x, y] = v
      if (cmd === "M") {
        sx = x
        sy = y
      }
    } else if (cmd === "H") {
      x = v[0]
      result += `<a:lnTo>${pt(x, y)}</a:lnTo>`
    } else if (cmd === "V") {
      y = v[0]
      result += `<a:lnTo>${pt(x, y)}</a:lnTo>`
    } else if (cmd === "C") {
      result += `<a:cubicBezTo>${pt(v[0], v[1])}${pt(v[2], v[3])}${pt(v[4], v[5])}</a:cubicBezTo>`
      ;[x, y] = v.slice(4)
    } else if (cmd === "Q") {
      result += `<a:cubicBezTo>${pt(x + ((v[0] - x) * 2) / 3, y + ((v[1] - y) * 2) / 3)}${pt(v[2] + ((v[0] - v[2]) * 2) / 3, v[3] + ((v[1] - v[3]) * 2) / 3)}${pt(v[2], v[3])}</a:cubicBezTo>`
      ;[x, y] = v.slice(2)
    } else if (cmd.toUpperCase() === "Z") {
      result += "<a:close/>"
      x = sx
      y = sy
    } else throw new Error(`Unsupported SVG command: ${cmd}`)
  })
  return result
}

export function customGeometry(paths, width, height) {
  return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst>${paths.map(p => `<a:path w="${Math.max(1, Math.round(width * 1000))}" h="${Math.max(1, Math.round(height * 1000))}" fill="${p.fill === false ? "none" : "norm"}" stroke="${p.stroke === false ? 0 : 1}">${p.commands}</a:path>`).join("")}</a:pathLst></a:custGeom>`
}

export function roundedGeometry(width, height, radii) {
  const [[tlx, tly], [trx, try_], [brx, bry], [blx, bly]] = radii
  if (radii.every(([x, y]) => x === 0 && y === 0))
    return '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
  if (radii.every(([x, y]) => Math.abs(x - width / 2) < 0.01 && Math.abs(y - height / 2) < 0.01))
    return '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>'
  const d = `M${tlx} 0H${width - trx}A${trx} ${try_} 0 0 1 ${width} ${try_}V${height - bry}A${brx} ${bry} 0 0 1 ${width - brx} ${height}H${blx}A${blx} ${bly} 0 0 1 0 ${height - bly}V${tly}A${tlx} ${tly} 0 0 1 ${tlx} 0Z`
  return customGeometry([{ commands: pathXml(d), fill: true, stroke: true }], width, height)
}

export function gradientXml(gradient, opacity = 1) {
  const stops = gradient.preSampled ? gradient.stops : normalizedStops(gradient.stops)
  if (
    stops.length < 2 ||
    stops.length > 256 ||
    stops.some(
      (s, i) =>
        !Number.isFinite(s.position) ||
        s.position < 0 ||
        s.position > 1 ||
        !s.color ||
        !Number.isFinite(s.color.alpha) ||
        s.color.alpha < 0 ||
        s.color.alpha > 1 ||
        !/^[0-9a-f]{6}$/i.test(s.color.hex) ||
        (i && s.position < stops[i - 1].position)
    )
  )
    throw new Error("Invalid native gradient stops")
  const gs = stops
    .map(
      s =>
        `<a:gs pos="${Math.round(Math.max(0, Math.min(1, s.position)) * 100000)}"><a:srgbClr val="${s.color.hex}"><a:alpha val="${Math.round(s.color.alpha * opacity * 100000)}"/></a:srgbClr></a:gs>`
    )
    .join("")
  const shading =
    gradient.kind === "linear"
      ? `<a:lin ang="${Math.round(((((gradient.angle - 90) % 360) + 360) % 360) * 60000)}" scaled="0"/>`
      : '<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>'
  return `<a:gradFill rotWithShape="1"><a:gsLst>${gs}</a:gsLst>${shading}</a:gradFill>`
}

export function strokeXml(stroke, opacity = 1) {
  if (!stroke?.color || !stroke.width) return "<a:ln><a:noFill/></a:ln>"
  const dash = stroke.dashValues
    ? `<a:custDash>${Array.from({ length: stroke.dashValues.length / 2 }, (_, i) => `<a:ds d="${Math.max(1, Math.round((stroke.dashValues[i * 2] / stroke.width) * 100000))}" sp="${Math.max(1, Math.round((stroke.dashValues[i * 2 + 1] / stroke.width) * 100000))}"/>`).join("")}</a:custDash>`
    : ""
  return `<a:ln w="${emu(stroke.width)}" cap="${stroke.cap === "round" ? "rnd" : stroke.cap === "square" ? "sq" : "flat"}">${colorXml(stroke.color, opacity)}${dash}${stroke.join === "round" ? "<a:round/>" : '<a:miter lim="800000"/>'}</a:ln>`
}
export function groupXml(
  id,
  name,
  content,
  box = { x: 0, y: 0, width: 1280, height: 720 },
  altText = "",
  childBox = box,
  rotate = 0
) {
  const x = emu(box.x),
    y = emu(box.y),
    width = Math.max(1, emu(box.width)),
    height = Math.max(1, emu(box.height))
  // Matching child/parent coordinate windows preserve measured positions while
  // giving PowerPoint a useful selection/resize box around this object.
  return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}" descr="${escapeXml(altText)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm${rotate ? ` rot="${Math.round((((rotate % 360) + 360) % 360) * 60000)}"` : ""}><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/><a:chOff x="${emu(childBox.x)}" y="${emu(childBox.y)}"/><a:chExt cx="${Math.max(1, emu(childBox.width))}" cy="${Math.max(1, emu(childBox.height))}"/></a:xfrm></p:grpSpPr>${content}</p:grpSp>`
}
