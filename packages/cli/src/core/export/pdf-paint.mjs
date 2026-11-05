import { makeSubtreePreview } from "./measure.mjs"
import { nativeDotPattern } from "./svg-pattern.mjs"

let restore
const rootAt = index =>
  index instanceof Element ? index : document.querySelectorAll(".pdf-slide")[index]
const targetIn = (root, id) =>
  [...root.querySelectorAll("[data-ps-pptx-object]")].find(
    element => element.getAttribute("data-ps-pptx-object") === id
  )

// Some PDF viewers misrender repeating SVG pattern tiles under a mask. Reuse
// the bounded native dot admission and write ordinary SVG circles instead.
export function normalizeDotPatterns(index) {
  const root = rootAt(index)
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  const context = canvas.getContext("2d", { willReadFrequently: true })
  const color = value => {
    if (!CSS.supports("color", value)) return null
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    return {
      hex: [r, g, b]
        .map(v => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase(),
      alpha: a / 255
    }
  }
  const converted = []
  for (const element of root.querySelectorAll("svg rect")) {
    const style = getComputedStyle(element)
    if (
      style.display === "none" ||
      style.visibility !== "visible" ||
      style.transform !== "none" ||
      style.rotate !== "none" ||
      style.scale !== "none" ||
      style.translate !== "none" ||
      !element.getClientRects().length
    )
      continue
    const dots = []
    if (
      !nativeDotPattern(element, {
        style: target => getComputedStyle(target),
        color,
        emit: (_, kind, payload, box) => dots.push({ kind, payload, box }),
        issue: () => {},
        rootBox: { x: 0, y: 0 },
        opacity: 1
      })
    )
      continue
    const matrix = element.getScreenCTM()
    const inverse = matrix.inverse()
    const scale = Math.hypot(matrix.a, matrix.b)
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
    group.setAttribute("data-ps-pdf-dot-grid", "vector")
    group.setAttribute("opacity", style.opacity)
    for (const dot of dots) {
      const screenX = dot.box.x + dot.box.width / 2
      const screenY = dot.box.y + dot.box.height / 2
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
      circle.setAttribute("cx", inverse.a * screenX + inverse.c * screenY + inverse.e)
      circle.setAttribute("cy", inverse.b * screenX + inverse.d * screenY + inverse.f)
      circle.setAttribute("r", dot.box.width / (2 * scale))
      circle.style.setProperty("fill", `#${dot.payload.fill.hex}`, "important")
      circle.style.setProperty("fill-opacity", String(dot.payload.fill.alpha), "important")
      circle.style.setProperty("stroke", "none", "important")
      group.appendChild(circle)
    }
    element.replaceWith(group)
    converted.push({ dots: dots.length })
  }
  return converted
}

function stablePaintAncestors(element, root) {
  for (
    let parent = element.parentElement;
    parent && root.contains(parent);
    parent = parent.parentElement
  ) {
    const css = getComputedStyle(parent)
    if (
      css.transform !== "none" ||
      css.rotate !== "none" ||
      css.scale !== "none" ||
      css.translate !== "none" ||
      Number(css.opacity) !== 1 ||
      !["normal", "1"].includes(css.zoom) ||
      css.filter !== "none" ||
      css.backdropFilter !== "none" ||
      css.mixBlendMode !== "normal" ||
      css.maskImage !== "none" ||
      css.clipPath !== "none"
    )
      return false
  }
  return true
}

export function gradientTextTargets(index) {
  const root = rootAt(index)
  const candidates = [...root.querySelectorAll("*")].filter(element => {
    const css = getComputedStyle(element)
    return (
      !element.hasAttribute("data-ps-pdf-text-paint") &&
      element.getClientRects().length &&
      css.visibility === "visible" &&
      /text/.test(css.backgroundClip) &&
      /gradient\(/.test(css.backgroundImage) &&
      css.mixBlendMode === "normal" &&
      css.filter === "none" &&
      stablePaintAncestors(element, root) &&
      element.textContent.trim()
    )
  })
  return candidates
    .filter(element => !candidates.some(other => other !== element && other.contains(element)))
    .map((element, position) => {
      const id = element.getAttribute("data-ps-pptx-object") || `pdf-gradient-text-${position}`
      element.setAttribute("data-ps-pptx-object", id)
      return { id, text: element.textContent }
    })
}

export function isolateGradientText(index, id) {
  restore?.()
  restore = makeSubtreePreview(rootAt(index), { payload: { elementId: id } })
}

export function restoreGradientText() {
  restore?.()
  restore = undefined
}

export async function cropTextPaint(data, scale) {
  const image = new Image()
  image.src = data
  await image.decode()
  const canvas = document.createElement("canvas")
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  context.drawImage(image, 0, 0)
  const rgba = context.getImageData(0, 0, image.width, image.height).data
  let left = image.width,
    top = image.height,
    right = -1,
    bottom = -1
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++)
      if (rgba[(y * image.width + x) * 4 + 3]) {
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
  if (right < left) return null
  const result = document.createElement("canvas")
  result.width = right - left + 1
  result.height = bottom - top + 1
  result
    .getContext("2d")
    .drawImage(canvas, left, top, result.width, result.height, 0, 0, result.width, result.height)
  return {
    data: result.toDataURL("image/png"),
    x: left / scale,
    y: top / scale,
    width: result.width / scale,
    height: result.height / scale
  }
}

export async function replaceGradientText(index, id, paint) {
  const root = rootAt(index),
    element = targetIn(root, id)
  if (!element || !paint) return
  // Keep ordinary, almost transparent text for selection/search. Removing its
  // gradient clip avoids PDFKit/Poppler text-mask artifacts in the first place.
  for (const target of [element, ...element.querySelectorAll("*")]) {
    target.style.setProperty("background-image", "none", "important")
    target.style.setProperty("background-clip", "border-box", "important")
    target.style.setProperty("-webkit-background-clip", "border-box", "important")
    target.style.setProperty("color", "black", "important")
    target.style.setProperty("-webkit-text-fill-color", "black", "important")
  }
  // Below one 8-bit alpha unit Chromium drops the text operators entirely.
  element.style.setProperty("opacity", "0.01", "important")
  element.setAttribute("data-ps-pdf-text-paint", "graphic")
  const sourceStyle = getComputedStyle(element)
  const image = document.createElement("img")
  image.src = paint.data
  image.alt = ""
  image.setAttribute("aria-hidden", "true")
  image.setAttribute("data-ps-pdf-gradient-graphic", id)
  Object.assign(image.style, {
    position: "absolute",
    left: "0px",
    top: "0px",
    width: `${paint.width}px`,
    height: `${paint.height}px`,
    pointerEvents: "none",
    zIndex: sourceStyle.zIndex
  })
  // Stay in the source's stacking context, so later foreground objects still
  // occlude the glyphs. Admission excludes transformed/faded ancestors.
  element.insertAdjacentElement("afterend", image)
  await image.decode()
  const bounds = image.getBoundingClientRect()
  image.style.left = `${paint.x - bounds.x}px`
  image.style.top = `${paint.y - bounds.y}px`
}
