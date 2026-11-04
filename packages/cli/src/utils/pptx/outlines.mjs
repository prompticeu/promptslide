import { Blob, Face, Font } from "harfbuzzjs"

// PowerPoint text runs cannot shear glyphs. Outline only simple SVG lettering
// using the exact resolved static face and Chromium's character origins. Keep
// ordinary labels as text, and preserve unsupported lettering as a local image.
export async function outlineSvgText(scene, fonts) {
  for (const node of scene.nodes) {
    const line = node.kind === "text" && node.payload.lines[0]
    if (!line?.affine) continue
    const run = line.runs[0],
      f = run.font,
      affine = line.affine
    try {
      const resolved = await fonts.resolve(f, node.actualFonts || [], node.source, run.text)
      const bytes = fonts.outlineFonts.get(resolved.hash)
      if (!bytes) throw new Error("Exact permitted font bytes unavailable")
      const face = new Face(new Blob(bytes)),
        font = new Font(face)
      const unitScale = f.size / face.upem
      const [a, b, c, d, e, g] = affine.matrix
      const paths = Array.from(run.text, (character, i) => {
        const glyph = font.nominalGlyph(character.codePointAt(0))
        if (glyph === undefined || glyph === 0) throw new Error("Unresolved SVG glyph")
        const origin = affine.glyphOrigins[i]
        return {
          d: font.glyphToPath(glyph),
          matrix: [
            a * unitScale,
            b * unitScale,
            -c * unitScale,
            -d * unitScale,
            a * origin.x + c * origin.y + e - node.box.x,
            b * origin.x + d * origin.y + g - node.box.y
          ],
          fill: f.color,
          fillOpacity: f.opacity ?? 1,
          stroke: null,
          strokeOpacity: 1,
          strokeWidth: 0
        }
      }).filter(path => path.d)
      if (!paths.length) throw new Error("Empty SVG glyph outline")
      node.kind = "paths"
      node.payload = {
        paths,
        textCharacters: node.payload.textCharacters,
        approximation: node.payload.approximation,
        outlinedText: run.text
      }
      scene.issues.push({
        code: "SVG_TEXT_OUTLINED",
        severity: "info",
        source: node.source,
        message:
          "Skewed SVG lettering is editable native freeform outlines, rather than text characters."
      })
    } catch (error) {
      node.kind = "fallback"
      node.payload = {
        elementId: node.source.elementId || node.source.objectId,
        scope: "subtree",
        reason: "SVG_TEXT_AFFINE_FALLBACK",
        textCharacters: node.payload.textCharacters
      }
      scene.issues.push({
        code: "SVG_TEXT_AFFINE_FALLBACK",
        severity: "warning",
        source: node.source,
        message: `Skewed SVG lettering retained as a localized graphic: ${error.message}.`
      })
    }
  }
}
