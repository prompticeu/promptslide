import JSZip from "jszip"
import pptxgen from "pptxgenjs"

import {
  customGeometry,
  pathXml,
  roundedGeometry,
  gradientXml,
  strokeXml,
  groupXml
} from "./geometry.mjs"
import { DEFAULT_LIMITS, assertNotAborted } from "./options.mjs"
import { radialGradientStrips } from "./radial.mjs"
import { normalizeScaffold } from "./scaffold.mjs"
import {
  NS,
  children,
  parseXml,
  fragment,
  serialize,
  escapeXml,
  colorXml,
  shapeXml,
  validatePackage
} from "./xml.mjs"

const noLine = "<a:ln><a:noFill/></a:ln>"
function safeBox(box) {
  if (
    !box ||
    ["x", "y", "width", "height"].some(k => !Number.isFinite(box[k])) ||
    box.width < 0 ||
    box.height < 0
  )
    throw new Error("Invalid export object bounds")
}
function pictureCrop(node) {
  const { naturalWidth: iw, naturalHeight: ih, fit, position = "50% 50%" } = node.payload,
    { width: w, height: h } = node.box
  if (!iw || !ih || fit === "fill") return { box: node.box, crop: null }
  const sx = node.payload.renderScaleX || 1,
    sy = node.payload.renderScaleY || 1
  const layoutW = w / sx,
    layoutH = h / sy
  const scale =
    fit === "cover"
      ? Math.max(layoutW / iw, layoutH / ih)
      : fit === "none"
        ? 1
        : fit === "scale-down"
          ? Math.min(1, layoutW / iw, layoutH / ih)
          : Math.min(layoutW / iw, layoutH / ih)
  const dw = iw * scale * sx,
    dh = ih * scale * sy
  const axes = position.split(/\s+/)
  const pos = (value, extra, axisScale) =>
    value?.endsWith("%")
      ? (parseFloat(value) / 100) * extra
      : value?.endsWith("px")
        ? parseFloat(value) * axisScale
        : value === "left" || value === "top"
          ? 0
          : value === "right" || value === "bottom"
            ? extra
            : extra / 2
  const dx = pos(axes[0], w - dw, sx),
    dy = pos(axes[1] || axes[0], h - dh, sy)
  const left = Math.max(0, dx),
    top = Math.max(0, dy),
    right = Math.min(w, dx + dw),
    bottom = Math.min(h, dy + dh)
  const width = Math.max(0, right - left),
    height = Math.max(0, bottom - top)
  const cx = (left + right) / 2 - w / 2,
    cy = (top + bottom) / 2 - h / 2,
    angle = ((node.payload.rotate || 0) * Math.PI) / 180,
    fx = node.payload.flipH ? -cx : cx
  const centerX = node.box.x + w / 2 + Math.cos(angle) * fx - Math.sin(angle) * cy,
    centerY = node.box.y + h / 2 + Math.sin(angle) * fx + Math.cos(angle) * cy
  const crop = {
    l: Math.max(0, (left - dx) / dw),
    t: Math.max(0, (top - dy) / dh),
    r: Math.max(0, (dx + dw - right) / dw),
    b: Math.max(0, (dy + dh - bottom) / dh)
  }
  return {
    box: { x: centerX - width / 2, y: centerY - height / 2, width, height },
    crop: Object.values(crop).some(value => value > 1e-8) ? crop : null,
    empty: !width || !height
  }
}
function validateChart(data) {
  if (
    !["bar", "column", "line", "area", "pie", "doughnut", "scatter"].includes(data.type) ||
    !Array.isArray(data.series) ||
    !data.series.length ||
    data.series.length > 100
  )
    throw new Error("Invalid native chart definition")
  for (const s of data.series)
    if (
      typeof s.name !== "string" ||
      !Array.isArray(s.labels) ||
      !Array.isArray(s.values) ||
      !s.values.length ||
      s.values.length > 10000 ||
      s.labels.length !== s.values.length ||
      s.labels.some(l => typeof l !== "string") ||
      s.values.some(v => !Number.isFinite(v))
    )
      throw new Error("Invalid native chart series")
  if (
    data.series.reduce((sum, series) => sum + series.values.length, 0) > DEFAULT_LIMITS.chartPoints
  )
    throw new Error("LIMIT_EXCEEDED: chart data points")
  for (const color of [
    ...(data.colors || []),
    data.textColor,
    data.gridColor,
    data.background?.hex
  ].filter(Boolean))
    if (!/^[0-9a-f]{6}$/i.test(color)) throw new Error("Invalid native chart color")
  if (
    data.fontSize !== undefined &&
    (!Number.isFinite(data.fontSize) || data.fontSize <= 0 || data.fontSize > 200)
  )
    throw new Error("Invalid chart font size")
  if (data.legendPosition && !["top", "right", "bottom", "left"].includes(data.legendPosition))
    throw new Error("Invalid chart legend position")
  for (const value of Object.values(data.valueAxis || {}))
    if (!Number.isFinite(value)) throw new Error("Invalid chart axis value")
  if (data.valueAxis?.majorUnit !== undefined && data.valueAxis.majorUnit <= 0)
    throw new Error("Invalid chart axis major unit")
  if (
    data.valueAxis?.min !== undefined &&
    data.valueAxis?.max !== undefined &&
    data.valueAxis.min >= data.valueAxis.max
  )
    throw new Error("Invalid chart axis range")
  if (data.plotArea) {
    const { x, y, width, height } = data.plotArea
    if (
      [x, y, width, height].some(v => !Number.isFinite(v)) ||
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0 ||
      x + width > 1 ||
      y + height > 1
    )
      throw new Error("Invalid chart plot area")
  }
  for (const [value, min, max] of [
    [data.gapSizePercent, 0, 500],
    [data.overlapPercent, -100, 100]
  ])
    if (value !== undefined && (!Number.isFinite(value) || value < min || value > max))
      throw new Error("Invalid chart bar spacing")
  if (
    data.type === "scatter" &&
    data.series.some(series =>
      series.labels.some(label => !label.trim() || !Number.isFinite(Number(label)))
    )
  )
    throw new Error("Scatter chart labels must be numeric x values")
  if (["pie", "doughnut"].includes(data.type) && data.series.length !== 1)
    throw new Error("Circular charts require one series")
  if (
    data.series.some(
      series => JSON.stringify(series.labels) !== JSON.stringify(data.series[0].labels)
    )
  )
    throw new Error("Chart series must share category/x values")
}
function timingXml(entries) {
  if (!entries.length) return ""
  let serial = 2
  const steps = [...new Set(entries.map(e => e.step))].sort((a, b) => a - b)
  const groups = steps
    .map(step => {
      const outer = ++serial,
        inner = ++serial
      const effects = entries
        .filter(e => e.step === step)
        .map(e => {
          const effectId = ++serial,
            setId = ++serial,
            animationId = ++serial
          const target = `<p:tgtEl><p:spTgt spid="${e.id}"/></p:tgtEl>`
          const behavior = `<p:cBhvr><p:cTn id="${animationId}" dur="350" fill="hold"/>${target}</p:cBhvr>`
          let animation = `<p:animEffect transition="in" filter="fade">${behavior}</p:animEffect>`
          if (e.animation.startsWith("slide-")) {
            const offsets = {
              "slide-up": [0, 0.05],
              "slide-down": [0, -0.05],
              "slide-left": [0.05, 0],
              "slide-right": [-0.05, 0]
            }
            const [x, y] = offsets[e.animation]
            animation += `<p:animMotion origin="layout" path="M ${x} ${y} L 0 0 E" pathEditMode="relative"><p:cBhvr><p:cTn id="${++serial}" dur="350" fill="hold"/>${target}</p:cBhvr></p:animMotion>`
          } else if (e.animation === "scale")
            animation += `<p:animScale><p:cBhvr><p:cTn id="${++serial}" dur="350" fill="hold"/>${target}</p:cBhvr><p:from x="80000" y="80000"/><p:to x="100000" y="100000"/></p:animScale>`
          return `<p:par><p:cTn id="${effectId}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" nodeType="${entries.find(candidate => candidate.step === step)?.id === e.id ? "clickEffect" : "withEffect"}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="${setId}" dur="1" fill="hold"/><p:tgtEl><p:spTgt spid="${e.id}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>${animation}</p:childTnLst></p:cTn></p:par>`
        })
        .join("")
      return `<p:par><p:cTn id="${outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${inner}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`
    })
    .join("")
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${groups}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
}

/** Native writer. Only unsupported objects arrive here as measured image fallbacks. */
export async function writePresentation(
  frames,
  {
    fonts,
    theme = {},
    buildMode = "final",
    signal,
    onProgress = () => {},
    outputType = "nodebuffer"
  } = {}
) {
  const deck = new pptxgen()
  deck.defineLayout({ name: "PROMPTSLIDE", width: 1280 / 96, height: 720 / 96 })
  deck.layout = "PROMPTSLIDE"
  deck.author = "PromptSlide"
  deck.subject = "Editable presentation exported from PromptSlide"
  deck.title = theme.name || "Presentation"
  deck.company = theme.name || ""
  deck.theme = {
    headFontFace: theme.fonts?.heading || "Arial",
    bodyFontFace: theme.fonts?.body || "Arial",
    lang: "en-US"
  }
  const native = []
  for (let index = 0; index < frames.length; index++) {
    assertNotAborted(signal)
    const frame = frames[index],
      slide = deck.addSlide()
    slide.name = (frame.title || frame.slideId).slice(0, 255)
    slide.background = { color: "000000" }
    if (frame.notes) slide.addNotes(frame.notes)
    const replacements = []
    for (let n = 0; n < frame.nodes.length; n++) {
      const node = frame.nodes[n]
      safeBox(node.box)
      const objectName = `ps:${n}:${node.id}`
      const common = {
        x: node.box.x / 96,
        y: node.box.y / 96,
        w: Math.max(0.0001, node.box.width / 96),
        h: Math.max(0.0001, node.box.height / 96),
        objectName,
        altText: node.altText
      }
      if (node.kind === "picture" || node.kind === "fallback") {
        if (!node.payload.data) throw new Error(`Missing picture data: ${node.id}`)
        const crop = node.kind === "picture" ? pictureCrop(node) : { box: node.box, crop: null }
        slide.addImage({
          ...common,
          x: crop.box.x / 96,
          y: crop.box.y / 96,
          w: Math.max(0.0001, crop.box.width / 96),
          h: Math.max(0.0001, crop.box.height / 96),
          data: node.payload.data,
          transparency: crop.empty ? 100 : Math.round((1 - (node.opacity ?? 1)) * 100),
          rotate: node.payload.rotate || 0,
          flipH: !!node.payload.flipH
        })
        replacements.push({ objectName, node, picture: true, crop: crop.crop })
      } else if (node.kind === "chart") {
        validateChart(node.payload)
        const data = node.payload,
          type = data.type === "column" ? "bar" : data.type
        const face = await fonts.resolve(
          {
            family: data.fontFamily || theme.fonts?.body || "Arial",
            size: data.fontSize || 16,
            weight: 400,
            style: "normal"
          },
          node.actualFonts || [],
          node.source,
          [
            data.title || "",
            "0123456789.-",
            ...data.series.flatMap(series => [
              series.name,
              ...series.labels,
              ...series.values.map(String)
            ])
          ].join(" ")
        )
        if (face.coverageComplete === false)
          fonts.onIssue?.({
            code: "CHART_FONT_DEPENDENCY",
            severity: "warning",
            source: node.source,
            message:
              "Chart labels require the complete original font to be installed; the available subset files cannot cover every label."
          })
        const chartSeries = data.series.map(series => ({
          name: series.name,
          labels: [...series.labels],
          values: [...series.values]
        }))
        if (type === "scatter")
          chartSeries.unshift({
            name: "X",
            labels: [...data.series[0].labels],
            values: data.series[0].labels.map(Number)
          })
        const palette = data.colors?.length
          ? data.colors
          : ["4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"]
        slide.addChart(type, chartSeries, {
          ...common,
          catAxisLabelFontFace: face.family,
          valAxisLabelFontFace: face.family,
          legendFontFace: face.family,
          dataLabelFormatCode: "General",
          dataLabelColor: data.textColor,
          dataLabelFontFace: face.family,
          catAxisLabelFontSize: (data.fontSize || 16) * 0.75,
          valAxisLabelFontSize: (data.fontSize || 16) * 0.75,
          legendFontSize: (data.fontSize || 16) * 0.75,
          catAxisLabelColor: data.textColor,
          valAxisLabelColor: data.textColor,
          legendColor: data.textColor,
          chartArea: {
            roundedCorners: false,
            ...(data.background?.alpha > 0
              ? {
                  fill: {
                    color: data.background.hex,
                    transparency: Math.round((1 - data.background.alpha) * 100)
                  }
                }
              : {})
          },
          legendPos: { top: "t", right: "r", bottom: "b", left: "l" }[data.legendPosition] || "b",
          valAxisMinVal: data.valueAxis?.min,
          valAxisMaxVal: data.valueAxis?.max,
          valAxisMajorUnit: data.valueAxis?.majorUnit,
          valGridLine: data.gridColor ? { color: data.gridColor, width: 1 } : undefined,
          layout: data.plotArea
            ? {
                x: data.plotArea.x,
                y: data.plotArea.y,
                w: data.plotArea.width,
                h: data.plotArea.height
              }
            : undefined,
          barGapWidthPct: data.gapSizePercent,
          barOverlapPct: data.overlapPercent,
          chartColors: Array.from(
            { length: Math.max(palette.length, chartSeries.length) },
            (_, colorIndex) => palette[colorIndex % palette.length]
          ),
          showLegend: data.showLegend ?? false,
          showValue: data.showValue ?? false,
          showTitle: !!data.title,
          title: data.title,
          barDir: data.type === "bar" ? "bar" : "col",
          showCatName: false
        })
        replacements.push({ objectName, node, existing: true })
      } else if (node.kind === "table") {
        const rows = node.payload.rows
        if (
          !Array.isArray(rows) ||
          !rows.length ||
          rows.length > 1000 ||
          rows.some(r => !Array.isArray(r) || !r.length)
        )
          throw new Error("Invalid native table")
        if (rows.reduce((sum, row) => sum + row.length, 0) > DEFAULT_LIMITS.tableCells)
          throw new Error("LIMIT_EXCEEDED: table cells")
        for (const row of rows)
          for (const cell of row) {
            const cellFont = {
              family: cell.family || "Arial",
              size: cell.fontSize || 16,
              weight: cell.bold ? 700 : 400,
              style: cell.italic ? "italic" : "normal"
            }
            cell.fontParts ||= fonts.resolveText
              ? await fonts.resolveText(cellFont, cell.actualFonts || [], node.source, cell.text)
              : [
                  {
                    text: cell.text,
                    resolved: await fonts.resolve(
                      cellFont,
                      cell.actualFonts || [],
                      node.source,
                      cell.text
                    )
                  }
                ]
            cell.resolvedFamily = cell.fontParts[0]?.resolved.family
          }
        const data = rows.map(row =>
          row.map(c => ({
            text:
              c.fontParts?.length > 1
                ? c.fontParts.map(part => ({
                    text: part.text,
                    options: {
                      fontFace: part.resolved.family,
                      bold: part.resolved.bold,
                      italic: part.resolved.italic
                    }
                  }))
                : c.text,
            options: {
              colspan: c.colSpan,
              rowspan: c.rowSpan,
              color: c.color?.hex || "000000",
              fill: c.fill?.alpha ? c.fill.hex : undefined,
              fontSize: (c.fontSize || 16) * 0.75,
              fontFace: c.resolvedFamily || c.family?.split(",")[0].replace(/['"]/g, "") || "Arial",
              bold: c.bold,
              italic: c.italic,
              align: ["left", "center", "right", "justify"].includes(c.align) ? c.align : "left",
              valign:
                c.verticalAlign === "top"
                  ? "top"
                  : c.verticalAlign === "bottom"
                    ? "bottom"
                    : "middle",
              margin: c.padding?.map(p => p * 0.75) || 0,
              border: c.borders?.map(b =>
                b.width && b.style !== "none"
                  ? {
                      type: b.style === "dashed" ? "dash" : b.style === "dotted" ? "dot" : "solid",
                      pt: b.width * 0.75,
                      color: b.color?.hex || "000000"
                    }
                  : { type: "none" }
              )
            }
          }))
        )
        const boundaries = [
          ...new Set(
            rows
              .flat()
              .filter(c => Number.isFinite(c.box?.x))
              .flatMap(c => [
                Math.round(c.box.x * 100) / 100,
                Math.round((c.box.x + c.box.width) * 100) / 100
              ])
          )
        ].sort((a, b) => a - b)
        const widths =
          boundaries.length > 1
            ? boundaries.slice(1).map((v, columnIndex) => (v - boundaries[columnIndex]) / 96)
            : rows[0].map(c => c.box?.width / 96 || common.w / rows[0].length)
        slide.addTable(data, {
          ...common,
          colW: widths,
          rowH: rows.map(
            (row, rowIndex) =>
              (node.payload.rowHeights?.[rowIndex] ??
                Math.max(...row.map(c => (c.box?.height || 20) / (c.rowSpan || 1)))) / 96
          ),
          autoPage: false,
          margin: 0,
          border: { type: "none" }
        })
        replacements.push({ objectName, node, existing: true })
      } else {
        slide.addShape("rect", {
          ...common,
          fill: { color: "FFFFFF", transparency: 100 },
          line: { color: "000000", transparency: 100 }
        })
        replacements.push({ objectName, node })
      }
    }
    native.push(replacements)
    onProgress({ phase: "converting", completed: index + 1, total: frames.length })
    if (outputType === "uint8array") await new Promise(resolve => setTimeout(resolve, 0))
  }
  assertNotAborted(signal)
  const zip = await JSZip.loadAsync(await deck.write({ outputType: "uint8array" }))
  await normalizeScaffold(zip, { hasNotes: frames.some(frame => Boolean(frame.notes?.trim())) })
  const objectMap = []
  for (let i = 0; i < frames.length; i++) {
    assertNotAborted(signal)
    const part = `ppt/slides/slide${i + 1}.xml`,
      doc = parseXml(await zip.file(part).async("string")),
      tree = children(doc, NS.p, "spTree")[0]
    let nextId = 1_000_000
    const relationPart = `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      relDoc = parseXml(await zip.file(relationPart).async("string"))
    const animations = []
    // A native reveal targets the top-level owner. Only group objects that
    // share one reveal; mixed/static owners must keep their independent timing.
    const retargetGroup = (members, groupId) => {
      if (buildMode !== "native") return true
      const ids = members.map(member =>
        Number(children(member, NS.p, "cNvPr")[0].getAttribute("id"))
      )
      const effects = animations.filter(effect => ids.includes(effect.id))
      if (!effects.length) return true
      if (
        effects.length !== members.length ||
        effects.some(
          effect => effect.step !== effects[0].step || effect.animation !== effects[0].animation
        )
      )
        return false
      for (let index = animations.length - 1; index >= 0; index--)
        if (ids.includes(animations[index].id)) animations.splice(index, 1)
      animations.push({ ...effects[0], id: groupId })
      return true
    }
    // Chart/table scaffolding can reuse non-visual IDs. No timings/connectors
    // reference these yet, so assign a unique stable slide-local sequence now.
    children(tree, NS.p, "cNvPr").forEach((property, index) =>
      property.setAttribute("id", String(index + 1))
    )
    const addLink = (url, source) => {
      if (!url) return ""
      let target = url,
        action = "",
        type = "hyperlink",
        external = true
      if (url.startsWith("#")) {
        const id = decodeURIComponent(url.slice(1)),
          targetIndex = frames.findIndex(f => f.slideId === id)
        if (targetIndex < 0) return ""
        target = `slide${targetIndex + 1}.xml`
        action = ' action="ppaction://hlinksldjump"'
        type = "slide"
        external = false
      } else if (!/^(https?:|mailto:|tel:)/i.test(url)) return ""
      const rid = `rIdLink${nextId++}`
      const rel = relDoc.createElementNS(NS.rel, "Relationship")
      rel.setAttribute("Id", rid)
      rel.setAttribute("Type", NS.r + "/" + type)
      rel.setAttribute("Target", target)
      if (external) rel.setAttribute("TargetMode", "External")
      relDoc.documentElement.appendChild(rel)
      return `<a:hlinkClick r:id="${rid}"${action} tooltip="${escapeXml(source || url)}"/>`
    }
    const svgGroups = new Map()
    const componentGroups = new Map()
    const nodeObjectIds = new Set()
    for (const { objectName, node, picture, crop, existing } of native[i]) {
      const prop = children(tree, NS.p, "cNvPr").find(p => p.getAttribute("name") === objectName)
      if (!prop) throw new Error(`Writer lost object: ${node.id}`)
      const placeholder = prop.parentNode.parentNode
      const ids = []
      if (picture || existing) {
        prop.setAttribute("name", node.name || node.id)
        prop.setAttribute("descr", node.altText || "")
        ids.push(Number(prop.getAttribute("id")))
        if (picture && node.payload.svgData) {
          const asset = `image-vector-${i}-${nextId++}.svg`,
            rid = `rIdSvg${nextId++}`
          zip.file("ppt/media/" + asset, node.payload.svgData)
          const relation = relDoc.createElementNS(NS.rel, "Relationship")
          relation.setAttribute("Id", rid)
          relation.setAttribute("Type", NS.r + "/image")
          relation.setAttribute("Target", "../media/" + asset)
          relDoc.documentElement.appendChild(relation)
          const blip = children(placeholder, NS.a, "blip")[0]
          blip.appendChild(
            fragment(
              doc,
              `<a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${rid}"/></a:ext></a:extLst>`
            )
          )
        }
        if (picture && crop) {
          const blipFill = children(placeholder, NS.p, "blipFill")[0],
            rect = doc.createElementNS(NS.a, "a:srcRect")
          for (const [key, value] of Object.entries(crop))
            rect.setAttribute(key, Math.round(Math.min(0.99999, value) * 100000))
          blipFill.insertBefore(rect, children(blipFill, NS.a, "stretch")[0] || null)
        }
        if (picture && node.payload.radius?.some(r => r > 0)) {
          const spPr = children(placeholder, NS.p, "spPr")[0],
            geom = children(spPr, NS.a, "prstGeom")[0]
          const [rx, ry] = node.payload.radius
          spPr.replaceChild(
            fragment(
              doc,
              roundedGeometry(
                node.box.width,
                node.box.height,
                Array.from({ length: 4 }, () => [rx, ry])
              )
            ),
            geom
          )
        }
        const link = addLink(node.hyperlink)
        if (link) prop.appendChild(fragment(doc, link))
      } else {
        let xml = "",
          id = nextId++
        ids.push(id)
        if (node.kind === "shape" && node.payload.fill?.kind === "elliptical") {
          const parts = radialGradientStrips(
            node.box,
            node.payload.fill,
            node.opacity,
            node.payload.clip
          ).map(strip => {
            const sid = nextId++
            ids.push(sid)
            return shapeXml(
              sid,
              { ...node, box: strip.box },
              '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
              gradientXml(strip.fill) + noLine
            )
          })
          xml = groupXml(
            id,
            node.name || "Elliptical gradient",
            parts.join(""),
            node.box,
            node.altText
          )
        } else if (node.kind === "shape") {
          const border = node.payload.border,
            inset = border?.width / 2 || 0
          const adjusted = {
            ...node,
            box: {
              x: node.box.x + inset,
              y: node.box.y + inset,
              width: Math.max(0, node.box.width - inset * 2),
              height: Math.max(0, node.box.height - inset * 2)
            }
          }
          const radii = node.payload.radii || Array.from({ length: 4 }, () => [0, 0])
          const geometry = roundedGeometry(
            adjusted.box.width,
            adjusted.box.height,
            radii.map(([x, y]) => [Math.max(0, x - inset), Math.max(0, y - inset)])
          )
          const fill = node.payload.fill?.stops
            ? gradientXml(node.payload.fill, node.opacity)
            : colorXml(node.payload.fill, node.opacity)
          xml = shapeXml(id, adjusted, geometry, fill + strokeXml(border, node.opacity))
        } else if (node.kind === "paths") {
          const parts = node.payload.paths.map(path => {
            const geometry = customGeometry(
              [
                {
                  commands: pathXml(path.d, path.matrix, DEFAULT_LIMITS.pathSegments),
                  fill: !!path.fill,
                  stroke: !!path.stroke
                }
              ],
              node.box.width,
              node.box.height
            )
            const pid = nextId++
            ids.push(pid)
            return shapeXml(
              pid,
              node,
              geometry,
              (path.fill?.stops
                ? gradientXml(path.fill, node.opacity * path.fillOpacity)
                : colorXml(path.fill, node.opacity * path.fillOpacity)) +
                strokeXml(
                  {
                    width: path.strokeWidth,
                    color: path.stroke,
                    cap: path.cap,
                    join: path.join,
                    dashValues: path.dashValues
                  },
                  node.opacity * path.strokeOpacity
                )
            )
          })
          xml = groupXml(id, node.name || node.id, parts.join(""), node.box, node.altText)
        } else if (node.kind === "text") {
          const parts = []
          const lineBoxes = []
          for (const [lineIndex, line] of node.payload.lines.entries()) {
            let maxSize = 0
            const runs = []
            for (const run of line.runs) {
              const f = run.font
              const fontParts =
                run.fontParts ||
                (fonts.resolveText
                  ? await fonts.resolveText(f, node.actualFonts || [], node.source, run.text)
                  : [
                      {
                        text: run.text,
                        resolved: await fonts.resolve(
                          f,
                          node.actualFonts || [],
                          node.source,
                          run.text
                        )
                      }
                    ])
              const renderSize = f.size * (f.renderScale || 1)
              maxSize = Math.max(maxSize, renderSize)
              const underline = f.decoration.includes("underline") ? ' u="sng"' : ""
              const strike = f.decoration.includes("line-through") ? ' strike="sngStrike"' : ""
              for (const fontPart of fontParts) {
                const resolved = fontPart.resolved
                runs.push(
                  `<a:r><a:rPr lang="${escapeXml(f.language)}" sz="${Math.round(renderSize * 75)}"${resolved.bold ? ' b="1"' : ""}${resolved.italic ? ' i="1"' : ""}${underline}${strike} spc="${Math.round(f.letterSpacing * (f.renderScale || 1) * 75)}" kern="0">${f.fill ? gradientXml(f.fill, node.opacity * (f.opacity ?? 1)) : colorXml(f.color, node.opacity * (f.opacity ?? 1))}<a:latin typeface="${escapeXml(resolved.family)}"/><a:ea typeface="${escapeXml(resolved.family)}"/><a:cs typeface="${escapeXml(resolved.family)}"/>${addLink(run.hyperlink || node.hyperlink)}</a:rPr><a:t xml:space="preserve">${escapeXml(fontPart.text)}</a:t></a:r>`
                )
              }
            }
            const tid = nextId++
            ids.push(tid)
            // Anchor each line to its measured browser baseline. The text body's
            // first em supplies the native baseline; CSS leading is not reapplied.
            const lnNode = {
              ...node,
              box: {
                x: line.x,
                y: Number.isFinite(line.baseline) ? line.baseline - maxSize : line.y,
                width: Math.max(line.width + 2, 1),
                height: Math.max(line.height, maxSize)
              },
              payload: { rotate: line.rotate || 0 }
            }
            const bullet = lineIndex === 0 && node.payload.bullet
            const numbering = {
              decimal: "arabicPeriod",
              "lower-alpha": "alphaLcPeriod",
              "upper-alpha": "alphaUcPeriod",
              "lower-roman": "romanLcPeriod",
              "upper-roman": "romanUcPeriod"
            }
            const marker = !bullet
              ? "<a:buNone/>"
              : numbering[bullet.type]
                ? `<a:buSzPct val="100000"/><a:buAutoNum type="${numbering[bullet.type]}" startAt="${Math.max(1, Math.min(32767, bullet.start || 1))}"/>`
                : `<a:buSzPct val="100000"/><a:buChar char="${bullet.type === "circle" ? "◦" : bullet.type === "square" ? "▪" : "•"}"/>`
            if (bullet) {
              lnNode.box.x -= maxSize
              lnNode.box.width += maxSize
            }
            lineBoxes.push(lnNode.box)
            const body = `<p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="l" fontAlgn="base"${bullet ? ` marL="${Math.round(maxSize * 9525)}" indent="${-Math.round(maxSize * 9525)}"` : ""}><a:lnSpc><a:spcPct val="100000"/></a:lnSpc>${marker}</a:pPr>${runs.join("")}<a:endParaRPr sz="${Math.round(maxSize * 75)}"/></a:p></p:txBody>`
            const textShape = shapeXml(
              tid,
              lnNode,
              '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
              "<a:noFill/>" + noLine,
              body
            )
            parts.push(textShape)
          }
          const x = Math.min(...lineBoxes.map(b => b.x)),
            y = Math.min(...lineBoxes.map(b => b.y))
          const groupBox = {
            x,
            y,
            width: Math.max(...lineBoxes.map(b => b.x + b.width)) - x,
            height: Math.max(...lineBoxes.map(b => b.y + b.height)) - y
          }
          xml = groupXml(id, node.name || node.id, parts.join(""), groupBox, node.altText)
        } else throw new Error(`Unsupported scene node: ${node.kind}`)
        const replacement = fragment(doc, xml)
        const link = node.kind !== "text" ? addLink(node.hyperlink) : ""
        if (link) children(replacement, NS.p, "cNvPr")[0].appendChild(fragment(doc, link))
        tree.replaceChild(replacement, placeholder)
      }
      if (node.svgGroup) {
        if (!svgGroups.has(node.svgGroup))
          svgGroups.set(node.svgGroup, { ids: [], boxes: [], name: node.svgGroupName })
        const group = svgGroups.get(node.svgGroup)
        group.ids.push(ids[0])
        group.boxes.push(node.box)
      }
      nodeObjectIds.add(ids[0])
      for (const component of node.componentGroups || []) {
        if (!componentGroups.has(component.id))
          componentGroups.set(component.id, { ...component, ids: [], boxes: [] })
        const group = componentGroups.get(component.id)
        group.ids.push(ids[0])
        group.boxes.push(node.box)
      }
      objectMap.push({
        slide: i + 1,
        source: node.source,
        objectIds: ids,
        representation:
          node.kind === "fallback"
            ? "raster"
            : node.payload.approximation || node.payload.fill?.stops?.some(s => s.color.alpha < 1)
              ? "native-approximation"
              : "native"
      })
      if (buildMode === "native" && node.buildStep > 0)
        animations.push({ id: ids[0], step: node.buildStep, animation: node.animation })
    }
    for (const { ids, boxes, name } of svgGroups.values()) {
      if (ids.length < 2) continue
      const members = Array.from(tree.childNodes).filter(child => {
        const prop = child.nodeType === 1 && children(child, NS.p, "cNvPr")[0]
        return prop && ids.includes(Number(prop.getAttribute("id")))
      })
      if (members.length !== ids.length) throw new Error("SVG group lost a native member")
      const x = Math.min(...boxes.map(b => b.x)),
        y = Math.min(...boxes.map(b => b.y))
      const box = {
        x,
        y,
        width: Math.max(...boxes.map(b => b.x + b.width)) - x,
        height: Math.max(...boxes.map(b => b.y + b.height)) - y
      }
      if (!retargetGroup(members, nextId)) continue
      const wrapper = fragment(doc, groupXml(nextId++, name, "", box))
      tree.insertBefore(wrapper, members[0])
      for (const member of members) wrapper.appendChild(member)
    }
    // Wrap only complete, contiguous owners. In particular, preserve SVG groups
    // and refuse a grouping that would absorb another component or change paint order.
    for (const { ids, boxes, name } of [...componentGroups.values()].sort(
      (a, b) => b.depth - a.depth
    )) {
      const selected = new Set(ids)
      const entries = Array.from(tree.childNodes)
        .filter(child => child.nodeType === 1)
        .map((child, index) => ({
          child,
          index,
          ids: children(child, NS.p, "cNvPr")
            .map(prop => Number(prop.getAttribute("id")))
            .filter(id => nodeObjectIds.has(id))
        }))
      const owners = entries.filter(entry => entry.ids.some(id => selected.has(id)))
      if (
        owners.length < 2 ||
        owners.some(entry => entry.ids.some(id => !selected.has(id))) ||
        owners.some((entry, index) => index && entry.index !== owners[index - 1].index + 1) ||
        ids.some(id => !owners.some(entry => entry.ids.includes(id)))
      )
        continue
      const x = Math.min(...boxes.map(b => b.x)),
        y = Math.min(...boxes.map(b => b.y)),
        box = {
          x,
          y,
          width: Math.max(...boxes.map(b => b.x + b.width)) - x,
          height: Math.max(...boxes.map(b => b.y + b.height)) - y
        }
      if (
        !retargetGroup(
          owners.map(owner => owner.child),
          nextId
        )
      )
        continue
      const wrapper = fragment(doc, groupXml(nextId++, name, "", box))
      tree.insertBefore(wrapper, owners[0].child)
      for (const owner of owners) wrapper.appendChild(owner.child)
    }
    if (buildMode === "native" && animations.length)
      doc.documentElement.appendChild(fragment(doc, timingXml(animations)))
    zip.file(part, serialize(doc))
    zip.file(relationPart, serialize(relDoc))
  }
  await fonts.write(zip)
  // PptxGenJS 4.0.1 declares one slideMaster override per slide even though
  // only the single master part is generated. Remove only those known surplus
  // declarations; unknown missing parts remain hard validation failures.
  {
    const types = parseXml(await zip.file("[Content_Types].xml").async("string"))
    for (const node of children(types, NS.ct, "Override")) {
      const part = node.getAttribute("PartName")
      const match = /^\/ppt\/slideMasters\/slideMaster(\d+)\.xml$/.exec(part)
      if (match && Number(match[1]) > 1 && !zip.file(part.slice(1)))
        node.parentNode.removeChild(node)
    }
    zip.file("[Content_Types].xml", serialize(types))
  }
  if (frames.some(frame => frame.nodes.some(node => node.payload.svgData))) {
    const types = parseXml(await zip.file("[Content_Types].xml").async("string"))
    if (!children(types, NS.ct, "Default").some(n => n.getAttribute("Extension") === "svg")) {
      const n = types.createElementNS(NS.ct, "Default")
      n.setAttribute("Extension", "svg")
      n.setAttribute("ContentType", "image/svg+xml")
      types.documentElement.appendChild(n)
    }
    zip.file("[Content_Types].xml", serialize(types))
  }
  // Normalize metadata/ZIP timestamps and ordering for stable output from an identical snapshot.
  for (const part of ["docProps/core.xml"]) {
    const doc = parseXml(await zip.file(part).async("string"))
    for (const local of ["created", "modified"])
      for (const n of children(doc, "http://purl.org/dc/terms/", local))
        n.textContent = "2000-01-01T00:00:00Z"
    zip.file(part, serialize(doc))
  }
  await validatePackage(zip)
  const normalized = new JSZip()
  for (const name of Object.keys(zip.files).sort())
    if (!zip.files[name].dir)
      normalized.file(name, await zip.file(name).async("uint8array"), {
        date: new Date("2000-01-01T00:00:00Z"),
        createFolders: false
      })
  const buffer = await normalized.generateAsync(
    {
      type: outputType,
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    },
    () => assertNotAborted(signal)
  )
  if (buffer.length > DEFAULT_LIMITS.outputBytes)
    throw new Error("LIMIT_EXCEEDED: PowerPoint output size")
  return {
    buffer,
    objectMap,
    fonts: [...fonts.embedded.values()].map(({ bytes: _bytes, ...f }) => f)
  }
}
