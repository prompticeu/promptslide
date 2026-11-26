import assert from "node:assert/strict"
import test from "node:test"

import JSZip from "jszip"

import { parsePptxArgs } from "../src/commands/to-pptx.mjs"
import { parseGradient, parseHardStopConic, splitCss } from "../src/core/export/measure.mjs"
import { parseEllipticalGradient } from "../src/core/export/radial.mjs"
import {
  buildSfnt,
  sfntTables,
  fontInfo,
  fontToEot,
  renameFont,
  fontKey
} from "../src/utils/pptx/fonts.mjs"
import { normalizedStops, pathXml, roundedGeometry } from "../src/utils/pptx/geometry.mjs"
import { validateOptions, unionArea } from "../src/utils/pptx/options.mjs"
import { radialGradientStrips } from "../src/utils/pptx/radial.mjs"
import { writePresentation } from "../src/utils/pptx/writer.mjs"
import { NS, parseXml, children, validatePackage } from "../src/utils/pptx/xml.mjs"

const blue = { hex: "2563EB", alpha: 1 },
  red = { hex: "E11D48", alpha: 1 }
const color = text =>
  ({
    blue,
    red,
    transparent: { hex: "000000", alpha: 0 },
    "rgb(1, 2, 3)": { hex: "010203", alpha: 1 }
  })[text] || null
const box = { x: 80, y: 160, width: 400, height: 240 }
const source = {
  slideId: "test",
  objectId: "test-object",
  elementId: "test-object",
  domPath: "div"
}
const node = (kind, payload, id = kind) => ({
  id,
  kind,
  payload,
  box,
  source: { ...source, objectId: id },
  opacity: 1,
  name: id,
  buildStep: 0,
  animation: "fade"
})
const mockFonts = {
  embedded: new Map(),
  resolve: async f => ({ family: "Arial", bold: f.weight >= 600, italic: false }),
  write: async () => {}
}

test("notes-free exports omit unused notes parts and relationships", async () => {
  const result = await writePresentation([{ slideId: "empty-notes", nodes: [] }], {
    fonts: mockFonts
  })
  const zip = await JSZip.loadAsync(result.buffer)
  await validatePackage(zip)
  assert.ok(!Object.keys(zip.files).some(name => /^ppt\/notes(?:Masters|Slides)\//.test(name)))
  const presentation = await zip.file("ppt/presentation.xml").async("string")
  assert.doesNotMatch(presentation, /notesMasterIdLst/)
  for (const part of Object.keys(zip.files).filter(name => name.endsWith(".rels")))
    assert.doesNotMatch(
      await zip.file(part).async("string"),
      /relationships\/notes(?:Slide|Master)/
    )
})

test("speaker notes and master placeholders survive with a dedicated notes theme", async () => {
  const result = await writePresentation(
    [
      { slideId: "with-notes", notes: "Speaker notes <&> stay intact.", nodes: [] },
      { slideId: "without-notes", nodes: [] }
    ],
    { fonts: mockFonts }
  )
  const zip = await JSZip.loadAsync(result.buffer)
  await validatePackage(zip)
  const master = parseXml(await zip.file("ppt/notesMasters/notesMaster1.xml").async("string"))
  assert.equal(
    children(master, NS.p, "ph").length,
    6,
    "Keep master placeholders; notes inherit by type"
  )
  const first = parseXml(await zip.file("ppt/notesSlides/notesSlide1.xml").async("string"))
  assert.ok(
    children(first, NS.a, "t").some(t => t.textContent === "Speaker notes <&> stay intact.")
  )
  assert.ok(zip.file("ppt/theme/theme2.xml"))
  assert.match(
    await zip.file("ppt/notesMasters/_rels/notesMaster1.xml.rels").async("string"),
    /theme2\.xml/
  )
  const relationPart = "ppt/notesMasters/_rels/notesMaster1.xml.rels"
  const sharedTheme = (await zip.file(relationPart).async("string")).replace(
    "theme2.xml",
    "theme1.xml"
  )
  zip.file(relationPart, sharedTheme)
  await assert.rejects(validatePackage(zip), /dedicated theme part/)
})

test("CLI rejects invalid options and path collisions before starting a browser", () => {
  assert.equal(parsePptxArgs(["--mode=strict", "--builds", "slides"]).options.buildMode, "slides")
  assert.throws(() => parsePptxArgs(["-o"]), /requires a path/)
  assert.throws(() => parsePptxArgs(["--unknown"]), /Unknown/)
  assert.throws(() => parsePptxArgs(["--port=0"]), /Invalid/)
  assert.throws(() => parsePptxArgs(["-o", "a", "--report=a"]), /must differ/)
  assert.throws(() => validateOptions({ timeout: 601 }), /timeout/)
  assert.throws(() => validateOptions({ cwd: "outside" }), /Unknown/)
})
test("gradient parser handles nested color commas, implicit and pixel stops", () => {
  assert.equal(splitCss("rgb(1, 2, 3), red").length, 2)
  const g = parseGradient(
    "linear-gradient(125deg, blue 0%, rgb(1, 2, 3), red 100%)",
    1000,
    360,
    color
  )
  assert.equal(g.angle, 125)
  assert.equal(g.stops[1].position, 0.5)
  const px = parseGradient("linear-gradient(90deg, blue 100px, red 400px)", 400, 240, color)
  assert.equal(px.stops[0].position, 0.25)
  assert.equal(parseGradient("conic-gradient(blue, red)", 400, 240, color), null)
  assert.equal(
    parseGradient("radial-gradient(ellipse at 30% 40%, blue, red)", 400, 240, color),
    null
  )
  assert.equal(
    parseGradient("radial-gradient(circle at 50% 50%, blue, red)", 400, 240, color).kind,
    "radial"
  )
})
test("implicit radial gradients on square boxes retain native circular geometry", () => {
  for (const header of ["", "ellipse, ", "ellipse at center, ", "at 50% 50%, "]) {
    const css = `radial-gradient(${header}blue 0%, transparent 68%)`
    assert.equal(parseGradient(css, 780, 780, color)?.kind, "radial")
    assert.equal(parseGradient(css, 1000, 500, color), null)
  }
  assert.equal(
    parseGradient("radial-gradient(ellipse at 30% 40%, blue 0%, transparent 68%)", 780, 780, color),
    null
  )
  assert.equal(
    parseGradient(
      "radial-gradient(ellipse closest-side, blue 0%, transparent 68%)",
      780,
      780,
      color
    ),
    null
  )
})

test("elliptical alpha conversion uses geometry and stops, with unsupported paint rejected", () => {
  const sample = css => parseEllipticalGradient(css, 1000, 400, color, splitCss)
  const fill = sample("radial-gradient(ellipse at center, blue 0%, transparent 68%)")
  assert.equal(fill.kind, "elliptical")
  assert.equal(fill.color.hex, blue.hex)
  assert.equal(
    parseEllipticalGradient(
      "radial-gradient(ellipse, blue 0%, transparent 68%)",
      1000,
      40,
      color,
      splitCss
    ),
    null
  )
  assert.equal(sample("radial-gradient(ellipse, blue 0%, transparent 1%)"), null)

  assert.equal(sample("radial-gradient(ellipse at 30% 40%, blue 0%, transparent 68%)"), null)
  assert.equal(
    sample("radial-gradient(ellipse at center, blue 0%, red 30%, transparent 68%)"),
    null
  )
  assert.equal(sample("radial-gradient(ellipse, blue 0%, transparent 100%)"), null)
  assert.equal(
    parseEllipticalGradient(
      "radial-gradient(ellipse, blue 0%, transparent 68%)",
      500,
      500,
      color,
      splitCss
    ),
    null
  )
})

test("native elliptical strips keep clipping and alpha bounds and serialize without images", async () => {
  const fill = parseEllipticalGradient(
    "radial-gradient(ellipse at center, blue 0%, transparent 68%)",
    1000,
    400,
    color,
    splitCss
  )
  const bounds = { x: -100, y: -50, width: 1000, height: 400 },
    clip = { x: 0, y: 0, width: 640, height: 300 }
  const strips = radialGradientStrips(bounds, fill, 0.4, clip)
  assert.ok(strips.length > 100 && strips.length <= 360)
  for (const strip of strips) {
    assert.ok(strip.box.x >= clip.x && strip.box.y >= clip.y)
    assert.ok(
      strip.box.x + strip.box.width <= clip.x + clip.width + 0.001 &&
        strip.box.y + strip.box.height <= clip.y + clip.height + 0.001
    )
    assert.ok(strip.fill.stops.length <= 256)
    assert.ok(strip.fill.stops.every(s => s.color.alpha >= 0 && s.color.alpha <= 0.4))
  }
  assert.throws(() => radialGradientStrips(bounds, { ...fill, layers: 10000 }, 1, clip), /Invalid/)
  assert.throws(
    () =>
      radialGradientStrips(
        bounds,
        {
          ...fill,
          stops: [
            { position: 0, alpha: 0.2 },
            { position: 0.4, alpha: 0.8 },
            { position: 1, alpha: 0 }
          ]
        },
        1,
        clip
      ),
    /Invalid/
  )
  const shape = { ...node("shape", { fill, clip, approximation: true }), box: bounds, opacity: 0.4 }
  const result = await writePresentation([{ slideId: "elliptical", nodes: [shape] }], {
    fonts: mockFonts
  })
  const zip = await JSZip.loadAsync(result.buffer)
  await validatePackage(zip)
  const doc = parseXml(await zip.file("ppt/slides/slide1.xml").async("string"))
  assert.equal(children(doc, NS.p, "pic").length, 0)
  assert.equal(children(doc, NS.a, "gradFill").length, strips.length)
  assert.equal(result.objectMap[0].representation, "native-approximation")
})

test("categorical conic parser accepts opaque complete turns and rejects interpolation", () => {
  const sectors = parseHardStopConic(
    "conic-gradient(from 30deg at center, blue 0deg 215deg, red 215deg 360deg)",
    color
  )
  assert.equal(sectors.length, 2)
  assert.equal(sectors[0].start, 30)
  assert.equal(sectors[1].end, 390)
  assert.deepEqual(
    parseHardStopConic(
      "conic-gradient(from 30deg, blue 0deg, blue 215deg, red 215deg, red 360deg)",
      color
    ),
    sectors
  )
  assert.equal(parseHardStopConic("conic-gradient(blue 0% 50%, red 50% 100%)", color).length, 2)
  assert.equal(
    parseHardStopConic(
      "conic-gradient(from .5turn, blue 0rad 3.141592653589793rad, red 200grad 400grad)",
      color
    ).length,
    2
  )
  for (const css of [
    "conic-gradient(blue, red)",
    "conic-gradient(blue 0deg 180deg, red 190deg 360deg)",
    "conic-gradient(blue 0deg 180deg, transparent 180deg 360deg)",
    "conic-gradient(at 30% 50%, blue 0deg 180deg, red 180deg 360deg)",
    "conic-gradient(in oklab, blue 0deg 180deg, red 180deg 360deg)",
    "conic-gradient(blue 0deg 180deg, red 180deg 350deg)"
  ])
    assert.equal(parseHardStopConic(css, color), null)
})
test("native text retains editable gradient fills without pictures", async () => {
  const font = {
    family: "Arial",
    size: 24,
    weight: 400,
    style: "normal",
    letterSpacing: 0,
    color: blue,
    decoration: "none",
    language: "en"
  }
  const gradient = node(
    "text",
    {
      textCharacters: 8,
      lines: [
        {
          x: 100,
          y: 100,
          width: 180,
          height: 30,
          runs: [
            {
              text: "Gradient",
              font: {
                ...font,
                fill: {
                  kind: "linear",
                  angle: 120,
                  stops: [
                    { position: 0, color: blue },
                    { position: 1, color: red }
                  ]
                }
              }
            }
          ]
        }
      ]
    },
    "gradient-text"
  )
  const result = await writePresentation([{ slideId: "native-text", nodes: [gradient] }], {
    fonts: mockFonts
  })
  const zip = await JSZip.loadAsync(result.buffer)
  await validatePackage(zip)
  const doc = parseXml(await zip.file("ppt/slides/slide1.xml").async("string"))
  assert.equal(children(doc, NS.p, "pic").length, 0)
  assert.ok(children(doc, NS.a, "rPr").some(run => children(run, NS.a, "gradFill").length === 1))
  assert.deepEqual(
    children(doc, NS.a, "t").map(t => t.textContent),
    ["Gradient"]
  )
  assert.ok(children(doc, NS.p, "grpSp").length >= 1)
})
test("alpha interpolation preserves premultiplied color and stop bounds", () => {
  const stops = normalizedStops([
    { position: -1, color: blue },
    { position: 1, color: { hex: "E11D48", alpha: 0.4 } }
  ])
  assert.equal(stops[0].position, 0)
  assert.equal(stops.at(-1).position, 1)
  assert.ok(stops.length > 2)
  assert.equal(stops[0].color.alpha, 0.7)
  assert.throws(
    () =>
      normalizedStops(Array.from({ length: 257 }, (_, i) => ({ position: i / 256, color: blue }))),
    /LIMIT_EXCEEDED/
  )
})
test("SVG paths normalize curves and arcs without flattening to images", () => {
  const xml = pathXml("M0 0 Q10 20 20 0 A10 10 0 0 1 40 0Z")
  assert.match(xml, /cubicBezTo/)
  assert.match(xml, /a:close/)
  assert.throws(() => pathXml("M0 0L10 10", [1, 0, 0, 1, 0, 0], 1), /LIMIT_EXCEEDED/)
  assert.throws(() => pathXml("not a path"), /Invalid SVG/)
  assert.match(
    roundedGeometry(200, 100, [
      [100, 50],
      [100, 50],
      [100, 50],
      [100, 50]
    ]),
    /ellipse/
  )
})
test("fallback coverage counts overlap once and clips to slide bounds", () => {
  assert.equal(
    unionArea([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 5, y: 0, width: 10, height: 10 }
    ]),
    150
  )
  assert.equal(unionArea([{ x: -10, y: -10, width: 20, height: 20 }]), 100)
})
function testFont(fsType = 0) {
  const head = Buffer.alloc(54),
    hhea = Buffer.alloc(36),
    os2 = Buffer.alloc(96)
  head.writeUInt16BE(2048, 18)
  hhea.writeInt16BE(1900, 4)
  hhea.writeInt16BE(-450, 6)
  os2.writeUInt16BE(4)
  os2.writeUInt16BE(400, 4)
  os2.writeUInt16BE(fsType, 8)
  const name = Buffer.alloc(6)
  return buildSfnt({
    signature: 0x00010000,
    tables: new Map([
      ["head", head],
      ["hhea", hhea],
      ["OS/2", os2],
      ["name", name],
      ["GPOS", Buffer.from("preserve-positioning")],
      ["GSUB", Buffer.from("preserve-substitution")],
      ["kern", Buffer.from("preserve-kerning")]
    ])
  })
}
test("font wrapper retains original shaping tables and enforces embedding permissions", () => {
  const font = testFont(),
    eot = fontToEot(font)
  assert.equal(eot.readUInt32LE(0), eot.length)
  assert.equal(eot.readUInt16LE(34), 0x504c)
  assert.deepEqual(eot.subarray(-font.length), font)
  for (const table of ["GPOS", "GSUB", "kern"])
    assert.deepEqual(
      sfntTables(eot.subarray(-font.length)).tables.get(table),
      sfntTables(font).tables.get(table)
    )
  assert.equal(fontInfo(font).unitsPerEm, 2048)
  assert.throws(() => fontToEot(testFont(2)), /license/)
  assert.throws(() => fontInfo(Buffer.alloc(8)), /Invalid/)
})
test("static instance directories use binary tag order and consistent style flags", () => {
  const original = testFont(),
    renamed = renameFont(original, "Instance", true, true)
  const tags = Array.from({ length: renamed.readUInt16BE(4) }, (_, i) =>
    renamed.toString("ascii", 12 + 16 * i, 16 + 16 * i)
  )
  assert.deepEqual(tags, [...tags].sort())
  const info = fontInfo(renamed)
  assert.equal(info.tables.get("OS/2").readUInt16BE(62) & (1 | 32 | 64), 33)
  assert.equal(info.tables.get("head").readUInt16BE(44) & 3, 3)
  assert.notEqual(fontKey({ family: "A", size: 12 }), fontKey({ family: "A", size: 24 }))
  assert.deepEqual(info.tables.get("GPOS"), sfntTables(original).tables.get("GPOS"))
})

test("EOT v1 font data immediately follows FullName without a trailing separator", () => {
  const font = testFont(),
    eot = fontToEot(font)
  let offset = 82
  for (let name = 0; name < 4; name++) {
    const size = eot.readUInt16LE(offset)
    offset += 2 + size
    if (name < 3) {
      assert.equal(eot.readUInt16LE(offset), 0)
      offset += 2
    }
  }
  assert.equal(offset, eot.length - font.length)
  assert.deepEqual(eot.subarray(offset), font)
})
test("native output preserves gradients, freeforms, text, notes, links and step metadata", async () => {
  const shape = node("shape", {
    fill: {
      kind: "linear",
      angle: 125,
      stops: [
        { color: blue, position: 0 },
        { color: red, position: 1 }
      ]
    },
    radii: [
      [24, 24],
      [24, 24],
      [24, 24],
      [24, 24]
    ]
  })
  const paths = node("paths", {
    paths: [
      {
        d: "M0 0L200 0L100 200Z",
        matrix: [1, 0, 0, 1, 0, 0],
        fill: blue,
        fillOpacity: 1,
        stroke: null,
        strokeOpacity: 1
      }
    ]
  })
  const text = node("text", {
    textCharacters: 12,
    lines: [
      {
        x: 80,
        y: 60,
        width: 300,
        height: 30,
        runs: [
          {
            text: "Editable <&>",
            font: {
              family: "Arial",
              size: 24,
              weight: 700,
              style: "normal",
              decoration: "none",
              letterSpacing: 0,
              color: blue,
              language: "en-US"
            }
          }
        ]
      }
    ]
  })
  shape.hyperlink = "https://example.com/"
  paths.buildStep = 1
  const frame = {
    slideId: "test",
    title: "Test",
    notes: "Speaker note",
    nodes: [shape, paths, text]
  }
  const result = await writePresentation([frame], { fonts: mockFonts, buildMode: "native" })
  const zip = await JSZip.loadAsync(result.buffer)
  await validatePackage(zip)
  const doc = parseXml(await zip.file("ppt/slides/slide1.xml").async("string"))
  assert.equal(children(doc, NS.p, "pic").length, 0)
  assert.equal(children(doc, NS.a, "gradFill").length, 1)
  assert.equal(children(doc, NS.p, "timing").length, 1)
  assert.ok(children(doc, NS.a, "custGeom").length >= 2)
  assert.equal(children(doc, NS.a, "t")[0].textContent, "Editable <&>")
  const textGroup = children(doc, NS.p, "grpSp").find(group =>
    children(group, NS.a, "t").some(run => run.textContent === "Editable <&>")
  )
  const groupTransform = children(textGroup, NS.p, "grpSpPr")[0].firstChild
  const extent = children(groupTransform, NS.a, "ext")[0]
  // The native no-wrap line includes the writer's two-pixel safety allowance.
  assert.equal(Number(extent.getAttribute("cx")), 302 * 9525)
  assert.equal(Number(extent.getAttribute("cy")), 30 * 9525)
  assert.equal(
    children(groupTransform, NS.a, "off")[0].getAttribute("x"),
    children(groupTransform, NS.a, "chOff")[0].getAttribute("x")
  )
  assert.match(await zip.file("ppt/notesSlides/notesSlide1.xml").async("string"), /Speaker note/)
  assert.match(
    await zip.file("ppt/slides/_rels/slide1.xml.rels").async("string"),
    /https:\/\/example.com/
  )
  assert.equal(result.objectMap.length, 3)
})
test("packages with 20 slides have no surplus master declarations and are deterministic", async () => {
  const frames = Array.from({ length: 20 }, (_, i) => ({ slideId: `slide-${i}`, nodes: [] }))
  const a = await writePresentation(frames, { fonts: mockFonts }),
    b = await writePresentation(frames, { fonts: mockFonts })
  assert.deepEqual(a.buffer, b.buffer)
  await validatePackage(await JSZip.loadAsync(a.buffer))
})
test("semantic adapters produce real native chart/workbook and table parts", async () => {
  const chart = node("chart", {
    type: "column",
    series: [{ name: "Revenue", labels: ["A", "B"], values: [4, 7] }]
  })
  const cell = {
    text: "Cell",
    box: { width: 200, height: 40 },
    fontSize: 16,
    family: "Arial",
    colSpan: 1,
    rowSpan: 1,
    color: blue,
    align: "left"
  }
  const table = node("table", {
    rows: [
      [cell, cell],
      [cell, cell]
    ]
  })
  const result = await writePresentation([{ slideId: "semantic", nodes: [chart, table] }], {
    fonts: mockFonts
  })
  const zip = await JSZip.loadAsync(result.buffer)
  await validatePackage(zip)
  assert.ok(Object.keys(zip.files).some(n => /^ppt\/charts\/chart\d+\.xml$/.test(n)))
  assert.ok(Object.keys(zip.files).some(n => n.endsWith(".xlsx")))
  assert.match(await zip.file("ppt/slides/slide1.xml").async("string"), /<a:tbl>/)
  assert.doesNotMatch(await zip.file("ppt/slides/slide1.xml").async("string"), /anchor="mid"/)
  const chartDoc = parseXml(await zip.file("ppt/charts/chart1.xml").async("string"))
  const barChart = children(chartDoc, NS.c, "barChart")[0]
  assert.equal(children(barChart, NS.c, "axId").length, 2)
  const root = parseXml(await zip.file("ppt/presentation.xml").async("string")).documentElement
  const order = [...root.childNodes].filter(n => n.nodeType === 1).map(n => n.localName)
  assert.ok(order.indexOf("notesMasterIdLst") < order.indexOf("sldIdLst"))
})

test("chart workbooks retain zero values and scatter exports actual XY series", async () => {
  for (const type of ["column", "scatter"]) {
    const chart = node("chart", {
      type,
      series: [{ name: "Measured", labels: ["0", "1", "2"], values: [0, 5, 0] }]
    })
    const original = JSON.stringify(chart.payload)
    const output = await writePresentation([{ slideId: type, nodes: [chart] }], {
      fonts: mockFonts
    })
    assert.equal(JSON.stringify(chart.payload), original)
    const zip = await JSZip.loadAsync(output.buffer)
    const book = await JSZip.loadAsync(
      await zip.file("ppt/embeddings/chart-data-1.xlsx").async("nodebuffer")
    )
    const sheet = parseXml(await book.file("xl/worksheets/sheet1.xml").async("string"))
    const cells = new Map(
      children(sheet, NS.s, "c").map(c => [
        c.getAttribute("r"),
        children(c, NS.s, "v")[0]?.textContent
      ])
    )
    assert.equal(cells.get("B2"), "0")
    assert.equal(cells.get("B4"), "0")
    const doc = parseXml(await zip.file("ppt/charts/chart1.xml").async("string"))
    if (type === "scatter") {
      assert.equal(children(doc, NS.c, "ser").length, 1)
      assert.equal(cells.get("A2"), "0")
      assert.ok(children(doc, NS.c, "xVal").length)
    }
  }
})
test("chart packages remain byte-identical across writer instances and clock changes", async () => {
  const chart = node("chart", {
    type: "scatter",
    series: [
      { name: "A", labels: ["0", "1"], values: [0, 2] },
      { name: "B", labels: ["0", "1"], values: [3, 4] }
    ],
    colors: ["2563EB"]
  })
  const frame = { slideId: "deterministic-chart", nodes: [chart] }
  const first = await writePresentation([frame], { fonts: mockFonts })
  await new Promise(done => setTimeout(done, 2100))
  const second = await writePresentation([frame], { fonts: mockFonts })
  assert.ok(
    first.buffer.equals(second.buffer),
    "Chart packages must be byte-identical across clock changes"
  )
})
test("chart and table resource limits reject excessive semantic payloads", async () => {
  const huge = node("chart", {
    type: "column",
    series: Array.from({ length: 2 }, () => ({
      name: "Too large",
      labels: Array(6000).fill("A"),
      values: Array(6000).fill(1)
    }))
  })
  await assert.rejects(
    writePresentation([{ slideId: "limit", nodes: [huge] }], { fonts: mockFonts }),
    /LIMIT_EXCEEDED/
  )
  const table = node("table", {
    rows: Array.from({ length: 101 }, () => Array(100).fill({ text: "Cell" }))
  })
  await assert.rejects(
    writePresentation([{ slideId: "limit", nodes: [table] }], { fonts: mockFonts }),
    /LIMIT_EXCEEDED/
  )
  const scatter = node("chart", {
    type: "scatter",
    series: [{ name: "Invalid", labels: ["A"], values: [1] }]
  })
  await assert.rejects(
    writePresentation([{ slideId: "limit", nodes: [scatter] }], { fonts: mockFonts }),
    /numeric x/
  )
})

test("rounded overflow clips preserve interior rectangles and reject curved-edge cuts", async () => {
  const { insideRoundedClip, clipSolidRectangle } = await import("../src/core/export/clip.mjs")
  const clip = {
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    radii: [
      [12, 8],
      [12, 8],
      [12, 8],
      [12, 8]
    ]
  }
  assert.equal(insideRoundedClip({ x: 10, y: 20, width: 100, height: 80 }, clip), false)
  assert.equal(insideRoundedClip({ x: 22, y: 20, width: 76, height: 80 }, clip), true)
  assert.equal(insideRoundedClip({ x: 9, y: 40, width: 20, height: 20 }, clip), false)
  const whole = clipSolidRectangle({ x: 0, y: 0, width: 200, height: 200 }, clip)
  assert.deepEqual(whole.box, { x: 10, y: 20, width: 100, height: 80 })
  assert.deepEqual(whole.radii, clip.radii)
  assert.equal(clipSolidRectangle({ x: 15, y: 20, width: 50, height: 40 }, clip), null)
  assert.deepEqual(clipSolidRectangle({ x: 0, y: 40, width: 30, height: 20 }, clip), {
    box: { x: 10, y: 40, width: 20, height: 20 },
    radii: [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0]
    ]
  })
})

test("native SVG paths retain gradient fills and component groups without moving geometry", async () => {
  const gradient = node(
    "paths",
    {
      paths: [
        {
          d: "M0 0C100 20 200 0 400 100L400 240L0 240Z",
          matrix: [1, 0, 0, 1, 0, 0],
          fill: {
            kind: "linear",
            angle: 180,
            stops: [
              { position: 0, color: blue },
              { position: 1, color: { ...blue, alpha: 0 } }
            ]
          },
          fillOpacity: 1,
          stroke: null,
          strokeOpacity: 1,
          strokeWidth: 0
        }
      ]
    },
    "gradient-area"
  )
  const a = node(
    "shape",
    {
      fill: red,
      border: null,
      radii: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ]
    },
    "card"
  )
  const group = { id: "component", name: "Editable component", depth: 1 }
  gradient.componentGroups = [group]
  a.componentGroups = [group]
  const result = await writePresentation(
    [{ slideId: "native-svg-gradient", nodes: [gradient, a] }],
    { fonts: mockFonts }
  )
  const zip = await JSZip.loadAsync(result.buffer),
    doc = parseXml(await zip.file("ppt/slides/slide1.xml").async("string"))
  assert.ok(children(doc, NS.a, "gradFill").length)
  assert.ok(children(doc, NS.p, "cNvPr").some(p => p.getAttribute("name") === "Editable component"))
  assert.equal(children(doc, NS.p, "pic").length, 0)
  assert.equal(result.objectMap.length, 2)
  // Noncontiguous ownership must not change the original paint order.
  const between = node(
    "shape",
    {
      fill: blue,
      border: null,
      radii: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ]
    },
    "unrelated"
  )
  const separated = await writePresentation(
    [{ slideId: "separated", nodes: [gradient, between, a] }],
    { fonts: mockFonts }
  )
  const separatedZip = await JSZip.loadAsync(separated.buffer),
    separatedDoc = parseXml(await separatedZip.file("ppt/slides/slide1.xml").async("string"))
  assert.equal(
    children(separatedDoc, NS.p, "cNvPr").some(
      p => p.getAttribute("name") === "Editable component"
    ),
    false
  )
})
