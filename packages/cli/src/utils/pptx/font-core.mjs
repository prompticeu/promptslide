import { Buffer } from "buffer"

import { sha256 } from "@noble/hashes/sha256"
import { unzlibSync } from "fflate"
import { Blob, Face, Font } from "harfbuzzjs"
import decompress from "wawoff2/decompress.js"

import { NS, children, fragment, parseXml, serialize, escapeXml } from "./xml.mjs"

const MAX_FONT = 50 * 1024 * 1024
export const fontKey = font =>
  JSON.stringify([font.family, font.weight, font.style, font.size, font.variation || "normal"])
const clean = name => name.toLowerCase().replace(/[\s'"_-]/g, "")
const hash = bytes =>
  Buffer.from(sha256(typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes)).toString(
    "hex"
  )
export function sfntTables(bytes, faceIndex = 0) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes)
  let base = 0
  if (bytes.toString("ascii", 0, 4) === "ttcf") {
    const count = bytes.readUInt32BE(8)
    if (faceIndex >= count || count > 100) throw new Error("Invalid font collection")
    base = bytes.readUInt32BE(12 + faceIndex * 4)
  }
  if (base + 12 > bytes.length) throw new Error("Invalid font header")
  const signature = bytes.readUInt32BE(base),
    count = bytes.readUInt16BE(base + 4)
  if (
    ![0x00010000, 0x4f54544f, 0x74727565].includes(signature) ||
    count > 200 ||
    base + 12 + count * 16 > bytes.length
  )
    throw new Error("Unsupported or invalid sfnt font")
  const tables = new Map()
  for (let i = 0; i < count; i++) {
    const at = base + 12 + i * 16,
      tag = bytes.toString("ascii", at, at + 4),
      offset = bytes.readUInt32BE(at + 8),
      length = bytes.readUInt32BE(at + 12)
    if (offset + length > bytes.length || tables.has(tag))
      throw new Error("Invalid font table directory")
    tables.set(tag, Buffer.from(bytes.subarray(offset, offset + length)))
  }
  return { signature, tables }
}
function checksum(buffer) {
  const padded = Buffer.alloc(Math.ceil(buffer.length / 4) * 4)
  buffer.copy(padded)
  let sum = 0
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0
  return sum
}
export function buildSfnt({ signature, tables }) {
  // sfnt directories require binary tag order; locale collation sorts capitals
  // differently and makes strict font importers reject a reconstructed instance.
  const ordered = [...tables].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const count = ordered.length,
    power = 2 ** Math.floor(Math.log2(count))
  const header = Buffer.alloc(12 + count * 16)
  header.writeUInt32BE(signature)
  header.writeUInt16BE(count, 4)
  header.writeUInt16BE(power * 16, 6)
  header.writeUInt16BE(Math.log2(power), 8)
  header.writeUInt16BE(count * 16 - power * 16, 10)
  const data = [],
    offsets = new Map()
  let offset = header.length
  ordered.forEach(([tag, original], i) => {
    const bytes = Buffer.from(original)
    if (tag === "head") bytes.writeUInt32BE(0, 8)
    const at = 12 + i * 16,
      padding = Buffer.alloc(Math.ceil(bytes.length / 4) * 4)
    bytes.copy(padding)
    header.write(tag, at, 4, "ascii")
    header.writeUInt32BE(checksum(bytes), at + 4)
    header.writeUInt32BE(offset, at + 8)
    header.writeUInt32BE(bytes.length, at + 12)
    offsets.set(tag, offset)
    offset += padding.length
    data.push(padding)
  })
  const result = Buffer.concat([header, ...data])
  if (offsets.has("head"))
    result.writeUInt32BE((0xb1b0afba - checksum(result)) >>> 0, offsets.get("head") + 8)
  return result
}
function names(table) {
  const result = []
  if (!table || table.length < 6) return result
  const count = table.readUInt16BE(2),
    start = table.readUInt16BE(4)
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12
    if (at + 12 > table.length) throw new Error("Invalid font name table")
    const platformId = table.readUInt16BE(at),
      encoding = table.readUInt16BE(at + 2),
      language = table.readUInt16BE(at + 4),
      id = table.readUInt16BE(at + 6),
      size = table.readUInt16BE(at + 8),
      offset = start + table.readUInt16BE(at + 10)
    if (offset + size > table.length) throw new Error("Invalid font name data")
    const bytes = Buffer.from(table.subarray(offset, offset + size))
    const value =
      platformId === 0 || platformId === 3
        ? bytes.swap16().toString("utf16le")
        : bytes.toString("latin1")
    result.push({ platformId, encoding, language, id, value })
  }
  return result
}
export function fontInfo(bytes) {
  const sfnt = sfntTables(bytes),
    os2 = sfnt.tables.get("OS/2"),
    head = sfnt.tables.get("head"),
    hhea = sfnt.tables.get("hhea"),
    records = names(sfnt.tables.get("name"))
  if (!os2 || os2.length < 78 || !head || !hhea)
    throw new Error("Font lacks required embedding/metrics tables")
  const name = id =>
    records.find(r => r.id === id && r.platformId === 3 && r.language === 0x409)?.value ||
    records.find(r => r.id === id)?.value ||
    ""
  const fvar = sfnt.tables.get("fvar"),
    axes = {}
  if (fvar) {
    const offset = fvar.readUInt16BE(4),
      axisCount = fvar.readUInt16BE(8),
      axisSize = fvar.readUInt16BE(10)
    if (axisCount > 64 || axisSize < 20 || offset + axisCount * axisSize > fvar.length)
      throw new Error("Invalid variation axes")
    for (let i = 0; i < axisCount; i++) {
      const at = offset + i * axisSize
      axes[fvar.toString("ascii", at, at + 4)] = {
        min: fvar.readInt32BE(at + 4) / 65536,
        default: fvar.readInt32BE(at + 8) / 65536,
        max: fvar.readInt32BE(at + 12) / 65536
      }
    }
  }
  return {
    ...sfnt,
    family: name(16) || name(1),
    legacyFamily: name(1),
    style: name(17) || name(2),
    fullName: name(4),
    postscript: name(6),
    names: records,
    fsType: os2.readUInt16BE(8),
    weight: os2.readUInt16BE(4),
    italic: !!(os2.readUInt16BE(62) & 1),
    unitsPerEm: head.readUInt16BE(18),
    ascender: hhea.readInt16BE(4),
    descender: hhea.readInt16BE(6),
    axes
  }
}
export async function decodeFont(input) {
  let bytes = Buffer.from(input)
  if (bytes.length > MAX_FONT) throw new Error("Font exceeds asset size limit")
  const signature = bytes.toString("ascii", 0, 4)
  if (
    ["wOF2", "wOFF"].includes(signature) &&
    (bytes.length < 44 || bytes.readUInt32BE(16) > MAX_FONT)
  )
    throw new Error("Decoded font exceeds asset size limit")
  if (signature === "wOF2") bytes = Buffer.from(await decompress(bytes))
  else if (signature === "wOFF") {
    if (bytes.length < 44) throw new Error("Invalid WOFF")
    const tables = new Map(),
      count = bytes.readUInt16BE(12)
    if (count > 200) throw new Error("Invalid WOFF table count")
    for (let i = 0; i < count; i++) {
      const at = 44 + 20 * i,
        tag = bytes.toString("ascii", at, at + 4),
        offset = bytes.readUInt32BE(at + 4),
        compressed = bytes.readUInt32BE(at + 8),
        length = bytes.readUInt32BE(at + 12)
      if (length > MAX_FONT || offset + compressed > bytes.length)
        throw new Error("Invalid WOFF table")
      const data = bytes.subarray(offset, offset + compressed)
      tables.set(
        tag,
        compressed < length ? unzlibSync(data, { out: new Uint8Array(length) }) : Buffer.from(data)
      )
    }
    bytes = buildSfnt({ signature: bytes.readUInt32BE(4), tables })
  } else if (signature === "ttcf") bytes = buildSfnt(sfntTables(bytes))
  if (bytes.length > MAX_FONT) throw new Error("Decoded font exceeds asset size limit")
  fontInfo(bytes)
  return bytes
}

export function renameFont(bytes, family, bold, italic) {
  const sfnt = sfntTables(bytes),
    records = names(sfnt.tables.get("name")),
    strings = [],
    directories = Buffer.alloc(6 + records.length * 12)
  directories.writeUInt16BE(0)
  directories.writeUInt16BE(records.length, 2)
  directories.writeUInt16BE(directories.length, 4)
  let offset = 0
  const faceStyle = bold && italic ? "Bold Italic" : bold ? "Bold" : italic ? "Italic" : "Regular"
  records.forEach((r, i) => {
    let value = r.value
    if ([1, 16].includes(r.id)) value = family
    if ([2, 17].includes(r.id)) value = faceStyle
    if (r.id === 4) value = `${family} ${faceStyle}`
    if (r.id === 6) value = (family + "-" + faceStyle).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 63)
    const data =
      r.platformId === 0 || r.platformId === 3
        ? Buffer.from(value, "utf16le").swap16()
        : Buffer.from(value, "latin1")
    const at = 6 + i * 12
    for (const [n, v] of [
      r.platformId,
      r.encoding,
      r.language,
      r.id,
      data.length,
      offset
    ].entries())
      directories.writeUInt16BE(v, at + n * 2)
    offset += data.length
    strings.push(data)
  })
  sfnt.tables.set("name", Buffer.concat([directories, ...strings]))
  // HarfBuzz pins outlines/weight but may retain the variable default's
  // Regular style flags. Office indexes embedded faces using these flags.
  const os2 = sfnt.tables.get("OS/2"),
    head = sfnt.tables.get("head")
  if (os2?.length >= 64)
    os2.writeUInt16BE(
      (os2.readUInt16BE(62) & ~(1 | 32 | 64)) |
        (italic ? 1 : 0) |
        (bold ? 32 : 0) |
        (!bold && !italic ? 64 : 0),
      62
    )
  if (head?.length >= 46)
    head.writeUInt16BE((head.readUInt16BE(44) & ~3) | (bold ? 1 : 0) | (italic ? 2 : 0), 44)
  return buildSfnt(sfnt)
}

/** EOT v1 wrapper around a byte-identical sfnt, without glyph/font reconstruction. */
export function fontToEot(bytes) {
  const info = fontInfo(bytes)
  if (info.signature !== 0x00010000 && info.signature !== 0x74727565)
    throw new Error("CFF/OpenType embedding is not supported by this PowerPoint profile")
  if (info.fsType & (0x0002 | 0x0004 | 0x0200))
    throw new Error("Font license does not permit portable editable outline embedding")
  const os2 = info.tables.get("OS/2"),
    head = info.tables.get("head")
  const header = Buffer.alloc(82)
  header.writeUInt32LE(bytes.length, 4)
  header.writeUInt32LE(0x00010000, 8)
  os2.copy(header, 16, 32, 42)
  header[26] = 1
  header[27] = info.italic ? 1 : 0
  header.writeUInt32LE(info.weight, 28)
  header.writeUInt16LE(info.fsType, 32)
  header.writeUInt16LE(0x504c, 34)
  for (let i = 0; i < 4; i++) header.writeUInt32LE(os2.readUInt32BE(42 + i * 4), 36 + i * 4)
  if (os2.length >= 86) {
    header.writeUInt32LE(os2.readUInt32BE(78), 52)
    header.writeUInt32LE(os2.readUInt32BE(82), 56)
  }
  header.writeUInt32LE(head.readUInt32BE(8), 60)
  const text = [
    info.family,
    info.style,
    info.names.find(r => r.id === 5)?.value || "Version 1",
    info.fullName || info.family
  ]
  const parts = [header]
  for (const [index, name] of text.entries()) {
    const data = Buffer.from(name, "utf16le"),
      size = Buffer.alloc(2)
    size.writeUInt16LE(data.length)
    // EOT v1 has separators between names, but no padding after FullName.
    // A trailing separator makes strict EOT decoders reject the entire font.
    parts.push(size, data)
    if (index < text.length - 1) parts.push(Buffer.alloc(2))
  }
  const prefix = Buffer.concat(parts)
  prefix.writeUInt32LE(prefix.length + bytes.length)
  return Buffer.concat([prefix, bytes])
}

export class FontResolver {
  constructor({
    assets = [],
    configured = [],
    policy = "embed-when-permitted",
    onIssue = () => {},
    readFile = async () => {
      throw new Error("Font bytes unavailable")
    },
    systemFonts = async () => []
  } = {}) {
    this.readFile = readFile
    this.systemFonts = systemFonts
    this.assets = assets
    this.configured = configured
    this.policy = policy
    this.onIssue = onIssue
    this.resolved = new Map()
    this.embedded = new Map()
    this.outlineFonts = new Map()
    this.materialized = new Map()
  }
  async covers(candidate, text) {
    if (!text) return true
    if (!candidate.bytes) candidate.bytes = await decodeFont(await this.readFile(candidate.path))
    if (!candidate.coverageFont)
      candidate.coverageFont = new Font(new Face(new Blob(candidate.bytes)))
    return Array.from(text).every(character => {
      const code = character.codePointAt(0)
      // Shaping controls do not require their own nominal visible glyph.
      if (code < 32 || /\p{Default_Ignorable_Code_Point}/u.test(character)) return true
      return !!candidate.coverageFont.nominalGlyph(code)
    })
  }
  async resolveText(font, actualFonts, source, text) {
    const whole = await this.resolve(font, actualFonts, source, text)
    if (whole.coverageComplete !== false) return [{ text, resolved: whole }]
    const parts = []
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      text
    )) {
      const resolved = await this.resolve(font, actualFonts, source, segment, true)
      if (resolved.coverageComplete === false)
        throw new Error(
          "FONT_GLYPH_COVERAGE: available font faces cannot preserve this text cluster"
        )
      const previous = parts.at(-1)
      if (
        previous &&
        previous.resolved.family === resolved.family &&
        previous.resolved.hash === resolved.hash
      )
        previous.text += segment
      else parts.push({ text: segment, resolved })
    }
    this.onIssue({
      code: "FONT_SUBSETS_RETAINED",
      severity: "info",
      source,
      message: "Text uses distinct embedded font subsets to preserve all visible glyphs."
    })
    return parts
  }
  async resolve(font, actualFonts = [], source, text = "", includeFallbacks = false) {
    const key =
      fontKey(font) +
      JSON.stringify(actualFonts.map(f => [f.familyName, f.postScriptName]).sort()) +
      hash(text) +
      `:${this.assets.length}:${this.configured.length}:${includeFallbacks}`
    if (this.resolved.has(key)) return this.resolved.get(key)
    const requested = font.family.split(",").map(s => s.trim().replace(/^['"]|['"]$/g, ""))
    const families = [...new Set(actualFonts.map(f => f.familyName))]
    const actual = families.length === 1 ? families[0] : null
    const matches = aliases =>
      (actual && aliases.includes(clean(actual))) ||
      requested.some(name => aliases.includes(clean(name))) ||
      (includeFallbacks && families.some(name => aliases.includes(clean(name))))
    const candidates = []
    for (const asset of [...this.assets, ...this.configured]) {
      try {
        if (!asset.bytes) asset.bytes = await decodeFont(await this.readFile(asset.path))
        if (!asset.info) {
          asset.bytes = await decodeFont(asset.bytes)
          asset.info = fontInfo(asset.bytes)
        }
        const aliases = [
          asset.family,
          asset.info.family,
          asset.info.legacyFamily,
          asset.info.fullName,
          asset.info.postscript
        ]
          .filter(Boolean)
          .map(clean)
        if (matches(aliases)) candidates.push(asset)
      } catch {
        /* A source that cannot be decoded is diagnosed if no valid face resolves. */
      }
    }
    if (
      !candidates.length ||
      includeFallbacks ||
      (actual &&
        !candidates.some(c =>
          [c.info.family, c.info.legacyFamily].map(clean).includes(clean(actual))
        ))
    )
      for (const candidate of await this.systemFonts()) {
        const aliases = [
          candidate.info.family,
          candidate.info.legacyFamily,
          candidate.info.fullName,
          candidate.info.postscript
        ].map(clean)
        if (matches(aliases)) candidates.push({ ...candidate, path: candidate.file })
      }
    const score = candidate =>
      Math.abs((candidate.info.weight || 400) - font.weight) +
      ((font.style === "italic") !== candidate.info.italic ? 1000 : 0) -
      (includeFallbacks &&
      requested.some(name =>
        [candidate.family, candidate.info.family, candidate.info.legacyFamily]
          .filter(Boolean)
          .map(clean)
          .includes(clean(name))
      )
        ? 5000
        : 0) -
      (Object.keys(candidate.info.axes).length ? 2000 : 0) -
      (actual &&
      [candidate.info.family, candidate.info.legacyFamily].map(clean).includes(clean(actual))
        ? 10000
        : 0)
    candidates.sort((a, b) => score(a) - score(b))
    let candidate
    for (const face of candidates)
      if (await this.covers(face, text)) {
        candidate = face
        break
      }
    let result = {
      family: actual || requested[0],
      bold: font.weight >= 600,
      italic: font.style === "italic",
      portable: false
    }
    if (!candidate && candidates.length) {
      result.family = candidates[0].info.family
      result.coverageComplete = false
      this.resolved.set(key, result)
      return result
    }
    result.coverageComplete = candidate ? true : null
    if (families.length > 1)
      this.onIssue({
        code: "MULTIPLE_FONT_FALLBACK",
        severity: "warning",
        source,
        message:
          "The browser used multiple fallback families in one text object; verify complex shaping in PowerPoint."
      })
    if (!candidate) {
      this.onIssue({
        code: "FONT_UNAVAILABLE",
        severity: "warning",
        source,
        message: `Font bytes for ${result.family} could not be resolved; recipient must have the font installed.`
      })
    } else if (this.policy !== "require-installed") {
      try {
        let bytes = candidate.bytes || (await decodeFont(await this.readFile(candidate.path))),
          info = fontInfo(bytes)
        const materialKey = hash(bytes) + fontKey(font)
        if (this.materialized.has(materialKey)) {
          result = { ...this.materialized.get(materialKey), coverageComplete: true }
          this.resolved.set(key, result)
          return result
        }
        if (info.fsType & (2 | 4 | 0x200))
          throw new Error("Font embedding rights do not permit portable editing")
        if (Object.keys(info.axes).length) {
          const axes = Object.fromEntries(
            Object.entries(info.axes).map(([tag, a]) => [
              tag,
              tag === "wght"
                ? Math.max(a.min, Math.min(a.max, font.weight))
                : tag === "ital"
                  ? font.style === "italic"
                    ? 1
                    : 0
                  : tag === "opsz"
                    ? Math.max(a.min, Math.min(a.max, font.size * 0.75))
                    : a.default
            ])
          )
          for (const [, tag, value] of (font.variation || "").matchAll(
            /["'](\w{4})["']\s+([-+.\d]+)/g
          ))
            if (tag in axes) axes[tag] = Number(value)
          const { default: subsetFont } = await import("subset-font")
          const original = info
          bytes = Buffer.from(
            await subsetFont(bytes, null, {
              targetFormat: "sfnt",
              keepAllGlyphs: true,
              variationAxes: axes,
              preserveNameIds: Array.from({ length: 26 }, (_, i) => i),
              glyphNames: true
            })
          )
          info = fontInfo(bytes)
          for (const table of ["GPOS", "GSUB", "GDEF"])
            if (original.tables.has(table) && !info.tables.has(table))
              throw new Error(`Variable font instancing lost ${table}`)
          result.family =
            `${requested[0]} ${Object.entries(axes)
              .map(([k, v]) => `${k}${v}`)
              .join(" ")}`.slice(0, 60) +
            " " +
            hash(bytes).slice(0, 12)
          bytes = renameFont(bytes, result.family, result.bold, result.italic)
          this.onIssue({
            code: "VARIABLE_FONT_INSTANCED",
            severity: "info",
            source,
            message: `${result.family}: variable axes were pinned to a named static face; original glyph coverage and shaping tables are retained.`
          })
        } else {
          result.family = info.family.slice(0, 48) + " PS " + hash(bytes).slice(0, 12)
          bytes = renameFont(bytes, result.family, info.weight >= 600, info.italic)
        }
        const id = hash(bytes)
        const eot = fontToEot(bytes)
        const variant =
          info.weight >= 600 && info.italic
            ? "boldItalic"
            : info.weight >= 600
              ? "bold"
              : info.italic
                ? "italic"
                : "regular"
        this.embedded.set(result.family + ":" + variant, {
          family: result.family,
          variant,
          bytes: eot,
          hash: id,
          sourceHash: hash(candidate.bytes || bytes),
          tables: [...fontInfo(bytes).tables.keys()]
        })
        this.outlineFonts.set(id, bytes)
        result = { ...result, portable: true, hash: id }
        this.materialized.set(materialKey, result)
      } catch (error) {
        this.onIssue({
          code: "FONT_EMBEDDING_RESTRICTED",
          severity: "warning",
          source,
          message: `${result.family}: ${error.message}. Native text retained with an installed-font dependency.`
        })
      }
    }
    if (actual && !requested.map(clean).includes(clean(actual)))
      this.onIssue({
        code: "SOURCE_FONT_FALLBACK",
        severity: "info",
        source,
        message: `Source used ${actual} instead of ${requested[0]}; export preserves the rendered face.`
      })
    this.resolved.set(key, result)
    return result
  }
  async write(zip) {
    if (!this.embedded.size) return
    const doc = parseXml(await zip.file("ppt/presentation.xml").async("string")),
      rels = parseXml(await zip.file("ppt/_rels/presentation.xml.rels").async("string")),
      types = parseXml(await zip.file("[Content_Types].xml").async("string"))
    doc.documentElement.setAttribute("embedTrueTypeFonts", "1")
    doc.documentElement.setAttribute("saveSubsetFonts", "0")
    const usedIds = new Set(children(rels, NS.rel, "Relationship").map(r => r.getAttribute("Id")))
    const families = new Map()
    let index = 0
    for (const font of [...this.embedded.values()].sort((a, b) =>
      (a.family + a.variant).localeCompare(b.family + b.variant)
    )) {
      let id
      do {
        id = `rIdFont${++index}`
      } while (usedIds.has(id))
      const path = `fonts/${font.hash}.fntdata`
      zip.file("ppt/" + path, font.bytes)
      const rel = rels.createElementNS(NS.rel, "Relationship")
      rel.setAttribute("Id", id)
      rel.setAttribute("Target", path)
      rel.setAttribute("Type", NS.r + "/font")
      rels.documentElement.appendChild(rel)
      if (!families.has(font.family)) families.set(font.family, [])
      families.get(font.family).push(`<p:${font.variant} r:id="${id}"/>`)
    }
    const order = ["regular", "bold", "italic", "boldItalic"]
    const list = fragment(
      doc,
      `<p:embeddedFontLst>${[...families].map(([family, variants]) => `<p:embeddedFont><p:font typeface="${escapeXml(family)}"/>${variants.sort((a, b) => order.findIndex(n => a.startsWith("<p:" + n + " ")) - order.findIndex(n => b.startsWith("<p:" + n + " "))).join("")}</p:embeddedFont>`).join("")}</p:embeddedFontLst>`
    )
    const following = [...doc.documentElement.childNodes].find(n =>
      [
        "custShowLst",
        "photoAlbum",
        "custDataLst",
        "kinsoku",
        "defaultTextStyle",
        "modifyVerifier",
        "extLst"
      ].includes(n.localName)
    )
    doc.documentElement.insertBefore(list, following || null)
    if (!children(types, NS.ct, "Default").some(n => n.getAttribute("Extension") === "fntdata")) {
      const n = types.createElementNS(NS.ct, "Default")
      n.setAttribute("Extension", "fntdata")
      n.setAttribute("ContentType", "application/x-fontdata")
      types.documentElement.appendChild(n)
    }
    zip.file("ppt/presentation.xml", serialize(doc))
    zip.file("ppt/_rels/presentation.xml.rels", serialize(rels))
    zip.file("[Content_Types].xml", serialize(types))
  }
}
