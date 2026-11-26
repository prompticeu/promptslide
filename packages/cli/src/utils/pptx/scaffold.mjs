import { Buffer } from "buffer"

import path from "path-browserify"
const posix = { ...path, relative: (from, to) => path.relative("/" + from, "/" + to) }

async function canonicalizeChartParts(zip) {
  const chartParts = Object.keys(zip.files)
    .filter(name => /^ppt\/charts\/chart\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/chart(\d+)/)[1]) - Number(b.match(/chart(\d+)/)[1]))
  const names = new Map()
  for (const [index, part] of chartParts.entries()) {
    names.set(part, `ppt/charts/chart${index + 1}.xml`)
    const relationsPart = posix.join(posix.dirname(part), "_rels", posix.basename(part) + ".rels")
    names.set(relationsPart, `ppt/charts/_rels/chart${index + 1}.xml.rels`)
    const rels = parseXml(await zip.file(relationsPart).async("string"))
    for (const rel of children(rels, NS.rel, "Relationship"))
      if (rel.getAttribute("Type").endsWith("/package"))
        names.set(
          posix.normalize(posix.join(posix.dirname(part), rel.getAttribute("Target"))),
          `ppt/embeddings/chart-data-${index + 1}.xlsx`
        )
  }
  if (!names.size) return
  const parts = []
  for (const name of Object.keys(zip.files).filter(n => !zip.files[n].dir)) {
    let bytes = await zip.file(name).async("uint8array")
    if (name.endsWith(".rels")) {
      const doc = parseXml(new TextDecoder().decode(bytes))
      const originalBase =
        name === "_rels/.rels"
          ? ""
          : posix.dirname(
              posix.join(posix.dirname(posix.dirname(name)), posix.basename(name, ".rels"))
            )
      const nextName = names.get(name) || name
      const nextBase =
        nextName === "_rels/.rels"
          ? ""
          : posix.dirname(
              posix.join(posix.dirname(posix.dirname(nextName)), posix.basename(nextName, ".rels"))
            )
      for (const rel of children(doc, NS.rel, "Relationship")) {
        if (rel.getAttribute("TargetMode") === "External") continue
        const target = rel.getAttribute("Target"),
          resolved = target.startsWith("/")
            ? target.slice(1)
            : posix.normalize(posix.join(originalBase, target))
        if (names.has(resolved))
          rel.setAttribute(
            "Target",
            target.startsWith("/")
              ? "/" + names.get(resolved)
              : posix.relative(nextBase, names.get(resolved))
          )
      }
      bytes = Buffer.from(serialize(doc))
    } else if (name === "[Content_Types].xml") {
      const doc = parseXml(new TextDecoder().decode(bytes))
      for (const type of children(doc, NS.ct, "Override"))
        if (names.has(type.getAttribute("PartName").slice(1)))
          type.setAttribute("PartName", "/" + names.get(type.getAttribute("PartName").slice(1)))
      bytes = Buffer.from(serialize(doc))
    }
    parts.push([names.get(name) || name, bytes])
  }
  for (const name of Object.keys(zip.files)) zip.remove(name)
  for (const [name, bytes] of parts) zip.file(name, bytes)
}

import JSZip from "jszip"

import { NS, children, parseXml, serialize } from "./xml.mjs"

async function repairWorkbook(zip, chart, part) {
  const external = children(chart, NS.c, "externalData")[0]
  if (!external) return
  const relationPart = posix.join(posix.dirname(part), "_rels", posix.basename(part) + ".rels")
  const relations = parseXml(await zip.file(relationPart).async("string"))
  const relationship = children(relations, NS.rel, "Relationship").find(
    r => r.getAttribute("Id") === external.getAttributeNS(NS.r, "id")
  )
  if (!relationship) throw new Error("Chart workbook relationship missing")
  const workbookPart = posix.normalize(
    posix.join(posix.dirname(part), relationship.getAttribute("Target"))
  )
  const book = await JSZip.loadAsync(await zip.file(workbookPart).async("uint8array"))
  const sheet = parseXml(await book.file("xl/worksheets/sheet1.xml").async("string"))
  const cells = new Map(children(sheet, NS.s, "c").map(cell => [cell.getAttribute("r"), cell]))
  for (const reference of children(chart, NS.c, "numRef")) {
    const formula = children(reference, NS.c, "f")[0]?.textContent || ""
    const range = /^'?Sheet1'?!\$([A-Z]+)\$(\d+):\$\1\$(\d+)$/.exec(formula)
    if (!range) throw new Error("Unsupported generated chart data reference")
    for (const point of children(reference, NS.c, "pt")) {
      const cell = cells.get(range[1] + (Number(range[2]) + Number(point.getAttribute("idx"))))
      const value = children(point, NS.c, "v")[0]?.textContent
      if (!cell || value === undefined || !Number.isFinite(Number(value)))
        throw new Error("Chart workbook lost numeric data")
      let entry = children(cell, NS.s, "v")[0]
      if (!entry) {
        entry = sheet.createElementNS(NS.s, "v")
        cell.appendChild(entry)
      }
      cell.removeAttribute("t")
      entry.textContent = value
    }
  }
  book.file("xl/worksheets/sheet1.xml", serialize(sheet))
  const stable = new JSZip(),
    date = new Date("2000-01-01T00:00:00Z")
  for (const name of Object.keys(book.files).sort()) {
    if (book.files[name].dir) continue
    let bytes = await book.file(name).async("uint8array")
    if (name === "docProps/core.xml") {
      const doc = parseXml(new TextDecoder().decode(bytes))
      for (const local of ["created", "modified"])
        for (const node of children(doc, "http://purl.org/dc/terms/", local))
          node.textContent = "2000-01-01T00:00:00Z"
      bytes = Buffer.from(serialize(doc))
    }
    stable.file(name, bytes, { date, createFolders: false })
  }
  zip.file(workbookPart, await stable.generateAsync({ type: "uint8array", compression: "DEFLATE" }))
}

/** Keep generated notes internally consistent, or omit unused notes entirely. */
async function normalizeNotes(zip, hasNotes) {
  const presentationPart = "ppt/presentation.xml"
  const presentation = parseXml(await zip.file(presentationPart).async("string"))
  const types = parseXml(await zip.file("[Content_Types].xml").async("string"))
  if (!hasNotes) {
    // PptxGenJS emits notes even when no source slide has speaker notes. These
    // generated empty placeholders have no source content to preserve.
    for (const name of Object.keys(zip.files))
      if (/^ppt\/notes(?:Masters|Slides)\//.test(name)) zip.remove(name)
    for (const list of children(presentation, NS.p, "notesMasterIdLst"))
      list.parentNode.removeChild(list)
    for (const part of Object.keys(zip.files).filter(name => name.endsWith(".rels"))) {
      const rels = parseXml(await zip.file(part).async("string"))
      for (const rel of children(rels, NS.rel, "Relationship"))
        if ([NS.r + "/notesMaster", NS.r + "/notesSlide"].includes(rel.getAttribute("Type")))
          rel.parentNode.removeChild(rel)
      zip.file(part, serialize(rels))
    }
    for (const type of children(types, NS.ct, "Override"))
      if (/^\/ppt\/notes(?:Masters|Slides)\//.test(type.getAttribute("PartName")))
        type.parentNode.removeChild(type)
  } else {
    // A dedicated notes theme keeps notes inheritance independent of the slide
    // master, matching the package structure emitted by PowerPoint.
    const themePart = "ppt/theme/theme2.xml"
    zip.file(themePart, await zip.file("ppt/theme/theme1.xml").async("uint8array"))
    const relPart = "ppt/notesMasters/_rels/notesMaster1.xml.rels"
    const rels = parseXml(await zip.file(relPart).async("string"))
    for (const rel of children(rels, NS.rel, "Relationship"))
      if (rel.getAttribute("Type") === NS.r + "/theme")
        rel.setAttribute("Target", "../theme/theme2.xml")
    zip.file(relPart, serialize(rels))
    const type = types.createElementNS(NS.ct, "Override")
    type.setAttribute("PartName", "/" + themePart)
    type.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.theme+xml")
    types.documentElement.appendChild(type)
  }
  zip.file(presentationPart, serialize(presentation))
  zip.file("[Content_Types].xml", serialize(types))
}

/** Normalize the pinned writer's scaffold against the PresentationML sequence. */
export async function normalizeScaffold(zip, { hasNotes = true } = {}) {
  await normalizeNotes(zip, hasNotes)
  await canonicalizeChartParts(zip)
  const presentation = parseXml(await zip.file("ppt/presentation.xml").async("string"))
  const order = [
    "sldMasterIdLst",
    "notesMasterIdLst",
    "handoutMasterIdLst",
    "sldIdLst",
    "sldSz",
    "notesSz",
    "smartTags",
    "embeddedFontLst",
    "custShowLst",
    "photoAlbum",
    "custDataLst",
    "kinsoku",
    "defaultTextStyle",
    "modifyVerifier",
    "extLst"
  ]
  const root = presentation.documentElement
  for (const name of order)
    for (const child of [...root.childNodes])
      if (child.namespaceURI === NS.p && child.localName === name) root.appendChild(child)
  zip.file("ppt/presentation.xml", serialize(presentation))

  // PptxGenJS 4.0.1 adds an unused series-axis ID to its 2D charts. Only
  // references without a corresponding axis definition are surplus.
  for (const part of Object.keys(zip.files).filter(name =>
    /^ppt\/charts\/chart\d+\.xml$/.test(name)
  )) {
    const doc = parseXml(await zip.file(part).async("string"))
    for (const plot of children(doc, NS.c, "plotArea")) {
      const definitions = [...plot.childNodes].filter(
        n => n.namespaceURI === NS.c && ["catAx", "valAx", "dateAx", "serAx"].includes(n.localName)
      )
      const ids = new Set(
        definitions.flatMap(axis => children(axis, NS.c, "axId").map(id => id.getAttribute("val")))
      )
      for (const chart of [...plot.childNodes].filter(
        n => n.namespaceURI === NS.c && n.localName.endsWith("Chart")
      )) {
        for (const id of [...chart.childNodes].filter(
          n => n.namespaceURI === NS.c && n.localName === "axId"
        ))
          if (!ids.has(id.getAttribute("val"))) chart.removeChild(id)
        if (["lineChart", "areaChart"].includes(chart.localName)) {
          if (!children(chart, NS.c, "grouping").length) {
            const grouping = doc.createElementNS(NS.c, "c:grouping")
            grouping.setAttribute("val", "standard")
            chart.insertBefore(grouping, chart.firstChild)
          }
          for (const negative of children(chart, NS.c, "invertIfNegative"))
            negative.parentNode.removeChild(negative)
          for (const series of children(chart, NS.c, "ser")) {
            const marker = [...series.childNodes].find(
              n => n.namespaceURI === NS.c && n.localName === "marker"
            )
            const following = [...series.childNodes].find(
              n =>
                n.namespaceURI === NS.c &&
                ["dPt", "dLbls", "trendline", "errBars", "cat", "val", "smooth", "extLst"].includes(
                  n.localName
                )
            )
            if (marker && following) series.insertBefore(marker, following)
          }
        }
        // Point formatting and markers precede labels/data in each series.
        // The scaffold emits some of them after dLbls, which Office repairs.
        const seriesOrder = [
          "idx",
          "order",
          "tx",
          "spPr",
          "invertIfNegative",
          "pictureOptions",
          "explosion",
          "marker",
          "dPt",
          "dLbls",
          "trendline",
          "errBars",
          "cat",
          "val",
          "xVal",
          "yVal",
          "shape",
          "smooth",
          "extLst"
        ]
        for (const series of children(chart, NS.c, "ser"))
          for (const name of seriesOrder)
            for (const child of [...series.childNodes])
              if (child.namespaceURI === NS.c && child.localName === name) series.appendChild(child)
      }
      for (const axis of definitions.filter(n => n.localName === "valAx"))
        for (const child of [...axis.childNodes])
          if (
            child.namespaceURI === NS.c &&
            ["auto", "lblAlgn", "noMultiLvlLbl", "tickLblSkip", "tickMarkSkip"].includes(
              child.localName
            )
          )
            axis.removeChild(child)
    }
    await repairWorkbook(zip, doc, part)
    zip.file(part, serialize(doc))
  }
}
