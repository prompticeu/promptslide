import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { Blob, Face, Font } from "harfbuzzjs"
import JSZip from "jszip"
import subsetFont from "subset-font"

import { parseGradient } from "../src/core/export/measure.mjs"
import { FontResolver, buildSfnt, renameFont, sfntTables } from "../src/utils/pptx/fonts.mjs"
import { normalizedStops } from "../src/utils/pptx/geometry.mjs"
import { writePresentation } from "../src/utils/pptx/writer.mjs"
import { NS, children, parseXml, validatePackage } from "../src/utils/pptx/xml.mjs"

const source = { slideId: "review", elementId: "object", objectId: "object" }
const font = { family: "Review Subset", size: 24, weight: 400, style: "normal" }
const mockFonts = {
  embedded: new Map(),
  resolve: async () => ({ family: "Arial", bold: false, italic: false }),
  write: async () => {}
}
const node = (kind, payload) => ({
  id: kind,
  kind,
  payload,
  source,
  opacity: 1,
  name: kind,
  buildStep: 0,
  box: { x: 100, y: 100, width: 400, height: 400 }
})
async function fixtureFont(t) {
  try {
    return await readFile("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf")
  } catch {
    t.skip("DejaVu Serif fixture font is unavailable")
  }
}

test("disjoint font subsets preserve every glyph under distinct embedded identities", async t => {
  const original = await fixtureFont(t)
  if (!original) return
  const assets = await Promise.all(
    ["A", "Ω"].map(async text => ({
      bytes: renameFont(
        await subsetFont(original, text, { targetFormat: "sfnt" }),
        font.family,
        false,
        false
      )
    }))
  )
  const resolver = new FontResolver({ assets })
  const parts = await resolver.resolveText(font, [], source, "AΩ")
  assert.equal(parts.map(p => p.text).join(""), "AΩ")
  assert.equal(parts.length, 2)
  assert.equal(new Set(parts.map(p => p.resolved.family)).size, 2)
  assert.equal(resolver.embedded.size, 2)
  for (const part of parts) {
    assert.equal(part.resolved.portable, true)
    const bytes = resolver.outlineFonts.get(part.resolved.hash)
    const face = new Font(new Face(new Blob(bytes)))
    assert.ok(face.nominalGlyph(part.text.codePointAt(0)))
  }
  await assert.rejects(resolver.resolveText(font, [], source, "Ж"), /FONT_GLYPH_COVERAGE/)
  const fallback = new FontResolver({ assets: [assets[0]] })
  const mixed = await fallback.resolveText(
    font,
    [{ familyName: font.family }, { familyName: "DejaVu Serif" }],
    source,
    "AΩ"
  )
  assert.equal(mixed.length, 2)
  assert.ok(mixed[0].resolved.family.startsWith(font.family))
  assert.ok(mixed[1].resolved.family.startsWith("DejaVu Serif"))
})

test("static regular and medium faces cannot overwrite the same embedded slot", async t => {
  const original = await fixtureFont(t)
  if (!original) return
  const assets = [400, 500].map(weight => {
    const sfnt = sfntTables(renameFont(original, "Review Static", false, false))
    sfnt.tables.get("OS/2").writeUInt16BE(weight, 4)
    return { bytes: buildSfnt(sfnt) }
  })
  const resolver = new FontResolver({ assets })
  const regular = await resolver.resolve({ ...font, family: "Review Static" }, [], source, "A")
  const medium = await resolver.resolve(
    { ...font, family: "Review Static", weight: 500 },
    [],
    source,
    "A"
  )
  assert.notEqual(regular.family, medium.family)
  assert.equal(resolver.embedded.size, 2)
})

test("nine alpha stops fit the native budget; excessive paint falls back at admission", async () => {
  const stops = Array.from({ length: 9 }, (_, i) => ({
    position: i / 8,
    color: { hex: "E11D48", alpha: 1 - i / 8 }
  }))
  assert.ok(normalizedStops(stops).length <= 256)
  const shape = node("shape", { fill: { kind: "linear", angle: 90, stops }, radius: 0 })
  const result = await writePresentation([{ slideId: "review", nodes: [shape] }], {
    fonts: mockFonts
  })
  await validatePackage(await JSZip.loadAsync(result.buffer))
  const css = `linear-gradient(90deg,${Array.from({ length: 257 }, (_, i) => `${i % 2 ? "red" : "blue"} ${(i / 256) * 100}%`).join(",")})`
  assert.equal(
    parseGradient(css, 400, 400, color => ({
      hex: color === "red" ? "FF0000" : "0000FF",
      alpha: 1
    })),
    null
  )
})

test("rowspans use measured row heights and scaled intrinsic images retain physical size", async () => {
  const cell = { text: "A", box: { width: 100, height: 80 }, rowSpan: 2, colSpan: 1, fontSize: 16 }
  const table = node("table", {
    rowHeights: [40, 40],
    rows: [
      [cell, { ...cell, rowSpan: 1, box: { width: 100, height: 40 } }],
      [{ ...cell, rowSpan: 1, box: { width: 100, height: 40 } }]
    ]
  })
  const picture = node("picture", {
    data: "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    naturalWidth: 100,
    naturalHeight: 100,
    fit: "none",
    renderScaleX: 2,
    renderScaleY: 2
  })
  table.box.height = 80
  const { buffer } = await writePresentation([{ slideId: "review", nodes: [table, picture] }], {
    fonts: mockFonts
  })
  const zip = await JSZip.loadAsync(buffer)
  await validatePackage(zip)
  const doc = parseXml(await zip.file("ppt/slides/slide1.xml").async("string"))
  assert.deepEqual(
    children(doc, NS.a, "tr").map(e => Number(e.getAttribute("h"))),
    [381000, 381000]
  )
  const pic = children(doc, NS.p, "pic")[0]
  const size = children(pic, NS.a, "ext")[0]
  assert.equal(Number(size.getAttribute("cx")), 1905000)
  assert.equal(Number(size.getAttribute("cy")), 1905000)
})
