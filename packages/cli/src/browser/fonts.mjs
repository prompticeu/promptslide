import { splitCss } from "../core/export/measure.mjs"
import { FontResolver, decodeFont, fontInfo } from "../utils/pptx/font-core.mjs"
import { assetBytes, dataUrl } from "./assets.mjs"

const clean = family =>
  String(family || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase()

/** Load only this slide's declared font families; cache bytes across later slides. */
export async function browserFonts(
  root,
  { sources = [], families = [], signal, onIssue, policy, state } = {}
) {
  const wanted = new Set(families.flatMap(family => splitCss(family).map(clean)))
  for (const element of [root, ...root.querySelectorAll("*")]) {
    if (element !== root && !element.getClientRects().length && !element.closest("svg defs"))
      continue
    const style = getComputedStyle(element)
    if (style.display === "none" || style.visibility !== "visible") continue
    for (const family of splitCss(style.fontFamily)) wanted.add(clean(family))
    if (!(element instanceof SVGElement))
      for (const pseudo of ["::before", "::after"]) {
        const computed = getComputedStyle(element, pseudo)
        if (computed.content && !["none", "normal"].includes(computed.content))
          for (const family of splitCss(computed.fontFamily)) wanted.add(clean(family))
      }
  }
  const faces = sources.filter(face => wanted.has(clean(face.family)))
  const sheets = state?.sheets || new Map(),
    visited = new Set()
  async function css(text, base) {
    for (const [, body] of text.matchAll(/@font-face\s*\{([^}]+)\}/gi)) {
      const parsed = new CSSStyleSheet()
      parsed.replaceSync(`@font-face{${body}}`)
      const declaration = parsed.cssRules[0]?.style
      const property = name => declaration?.getPropertyValue(name).trim()
      const family = property("font-family")?.replace(/^['"]|['"]$/g, "")
      if (!family || !wanted.has(clean(family))) continue
      const urls = [
        ...(property("src") || "").matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/gi)
      ].map(match => new URL(match[1] || match[2] || match[3], base).href)
      if (urls.length)
        faces.push({
          family,
          urls,
          style: property("font-style"),
          weight: parseInt(property("font-weight")) || 400,
          weightRange: property("font-weight"),
          unicodeRange: property("unicode-range")
        })
    }
    for (const [, quoted, bare] of text.matchAll(
      /@import\s+(?:url\(\s*)?(?:["']([^"']+)["']|([^\s);]+))\s*\)?[^;]*;/gi
    ))
      await stylesheet(new URL(quoted || bare, base).href)
  }
  async function stylesheet(url) {
    if (visited.has(url)) return
    visited.add(url)
    if (!sheets.has(url)) {
      if (sheets.size >= 30) throw new Error("LIMIT_EXCEEDED: font stylesheets")
      sheets.set(
        url,
        assetBytes(url, { signal, maxBytes: 2 * 1024 * 1024 }).then(({ bytes }) => bytes.toString())
      )
    }
    try {
      await css(await sheets.get(url), url)
    } catch (error) {
      if (signal?.aborted || String(error.message).startsWith("LIMIT_")) throw error
    }
  }
  for (const sheet of document.styleSheets) {
    try {
      await css(
        [...sheet.cssRules].map(rule => rule.cssText).join("\n"),
        sheet.href || document.baseURI
      )
    } catch (error) {
      if (signal?.aborted || String(error.message).startsWith("LIMIT_")) throw error
      if (sheet.href) await stylesheet(sheet.href)
    }
  }
  const assets = state?.assets || [],
    embeddedCss = state?.embeddedCss || []
  const loaded = state?.loaded || new Map(),
    attempts = state?.attempts || new Map()
  const declarations = state?.declarations || new Set(),
    warned = state?.warned || new Set(),
    assetKeys = state?.assetKeys || new Set()
  let total = state?.total || 0
  for (const face of faces) {
    signal?.throwIfAborted()
    const urls = face.urls || [face.url || face.path].filter(Boolean)
    let asset, selected
    for (const url of urls) {
      if (loaded.has(url)) {
        asset = loaded.get(url)
        selected = url
        break
      }
      if ((attempts.get(url) || 0) >= 2) continue
      if (!attempts.has(url) && attempts.size >= 80) throw new Error("LIMIT_EXCEEDED: font faces")
      attempts.set(url, (attempts.get(url) || 0) + 1)
      try {
        const { bytes, type } = await assetBytes(url, { signal })
        const decoded = await decodeFont(bytes)
        total += Math.max(bytes.length, decoded.length)
        if (total > 50 * 1024 * 1024) throw new Error("LIMIT_EXCEEDED: fonts")
        asset = { bytes: decoded, info: fontInfo(decoded), data: dataUrl(bytes, type) }
        loaded.set(url, asset)
        selected = url
        break
      } catch (error) {
        if (signal?.aborted || String(error.message).startsWith("LIMIT_")) throw error
      }
    }
    const key = JSON.stringify([
      clean(face.family),
      face.style,
      face.weightRange || face.weight,
      face.unicodeRange,
      selected || urls
    ])
    if (!asset) {
      if (!warned.has(key)) {
        warned.add(key)
        onIssue?.({
          code: "FONT_UNAVAILABLE",
          severity: "warning",
          message: `Font bytes for ${face.family} could not be loaded; native text requires the recipient's installed font.`
        })
      }
      continue
    }
    if (declarations.has(key)) continue
    if (declarations.size >= 512) throw new Error("LIMIT_EXCEEDED: font declarations")
    declarations.add(key)
    const assetKey = JSON.stringify([clean(face.family), selected])
    if (!assetKeys.has(assetKey)) {
      assetKeys.add(assetKey)
      assets.push({ ...face, bytes: asset.bytes, info: asset.info })
    }
    embeddedCss.push(
      `@font-face{font-family:${JSON.stringify(face.family)};font-style:${face.style || "normal"};font-weight:${face.weightRange || face.weight || 400};${face.unicodeRange ? "unicode-range:" + face.unicodeRange + ";" : ""}src:url("${asset.data}")}`
    )
  }
  return {
    fonts: state?.fonts || new FontResolver({ assets, policy, onIssue }),
    css: embeddedCss.join("\n"),
    assets,
    embeddedCss,
    loaded,
    attempts,
    declarations,
    warned,
    assetKeys,
    sheets,
    total
  }
}
