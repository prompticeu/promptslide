// Resolve visible text before image capture, so missing glyph coverage can use
// the original DOM as a localized fallback rather than failing in the writer.
export async function prepareTextFonts(scene, fonts, page, scopeSelector) {
  const captures = []
  for (const node of scene.nodes) {
    if (node.kind !== "text" && node.kind !== "table") continue
    try {
      if (node.kind === "text") {
        if (node.payload.lines.some(line => line.affine)) continue
        for (const line of node.payload.lines)
          for (const run of line.runs)
            run.fontParts = await fonts.resolveText(
              run.font,
              node.actualFonts || [],
              node.source,
              run.text
            )
      } else {
        for (const row of node.payload.rows)
          for (const cell of row)
            cell.fontParts = await fonts.resolveText(
              {
                family: cell.family || "Arial",
                size: cell.fontSize || 16,
                weight: cell.bold ? 700 : 400,
                style: cell.italic ? "italic" : "normal"
              },
              cell.actualFonts || [],
              node.source,
              cell.text
            )
      }
    } catch (error) {
      if (!String(error.message).startsWith("FONT_GLYPH_COVERAGE:")) throw error
      const textCharacters = node.payload.textCharacters || 0
      node.kind = "fallback"
      node.opacity = 1
      node.payload = {
        elementId: node.source.elementId,
        scope: "subtree",
        reason: "FONT_GLYPH_COVERAGE",
        textCharacters
      }
      captures.push(node)
      scene.issues.push({
        code: "FONT_GLYPH_COVERAGE",
        severity: "warning",
        source: node.source,
        message:
          "A text cluster cannot be reproduced by the available font files and is retained as a localized graphic."
      })
    }
  }
  if (captures.length && page) {
    // A subtree capture also contains its source background and descendants.
    // Remove their earlier native objects so translucent paint is not doubled.
    const absorbed = await page.evaluate(
      ({ nodes, captureIds, rootSelector }) => {
        const scope = rootSelector ? document.querySelector(rootSelector) : document
        if (!scope) throw new Error("Export root disappeared")
        const elements = new Map(
          [
            ...(scope.matches?.("[data-ps-pptx-object]") ? [scope] : []),
            ...scope.querySelectorAll("[data-ps-pptx-object]")
          ].map(e => [e.getAttribute("data-ps-pptx-object"), e])
        )
        const targets = nodes
          .filter(n => captureIds.includes(n.id))
          .filter((capture, index, all) => {
            const target = elements.get(capture.source.elementId)
            return !all.some((other, otherIndex) => {
              if (other.id === capture.id) return false
              const ancestor = elements.get(other.source.elementId)
              return (
                ancestor &&
                target &&
                (ancestor === target ? otherIndex < index : ancestor.contains(target))
              )
            })
          })
        return nodes
          .filter(node =>
            targets.some(capture => {
              if (node.id === capture.id) return false
              const target = elements.get(capture.source.elementId)
              const element = elements.get(node.source.elementId)
              return target && element && (target === element || target.contains(element))
            })
          )
          .map(node => node.id)
      },
      {
        nodes: scene.nodes.map(({ id, source }) => ({ id, source })),
        captureIds: captures.map(n => n.id),
        rootSelector: scopeSelector
      }
    )
    scene.nodes = scene.nodes.filter(node => !absorbed.includes(node.id))
  }
}
