// Generic eligibility for a bounded native approximation of a centered,
// constant-hue alpha glow. Unsupported paint remains on the screenshot path.
export function parseEllipticalGradient(css, width, height, color, split) {
  const match = /^radial-gradient\((.*)\)$/s.exec(css)
  if (!match || width <= 0 || height <= 0 || Math.abs(width - height) < 0.001) return null
  const args = split(match[1])
  let header = ""
  if (!color(args[0].replace(/\s+[-+.\d]+(?:%|px).*$/, ""))) header = args.shift()
  if (
    !/^(?:(?:ellipse\s*)?(?:(?:closest-side|farthest-corner)\s*)?(?:at (?:center(?: center)?|50% 50%))?)$/.test(
      header.trim()
    )
  )
    return null
  const stops = []
  let hue
  for (const arg of args) {
    const stop = /^(.*?)\s+([-+.\d]+)%$/.exec(arg)
    if (!stop) return null
    const value = color(stop[1]),
      position = Number(stop[2]) / 100
    if (!value || position < 0 || position > 1) return null
    if (value.alpha > 0) {
      const opaque = color(`color(from ${stop[1]} srgb r g b / 1)`) || value
      if (hue && hue !== opaque.hex) return null
      hue = opaque.hex
    }
    stops.push({ position, alpha: value.alpha })
  }
  if (
    !hue ||
    stops.length < 2 ||
    stops.length > 16 ||
    stops[0].position !== 0 ||
    stops.at(-1).alpha !== 0 ||
    stops.some((s, i) => i && (s.position <= stops[i - 1].position || s.alpha > stops[i - 1].alpha))
  )
    return null
  const extent = header.includes("closest-side") ? 1 : Math.SQRT2
  if (stops.at(-1).position * extent > 1 + 1e-6) return null
  const maxSlope = Math.max(
    ...stops
      .slice(1)
      .map((stop, i) => (stops[i].alpha - stop.alpha) / (stop.position - stops[i].position))
  )
  // With at most 2px per strip, bound vertical midpoint alpha error to 2/255.
  // Small or sharp glows that cannot meet this bound retain their image.
  if (height < (255 * maxSlope) / extent) return null

  return { kind: "elliptical", color: { hex: hue, alpha: 1 }, stops, extent, layers: 360 }
}
