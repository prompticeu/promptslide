import { assetBytes, dataUrl, imageDimensions } from "./assets.mjs"

const MAX_PIXELS = 50_000_000
let supported
async function checkCapture() {
  if (!supported)
    supported = (async () => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = 2
      const context = canvas.getContext("2d")
      context.drawImage(
        await image(
          "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><foreignObject width="2" height="2"><div xmlns="http://www.w3.org/1999/xhtml" style="width:2px;height:2px;background:red"/></foreignObject></svg>'
            )
        ),
        0,
        0
      )
      if (context.getImageData(0, 0, 1, 1).data[0] !== 255)
        throw new Error(
          "BROWSER_UNSUPPORTED: This browser cannot capture slide effects. Try a current Chromium browser."
        )
    })()
  return supported
}
const image = async src => {
  const img = new Image()
  img.src = src
  await img.decode()
  return img
}

/** Serialize only the export root. Never hide, restyle or copy the visible viewer. */
export async function captureFallback(root, node, { fontCss = "", signal, scale = 2 } = {}) {
  signal?.throwIfAborted()
  await checkCapture()
  const clone = root.cloneNode(true)
  const original = [root, ...root.querySelectorAll("*")]
  const copies = [clone, ...clone.querySelectorAll("*")]
  if (original.length > 100000) throw new Error("LIMIT_EXCEEDED: capture elements")
  const target = original.find(
    e => e.getAttribute("data-ps-pptx-object") === node.payload.elementId
  )
  if (node.payload.scope !== "paint" && !target) throw new Error("Fallback source disappeared")
  const urls = new Map()
  let assetTotal = 0
  async function inline(url) {
    if (!urls.has(url))
      urls.set(
        url,
        assetBytes(url, { signal }).then(({ bytes, type }) => {
          assetTotal += bytes.length
          if (assetTotal > 50 * 1024 * 1024) throw new Error("LIMIT_EXCEEDED: fallback assets")
          return dataUrl(bytes, type)
        })
      )
    return urls.get(url)
  }
  async function styleText(css, resources = true) {
    let value = [...css].map(p => `${p}:${css.getPropertyValue(p)};`).join("")
    // External resources cannot be fetched inside an SVG image document.
    for (const match of [...value.matchAll(/url\("([^"]+)"\)/g)]) {
      const url = match[1]
      if (!resources) {
        value = value.replaceAll(match[0], "none")
        continue
      }
      if (url.startsWith("#")) continue
      const absolute = new URL(url, document.baseURI)
      if (absolute.hash && absolute.href.split("#")[0] === document.URL.split("#")[0])
        value = value.replaceAll(match[0], `url("${absolute.hash}")`)
      else value = value.replaceAll(match[0], `url("${await inline(url)}")`)
    }
    return value
  }
  const definitions = new Set(root.querySelectorAll("svg defs,svg defs *"))
  for (let i = 0; i < original.length; i++) {
    signal?.throwIfAborted()
    const source = original[i],
      copy = copies[i],
      css = getComputedStyle(source)
    const retained =
      node.payload.scope !== "paint" &&
      (source === target || target.contains(source) || definitions.has(source))
    const visible = retained && css.display !== "none" && css.visibility === "visible"
    const ancestor = node.payload.scope !== "paint" && source.contains(target)
    // Hidden siblings retain layout, but must not fetch unrelated resources.
    copy.setAttribute("style", await styleText(css, visible || ancestor || definitions.has(source)))
    copy.style.setProperty("animation", "none", "important")
    copy.style.setProperty("transition", "none", "important")
    if (!retained) copy.style.setProperty("visibility", "hidden", "important")
    if (source instanceof HTMLImageElement) {
      copy.setAttribute("loading", "eager")
      copy.setAttribute(
        "src",
        visible && source.currentSrc
          ? await inline(source.currentSrc)
          : "data:image/svg+xml," +
              encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="${source.naturalWidth || source.width || 1}" height="${source.naturalHeight || source.height || 1}"/>`
              )
      )
    }
    if (source instanceof SVGElement && source.tagName.toLowerCase() === "image") {
      const href =
        source.getAttribute("href") || source.getAttributeNS("http://www.w3.org/1999/xlink", "href")
      if (visible && href && !href.startsWith("#") && !href.startsWith("data:")) {
        const uri = await inline(new URL(href, document.baseURI).href)
        copy.setAttribute("href", uri)
        copy.removeAttributeNS("http://www.w3.org/1999/xlink", "href")
      } else if (!visible) {
        copy.removeAttribute("href")
        copy.removeAttributeNS("http://www.w3.org/1999/xlink", "href")
      }
    }
    copy.removeAttribute("srcset")
    for (const attribute of [...copy.attributes])
      if (/^on/i.test(attribute.name)) copy.removeAttribute(attribute.name)
    if (source instanceof HTMLCanvasElement && visible) {
      if (source.width * source.height > MAX_PIXELS)
        throw new Error("LIMIT_EXCEEDED: source canvas pixels")
      const replacement = document.createElement("img")
      try {
        replacement.src = source.toDataURL()
      } catch {
        throw new Error("ASSET_UNAVAILABLE: Canvas content is blocked by CORS")
      }
      replacement.setAttribute("style", copy.getAttribute("style"))
      copy.replaceWith(replacement)
    }
    if (source instanceof HTMLVideoElement && visible)
      throw new Error("UNSUPPORTED_CONTENT: Export video as a poster image")
    if (visible && !(source instanceof SVGElement))
      for (const pseudo of ["::before", "::after"]) {
        const pseudoCss = getComputedStyle(source, pseudo),
          content = pseudoCss.content
        if (!content || content === "none" || content === "normal") continue
        if (!/^(["']).*\1$/.test(content))
          throw new Error("UNSUPPORTED_CONTENT: Generated content requires a static image")
        const element = document.createElement("span")
        element.textContent = content.slice(1, -1).replace(/\\(["'\\])/g, "$1")
        element.setAttribute("style", await styleText(pseudoCss))
        element.style.visibility = css.visibility
        if (pseudo === "::before") copy.prepend(element)
        else copy.append(element)
      }
  }
  Object.assign(clone.style, {
    position: "relative",
    inset: "auto",
    insetInline: "auto",
    insetBlock: "auto",
    left: "0",
    top: "0",
    width: "1280px",
    height: "720px",
    margin: "0",
    transform: "none"
  })
  clone.querySelectorAll("script,iframe,object,embed,link").forEach(e => e.remove())
  if (node.payload.scope === "paint") {
    const paint = document.createElement("div")
    Object.assign(paint.style, {
      position: "absolute",
      left: `${node.box.x}px`,
      top: `${node.box.y}px`,
      visibility: "visible",
      margin: "0"
    })
    for (const [key, value] of Object.entries(node.payload.cssPaint))
      paint.style.setProperty(key, value)
    // Resolve any background images on the synthesized paint as well.
    paint.setAttribute("style", await styleText(paint.style))
    let parent = clone,
      origin = { x: 0, y: 0 }
    for (const clip of node.payload.clips || []) {
      const wrapper = document.createElement("div")
      Object.assign(wrapper.style, {
        position: "absolute",
        left: `${clip.x - origin.x}px`,
        top: `${clip.y - origin.y}px`,
        width: `${clip.width}px`,
        height: `${clip.height}px`,
        overflow: "hidden",
        borderRadius:
          clip.radii.map(p => p[0] + "px").join(" ") +
          " / " +
          clip.radii.map(p => p[1] + "px").join(" "),
        visibility: "visible"
      })
      parent.appendChild(wrapper)
      parent = wrapper
      origin = clip
    }
    paint.style.left = `${node.box.x - origin.x}px`
    paint.style.top = `${node.box.y - origin.y}px`
    parent.appendChild(paint)
  }
  const style = document.createElement("style")
  style.textContent = fontCss
  clone.prepend(style)
  const markup = new XMLSerializer().serializeToString(clone)
  if (markup.length > 50 * 1024 * 1024) throw new Error("LIMIT_EXCEEDED: fallback markup")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><foreignObject width="1280" height="720">${markup}</foreignObject></svg>`
  const canvas = document.createElement("canvas")
  canvas.width = 1280 * scale
  canvas.height = 720 * scale
  if (canvas.width * canvas.height > MAX_PIXELS) throw new Error("LIMIT_EXCEEDED: fallback pixels")
  const context = canvas.getContext("2d", { willReadFrequently: true })
  context.drawImage(
    await image(dataUrl(new TextEncoder().encode(svg), "image/svg+xml")),
    0,
    0,
    canvas.width,
    canvas.height
  )
  signal?.throwIfAborted()
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let left = canvas.width,
    top = canvas.height,
    right = -1,
    bottom = -1
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++)
      if (pixels[(y * canvas.width + x) * 4 + 3]) {
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
  if (right < left) return null
  const crop = document.createElement("canvas")
  crop.width = right - left + 1
  crop.height = bottom - top + 1
  crop
    .getContext("2d")
    .drawImage(canvas, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return {
    box: {
      x: left / scale,
      y: top / scale,
      width: crop.width / scale,
      height: crop.height / scale
    },
    data: crop.toDataURL()
  }
}

export async function resolvePictures(root, scene, options) {
  const budget = options.mediaBudget || { bytes: 0 }
  const retain = bytes => {
    budget.bytes += bytes
    if (budget.bytes > 50 * 1024 * 1024) throw new Error("LIMIT_EXCEEDED: retained picture bytes")
  }
  const dataSize = value => Math.ceil((value.length - value.indexOf(",") - 1) * 0.75)
  for (const node of [...scene.nodes]) {
    options.signal?.throwIfAborted()
    if (node.kind === "fallback") {
      const capture = await captureFallback(root, node, options)
      if (!capture) scene.nodes.splice(scene.nodes.indexOf(node), 1)
      else {
        node.box = capture.box
        retain(dataSize(capture.data))
        node.payload.data = capture.data
        if (node.payload.scope === "subtree") node.opacity = 1
      }
    } else if (node.kind === "picture") {
      if (node.payload.naturalWidth * node.payload.naturalHeight > MAX_PIXELS)
        throw new Error("LIMIT_EXCEEDED: image pixels")
      const { bytes, type } = await assetBytes(node.payload.url, options)
      const header = imageDimensions(bytes)
      if (header && header.width * header.height > MAX_PIXELS)
        throw new Error("LIMIT_EXCEEDED: decoded picture pixels")
      retain(bytes.length)
      if (!/^image\/(png|jpeg|gif|svg\+xml|webp|avif)/.test(type))
        throw new Error("ASSET_UNAVAILABLE: Unsupported image type")
      const original = dataUrl(bytes, type)
      const decoded = await image(original)
      if (decoded.naturalWidth * decoded.naturalHeight > MAX_PIXELS)
        throw new Error("LIMIT_EXCEEDED: decoded picture pixels")
      node.payload.naturalWidth = decoded.naturalWidth
      node.payload.naturalHeight = decoded.naturalHeight
      if (/png|jpeg|gif/.test(type)) node.payload.data = original
      else {
        const img = decoded,
          canvas = document.createElement("canvas")
        const naturalWidth = node.payload.naturalWidth || img.naturalWidth
        const naturalHeight = node.payload.naturalHeight || img.naturalHeight
        const scale = /svg/.test(type)
          ? Math.max(
              1,
              (node.box.width * options.scale) / naturalWidth,
              (node.box.height * options.scale) / naturalHeight
            )
          : 1
        canvas.width = Math.max(1, Math.ceil(naturalWidth * scale))
        canvas.height = Math.max(1, Math.ceil(naturalHeight * scale))
        if (canvas.width * canvas.height > MAX_PIXELS)
          throw new Error("LIMIT_EXCEEDED: image pixels")
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height)
        const converted = canvas.toDataURL()
        retain(dataSize(converted))
        node.payload.data = converted
        if (
          /svg/.test(type) &&
          !/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:)|url\(\s*["']?https?:/i.test(
            bytes.toString()
          )
        )
          node.payload.svgData = bytes.toString()
      }
    }
  }
}
