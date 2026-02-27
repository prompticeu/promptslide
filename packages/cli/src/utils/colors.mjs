export function hexToOklch(hex) {
  hex = hex.replace("#", "")
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  // sRGB → linear RGB
  const toLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)

  // Linear RGB → LMS
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  // LMS → OKLAB
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bv = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  // OKLAB → OKLCH
  const C = Math.sqrt(a * a + bv * bv)
  let H = Math.atan2(bv, a) * (180 / Math.PI)
  if (H < 0) H += 360

  const round = (n, d = 3) => +n.toFixed(d)
  return `oklch(${round(L)} ${round(C)} ${round(H)})`
}

export function hexToOklchDark(hex) {
  const oklch = hexToOklch(hex)
  const match = oklch.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/)
  const L = Math.min(1, parseFloat(match[1]) + 0.05)
  return `oklch(${+L.toFixed(3)} ${match[2]} ${match[3]})`
}

export function isValidHex(hex) {
  return /^#?[0-9a-fA-F]{6}$/.test(hex)
}
