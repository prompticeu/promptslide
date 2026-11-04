// Conservative geometry for axis-aligned CSS overflow clips. Curved edges are
// retained only when a native rectangle can express the exact intersection.
export function intersectBoxes(a, b) {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y)
  }
}
export function insideRoundedClip(b, clip) {
  const epsilon = 0.001
  if (
    b.x < clip.x - epsilon ||
    b.y < clip.y - epsilon ||
    b.x + b.width > clip.x + clip.width + epsilon ||
    b.y + b.height > clip.y + clip.height + epsilon
  )
    return false
  const corners = [
    [clip.x, clip.y, 1, 1],
    [clip.x + clip.width, clip.y, -1, 1],
    [clip.x + clip.width, clip.y + clip.height, -1, -1],
    [clip.x, clip.y + clip.height, 1, -1]
  ]
  return [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x + b.width, b.y + b.height],
    [b.x, b.y + b.height]
  ].every(([x, y]) =>
    corners.every(([cx, cy, sx, sy], i) => {
      const [rx, ry] = clip.radii[i]
      if (!rx || !ry || (x - cx) * sx >= rx || (y - cy) * sy >= ry) return true
      return (((x - cx) * sx) / rx - 1) ** 2 + (((y - cy) * sy) / ry - 1) ** 2 <= 1 + epsilon
    })
  )
}
export function clipSolidRectangle(b, clip) {
  const result = intersectBoxes(b, clip),
    radii = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0]
    ]
  if (!result.width || !result.height) return { box: result, radii }
  const corners = [
    [clip.x, clip.y, 1, 1],
    [clip.x + clip.width, clip.y, -1, 1],
    [clip.x + clip.width, clip.y + clip.height, -1, -1],
    [clip.x, clip.y + clip.height, 1, -1]
  ]
  for (const [i, [x, y, sx, sy]] of corners.entries()) {
    const [rx, ry] = clip.radii[i]
    if (!rx || !ry) continue
    const corner = { x: sx > 0 ? x : x - rx, y: sy > 0 ? y : y - ry, width: rx, height: ry }
    const overlap = intersectBoxes(result, corner)
    if (!overlap.width || !overlap.height) continue
    // A cut through a curved corner is not a rounded rectangle.
    if (
      b.x > corner.x + 0.001 ||
      b.y > corner.y + 0.001 ||
      b.x + b.width < corner.x + rx - 0.001 ||
      b.y + b.height < corner.y + ry - 0.001
    )
      return null
    radii[i] = [rx, ry]
  }
  return { box: result, radii }
}
