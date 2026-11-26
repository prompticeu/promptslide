// Native linear-gradient rectangles sample a radial alpha field without raster
// assets. The 2px strip and adaptive-stop budgets bound geometry and color error.
export function radialGradientStrips(box, gradient, opacity = 1, clip = null) {
  const stops = gradient.stops
  if (
    !Number.isInteger(gradient.layers) ||
    gradient.layers < 2 ||
    gradient.layers > 360 ||
    !Number.isFinite(opacity) ||
    opacity < 0 ||
    opacity > 1 ||
    !Number.isFinite(gradient.extent) ||
    gradient.extent <= 0 ||
    !Array.isArray(stops) ||
    stops.length < 2 ||
    stops.length > 16 ||
    stops[0].position !== 0 ||
    stops.at(-1).alpha !== 0 ||
    stops.some(
      (s, i) =>
        !Number.isFinite(s.position) ||
        !Number.isFinite(s.alpha) ||
        s.alpha < 0 ||
        s.alpha > 1 ||
        (i && (s.position <= stops[i - 1].position || s.alpha > stops[i - 1].alpha))
    )
  )
    throw new Error("Invalid native elliptical gradient")
  const alphaAt = r => {
    const i = stops.findIndex(s => s.position >= r)
    if (i <= 0) return i === 0 ? stops[0].alpha * opacity : 0
    const a = stops[i - 1],
      b = stops[i],
      t = (r - a.position) / (b.position - a.position)
    return (a.alpha * (1 - t) + b.alpha * t) * opacity
  }
  const x = Math.max(box.x, clip?.x ?? box.x),
    y = Math.max(box.y, clip?.y ?? box.y),
    right = Math.min(box.x + box.width, clip ? clip.x + clip.width : Infinity),
    bottom = Math.min(box.y + box.height, clip ? clip.y + clip.height : Infinity)
  if (right <= x || bottom <= y) return []
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2,
    rx = (box.width * gradient.extent) / 2,
    ry = (box.height * gradient.extent) / 2
  const count = Math.min(gradient.layers, Math.max(1, Math.ceil((bottom - y) / 2))),
    height = (bottom - y) / count,
    result = []
  for (let i = 0; i < count; i++) {
    const top = y + i * height,
      dy = (top + height / 2 - cy) / ry,
      value = t => alphaAt(Math.hypot((x + t * (right - x) - cx) / rx, dy)),
      positions = new Set([0, 1])
    for (let j = 1; j < 32; j++) positions.add(j / 32)
    if (cx > x && cx < right) positions.add((cx - x) / (right - x))
    for (const stop of stops)
      if (stop.position >= Math.abs(dy)) {
        const dx = rx * Math.sqrt(Math.max(0, stop.position ** 2 - dy ** 2))
        for (const p of [cx - dx, cx + dx])
          if (p > x && p < right) positions.add((p - x) / (right - x))
      }
    const seeds = [...positions].sort((a, b) => a - b),
      points = []
    function subdivide(a, b, va, vb, depth = 0) {
      const m = (a + b) / 2,
        vm = value(m)
      if (depth < 8 && Math.abs(vm - (va + vb) / 2) > 1 / 1024 && points.length < 200) {
        subdivide(a, m, va, vm, depth + 1)
        subdivide(m, b, vm, vb, depth + 1)
      } else points.push({ position: a, color: { hex: gradient.color.hex, alpha: va } })
    }
    for (let j = 0; j < seeds.length - 1; j++)
      subdivide(seeds[j], seeds[j + 1], value(seeds[j]), value(seeds[j + 1]))
    points.push({ position: 1, color: { hex: gradient.color.hex, alpha: value(1) } })
    if (points.every(p => p.color.alpha === 0)) continue
    if (points.length > 256) throw new Error("LIMIT_EXCEEDED: elliptical gradient stops")
    result.push({
      box: { x, y: top, width: right - x, height },
      fill: { kind: "linear", angle: 90, stops: points, preSampled: true }
    })
  }
  return result
}
