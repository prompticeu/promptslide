import { FontResolver, decodeFont } from "../utils/pptx/font-core.mjs"
import { assetBytes, dataUrl } from "./assets.mjs"

export async function browserFonts(root, { sources = [], signal, onIssue, policy, state } = {}) {
  const faces = [...sources]
  const sheets = state?.sheets || new Set()
  async function css(text, base) {
    for (const [, body] of text.matchAll(/@font-face\s*\{([^}]+)\}/gi)) {
      const parsed = new CSSStyleSheet()
      parsed.replaceSync(`@font-face{${body}}`)
      const declaration = parsed.cssRules[0]?.style
      const property = name => declaration?.getPropertyValue(name).trim()
      const family = property("font-family")?.replace(/^['"]|['"]$/g, "")
      if (!family) continue
      const url = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/i.exec(property("src") || "")
      if (url)
        faces.push({
          family,
          url: new URL(url[1] || url[2] || url[3], base).href,
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
    if (sheets.has(url)) return
    sheets.add(url)
    if (sheets.size > 30) throw new Error("LIMIT_EXCEEDED: font stylesheets")
    try {
      const { bytes } = await assetBytes(url, { signal, maxBytes: 2 * 1024 * 1024 })
      await css(bytes.toString(), url)
    } catch (error) {
      if (signal?.aborted || String(error.message).startsWith("LIMIT_")) throw error
    }
  }
  for (const sheet of document.styleSheets) {
    try {
      await css([...sheet.cssRules].map(r => r.cssText).join("\n"), sheet.href || document.baseURI)
    } catch (error) {
      if (signal?.aborted || String(error.message).startsWith("LIMIT_")) throw error
      if (sheet.href) await stylesheet(sheet.href)
    }
  }
  const assets = state?.assets || [],
    embeddedCss = state?.embeddedCss || []
  const seen = state?.seen || new Set()
  let total = state?.total || 0
  for (const face of faces) {
    signal?.throwIfAborted()
    const url = face.url || face.path
    if (!url || seen.has(url)) continue
    seen.add(url)
    if (seen.size > 80) throw new Error("LIMIT_EXCEEDED: font faces")
    try {
      const { bytes, type } = await assetBytes(url, { signal })
      const decoded = await decodeFont(bytes)
      total += Math.max(bytes.length, decoded.length)
      if (total > 50 * 1024 * 1024) throw new Error("LIMIT_EXCEEDED: fonts")
      assets.push({ ...face, bytes: decoded })
      if (face.family)
        embeddedCss.push(
          `@font-face{font-family:${JSON.stringify(face.family)};font-style:${face.style || "normal"};font-weight:${face.weightRange || face.weight || 400};${face.unicodeRange ? "unicode-range:" + face.unicodeRange + ";" : ""}src:url("${dataUrl(bytes, type)}")}`
        )
    } catch (error) {
      if (signal?.aborted || String(error.message).startsWith("LIMIT_")) throw error
      onIssue?.({
        code: "FONT_UNAVAILABLE",
        severity: "warning",
        message:
          "Font bytes could not be loaded; native text requires the recipient's installed font."
      })
    }
  }
  return {
    fonts: state?.fonts || new FontResolver({ assets, policy, onIssue }),
    css: embeddedCss.join("\n"),
    assets,
    embeddedCss,
    seen,
    sheets,
    total
  }
}
