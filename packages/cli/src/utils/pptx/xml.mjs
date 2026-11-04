import { DOMParser, XMLSerializer } from "@xmldom/xmldom"

export const NS = Object.freeze({
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  c: "http://schemas.openxmlformats.org/drawingml/2006/chart",
  s: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
  ct: "http://schemas.openxmlformats.org/package/2006/content-types"
})
export const emu = value => {
  if (!Number.isFinite(value) || Math.abs(value) > 1e8)
    throw new Error("Invalid PowerPoint coordinate")
  return Math.round(value * 9525)
}
export const escapeXml = value =>
  String(value ?? "")
    .replace(
      /[<>&"']/g,
      c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]
    )
    .split("")
    .filter(c => c.charCodeAt(0) >= 32 || ["\t", "\n", "\r"].includes(c))
    .join("")
export const children = (node, namespace, local) =>
  Array.from(node.getElementsByTagNameNS(namespace, local))
export function parseXml(xml) {
  return new DOMParser({
    onError: (level, message) => {
      if (level !== "warning") throw new Error(`Invalid PowerPoint XML: ${message}`)
    }
  }).parseFromString(xml, "application/xml")
}
export const serialize = node => new XMLSerializer().serializeToString(node)
export function fragment(doc, xml) {
  const parsed = parseXml(
    `<root xmlns:a="${NS.a}" xmlns:p="${NS.p}" xmlns:r="${NS.r}">${xml}</root>`
  )
  return doc.importNode(parsed.documentElement.firstChild, true)
}
export function colorXml(color, opacity = 1) {
  if (!color || color.alpha === 0) return "<a:noFill/>"
  if (!/^[0-9a-f]{6}$/i.test(color.hex)) throw new Error("Invalid PowerPoint color")
  return `<a:solidFill><a:srgbClr val="${color.hex}"><a:alpha val="${Math.round(Math.max(0, Math.min(1, (color.alpha ?? 1) * opacity)) * 100000)}"/></a:srgbClr></a:solidFill>`
}
export function shapeXml(id, node, geometry, paint, extra = "") {
  const b = node.box,
    rotate = node.payload?.rotate || 0
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(node.name || node.id)}" descr="${escapeXml(node.altText || "")}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm${rotate ? ` rot="${Math.round((((rotate % 360) + 360) % 360) * 60000)}"` : ""}${node.payload?.flipH ? ' flipH="1"' : ""}><a:off x="${emu(b.x)}" y="${emu(b.y)}"/><a:ext cx="${Math.max(1, emu(b.width))}" cy="${Math.max(1, emu(b.height))}"/></a:xfrm>${geometry}${paint}</p:spPr>${extra}</p:sp>`
}

export async function validatePackage(zip) {
  const files = new Set(Object.keys(zip.files))
  const slideThemes = new Set(),
    notesThemes = new Set()
  for (const part of files) {
    if (!/\.(xml|rels)$/.test(part)) continue
    const doc = parseXml(await zip.file(part).async("string"))
    if (part.endsWith(".rels")) {
      const ids = new Set()
      for (const rel of children(doc, NS.rel, "Relationship")) {
        const id = rel.getAttribute("Id")
        if (ids.has(id)) throw new Error(`Duplicate relationship ID in ${part}`)
        ids.add(id)
        if (rel.getAttribute("TargetMode") === "External") continue
        const target = rel.getAttribute("Target")
        const base = part.slice(0, part.lastIndexOf("/_rels/"))
        const segments = target.startsWith("/") ? [] : part === "_rels/.rels" ? [] : base.split("/")
        for (const segment of target.split("/")) {
          if (segment === "..") segments.pop()
          else if (segment && segment !== ".") segments.push(segment)
        }
        if (rel.getAttribute("Type") === NS.r + "/theme") {
          if (/^ppt\/slideMasters\//.test(part)) slideThemes.add(segments.join("/"))
          if (/^ppt\/notesMasters\//.test(part)) notesThemes.add(segments.join("/"))
        }
        if (!files.has(segments.join("/")))
          throw new Error(`Missing relationship target in ${part}: ${target}`)
      }
    }
    if (/^ppt\/slides\/slide\d+\.xml$/.test(part)) {
      const ids = new Set()
      for (const prop of children(doc, NS.p, "cNvPr")) {
        const id = prop.getAttribute("id")
        if (ids.has(id)) throw new Error(`Duplicate shape ID in ${part}`)
        ids.add(id)
      }
      for (const target of children(doc, NS.p, "spTgt"))
        if (!ids.has(target.getAttribute("spid")))
          throw new Error(`Missing animation target in ${part}`)
    }
    if (part === "[Content_Types].xml")
      for (const over of children(doc, NS.ct, "Override"))
        if (!files.has(over.getAttribute("PartName").replace(/^\//, "")))
          throw new Error(`Dangling content type override: ${over.getAttribute("PartName")}`)
  }
  // Schema validation accepts a shared notes/slide theme. PowerPoint's notes
  // importer needs a dedicated theme, so validate this compatibility invariant.
  for (const theme of notesThemes)
    if (slideThemes.has(theme))
      throw new Error("Notes master must have a dedicated theme part for PowerPoint compatibility")
}
