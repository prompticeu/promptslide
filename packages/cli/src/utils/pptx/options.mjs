export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
export const DEFAULT_LIMITS = Object.freeze({
  slides: 100,
  nodes: 100000,
  pathSegments: 10000,
  assetBytes: 50 * 1024 * 1024,
  decodedPixels: 50_000_000,
  outputBytes: 250 * 1024 * 1024,
  gradientStops: 256,
  chartPoints: 10000,
  tableCells: 10000
})

export function validateOptions(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Export options must be an object")
  const allowed = new Set(["mode", "profile", "buildMode", "fontPolicy", "timeout", "rasterScale"])
  for (const key of Object.keys(input))
    if (!allowed.has(key)) throw new Error(`Unknown PowerPoint option: ${key}`)
  const value = {
    mode: "balanced",
    profile: "core-native",
    buildMode: "final",
    fontPolicy: "embed-when-permitted",
    timeout: 600,
    rasterScale: 2,
    ...input
  }
  for (const [key, choices] of Object.entries({
    mode: ["balanced", "strict"],
    profile: ["core-native", "extended"],
    buildMode: ["final", "slides", "native"],
    fontPolicy: ["embed-when-permitted", "require-installed"]
  })) {
    if (!choices.includes(value[key])) throw new Error(`Invalid ${key}: ${value[key]}`)
  }
  if (!Number.isInteger(value.timeout) || value.timeout < 1 || value.timeout > 600)
    throw new Error("timeout must be 1–600 seconds")
  if (![2, 3].includes(value.rasterScale)) throw new Error("rasterScale must be 2 or 3")
  return value
}

export function assertNotAborted(signal) {
  if (signal?.aborted) throw signal.reason || new DOMException("Export cancelled", "AbortError")
}

export function unionArea(rectangles) {
  const rects = rectangles
    .map(r => ({
      x: Math.max(0, r.x),
      y: Math.max(0, r.y),
      right: Math.min(1280, r.x + r.width),
      bottom: Math.min(720, r.y + r.height)
    }))
    .filter(r => r.right > r.x && r.bottom > r.y)
  const xs = [...new Set(rects.flatMap(r => [r.x, r.right]))].sort((a, b) => a - b)
  let area = 0
  for (let i = 1; i < xs.length; i++) {
    const intervals = rects
      .filter(r => r.x < xs[i] && r.right > xs[i - 1])
      .map(r => [r.y, r.bottom])
      .sort((a, b) => a[0] - b[0])
    let top = 0,
      bottom = 0,
      height = 0
    for (const [a, b] of intervals) {
      if (a > bottom) {
        height += bottom - top
        top = a
        bottom = b
      } else bottom = Math.max(bottom, b)
    }
    area += (height + bottom - top) * (xs[i] - xs[i - 1])
  }
  return area
}
