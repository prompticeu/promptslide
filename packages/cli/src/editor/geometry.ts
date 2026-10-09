export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
export function snap(rect: Rect, others: Rect[], tolerance = 6) {
  const xs = [0, 640, 1280, ...others.flatMap(r => [r.x, r.x + r.width / 2, r.x + r.width])]
  const ys = [0, 360, 720, ...others.flatMap(r => [r.y, r.y + r.height / 2, r.y + r.height])]
  const closest = (values: number[], targets: number[]) => {
    let delta = tolerance + 1
    let guide: number | undefined
    for (const v of values)
      for (const t of targets)
        if (Math.abs(t - v) < Math.abs(delta)) {
          delta = t - v
          guide = t
        }
    return Math.abs(delta) <= tolerance ? { delta, guide } : { delta: 0, guide: undefined }
  }
  const x = closest([rect.x, rect.x + rect.width / 2, rect.x + rect.width], xs)
  const y = closest([rect.y, rect.y + rect.height / 2, rect.y + rect.height], ys)
  return { x: rect.x + x.delta, y: rect.y + y.delta, guideX: x.guide, guideY: y.guide }
}
export function aligned(
  rects: Rect[],
  axis: "x" | "y",
  mode: "start" | "center" | "end" | "distribute"
) {
  const size = axis === "x" ? "width" : "height"
  if (mode === "distribute") {
    if (rects.length < 3) return rects.map(r => r[axis])
    const sorted = rects.map((r, i) => ({ ...r, i })).sort((a, b) => a[axis] - b[axis])
    const first = sorted[0]!,
      last = sorted[sorted.length - 1]!
    const gap =
      (last[axis] + last[size] - first[axis] - sorted.reduce((s, r) => s + r[size], 0)) /
      (rects.length - 1)
    const result: number[] = []
    let pos = first[axis]
    for (const r of sorted) {
      result[r.i] = pos
      pos += r[size] + gap
    }
    return result
  }
  const min = Math.min(...rects.map(r => r[axis])),
    max = Math.max(...rects.map(r => r[axis] + r[size]))
  return rects.map(r =>
    mode === "start" ? min : mode === "end" ? max - r[size] : (min + max - r[size]) / 2
  )
}
