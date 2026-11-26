function interpolate(a, b, t) {
  const alpha = a.alpha * (1 - t) + b.alpha * t
  const rgb = [0, 2, 4].map(i =>
    alpha
      ? Math.round(
          (parseInt(a.hex.slice(i, i + 2), 16) * a.alpha * (1 - t) +
            parseInt(b.hex.slice(i, i + 2), 16) * b.alpha * t) /
            alpha
        )
      : 0
  )
  return {
    hex: rgb
      .map(v => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase(),
    alpha
  }
}
export function normalizedStops(stops) {
  const at = position => {
    if (position <= stops[0].position) return stops[0].color
    for (let i = 1; i < stops.length; i++)
      if (position <= stops[i].position) {
        const span = stops[i].position - stops[i - 1].position
        return span
          ? interpolate(
              stops[i - 1].color,
              stops[i].color,
              (position - stops[i - 1].position) / span
            )
          : stops[i].color
      }
    return stops.at(-1).color
  }
  const selected = [
    { position: 0, color: at(0) },
    ...stops.filter(s => s.position >= 0 && s.position <= 1),
    { position: 1, color: at(1) }
  ]
  const result = selected.filter(
    (stop, index) =>
      !index ||
      stop.position !== selected[index - 1].position ||
      JSON.stringify(stop.color) !== JSON.stringify(selected[index - 1].color)
  )
  if (result.length > 256) throw new Error("LIMIT_EXCEEDED: gradient stops")
  // Refine the largest premultiplied-color interpolation error first. This
  // shares the finite stop budget across intervals rather than reserving 31
  // extra samples for every alpha change.
  for (;;) {
    let worst = -1,
      error = 0.25
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i],
        b = result[i + 1]
      if (a.position === b.position) continue
      const alpha = (a.color.alpha + b.color.alpha) / 2
      const difference = Math.max(
        ...[0, 2, 4].map(offset => {
          const x = parseInt(a.color.hex.slice(offset, offset + 2), 16),
            y = parseInt(b.color.hex.slice(offset, offset + 2), 16)
          return Math.abs(((x + y) / 2) * alpha - (x * a.color.alpha + y * b.color.alpha) / 2)
        })
      )
      if (difference > error) {
        error = difference
        worst = i
      }
    }
    if (worst < 0) return result
    if (result.length >= 256) throw new Error("LIMIT_EXCEEDED: gradient stops")
    const a = result[worst],
      b = result[worst + 1]
    result.splice(worst + 1, 0, {
      position: (a.position + b.position) / 2,
      color: interpolate(a.color, b.color, 0.5)
    })
  }
}
