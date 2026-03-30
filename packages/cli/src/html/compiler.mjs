/**
 * HTML-to-React compiler.
 *
 * Takes parsed HTML slide content and generates a React component source string
 * that uses createElement calls (no JSX, avoids needing Babel/SWC transform).
 */

import { parse as parseHTML } from "node-html-parser"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

/**
 * Compile an HTML slide into a React component source string.
 *
 * @param {Object} options
 * @param {string} options.content - Inner HTML of the slide
 * @param {string|null} options.layout - Layout name (data-layout value)
 * @param {string} options.deckRoot - Absolute path to the deck directory
 * @param {string} options.slideName - Slide filename (for component name)
 * @returns {string} React component source code using createElement
 */
export function compileSlide({ content, layout, deckRoot, slideName, slots }) {
  let html = content

  // If a layout is specified, inject content into the layout template
  if (layout) {
    html = applyLayout(html, layout, deckRoot, slots)
  }

  // Ensure the root <section> has h-full so child elements can use
  // vertical centering and height-based utilities properly.
  // The slide container is a fixed 1280x720 box — h-full makes <section> fill it.
  html = ensureSectionHeight(html)

  // Parse the HTML to build a createElement tree
  const root = parseHTML(html, {
    comment: false,
    voidTag: { tags: ["img", "br", "hr", "input", "link", "meta", "area", "base", "col", "embed", "source", "track", "wbr"] }
  })

  // Replace HTML comment slots with placeholders before parsing
  html = html.replace(/<!--\s*slideNumber\s*-->/g, "___SLIDENUM___")
  html = html.replace(/<!--\s*totalSlides\s*-->/g, "___TOTALSLIDES___")

  // Re-parse with placeholders
  const rootWithPlaceholders = parseHTML(html, {
    comment: false,
    voidTag: { tags: ["img", "br", "hr", "input", "link", "meta", "area", "base", "col", "embed", "source", "track", "wbr"] }
  })

  const bodyCode = nodeToCreateElement(rootWithPlaceholders)

  // Determine imports needed
  const needsAnimated = /data-step=|data-animate=/.test(content)
  const needsStagger = /data-stagger=/.test(content)
  const needsMorph = /data-morph=/.test(content)

  const imports = ['import { createElement } from "react"']
  const animImports = []
  if (needsAnimated) animImports.push("Animated")
  if (needsStagger) animImports.push("AnimatedGroup")
  if (animImports.length > 0) {
    imports.push(`import { ${animImports.join(", ")} } from "promptslide"`)
  }
  if (needsMorph) {
    imports.push('import { Morph } from "promptslide"')
  }

  const componentName = toComponentName(slideName)

  return `${imports.join("\n")}

export default function ${componentName}({ slideNumber, totalSlides }) {
  return ${bodyCode}
}

if (import.meta.hot) {
  import.meta.hot.accept()
}
`
}

/**
 * Apply a layout template to slide content.
 *
 * Supports two types of slots:
 *
 * 1. Text slots (via data- attributes on <section>):
 *    <section data-layout="content" data-title="Hello" data-section="03">
 *    Layout uses: <!-- slot:title -->  <!-- slot:section -->
 *
 * 2. Content slots (via <slot name="..."> elements):
 *    <section data-layout="split">
 *      <slot name="left"><h1>Left content</h1></slot>
 *      <slot name="right"><p>Right content</p></slot>
 *    </section>
 *    Layout uses: <!-- slot:left -->  <!-- slot:right -->
 *
 * 3. Default content (everything not in a <slot>):
 *    Layout uses: <!-- content -->
 *
 * slideNumber / totalSlides are handled later in nodeToCreateElement.
 */
function applyLayout(content, layoutName, deckRoot, slots = {}) {
  const layoutPath = join(deckRoot, "layouts", `${layoutName}.html`)
  if (!existsSync(layoutPath)) return content

  let layoutHtml = readFileSync(layoutPath, "utf-8")

  // Extract named <slot> elements from the slide content
  const namedSlots = {}
  let remainingContent = content

  // Parse <slot name="...">...</slot> elements
  const slotRegex = /<slot\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/slot>/gi
  let match
  while ((match = slotRegex.exec(content)) !== null) {
    namedSlots[match[1]] = match[2].trim()
    remainingContent = remainingContent.replace(match[0], "")
  }

  // Replace <!-- content --> with remaining (non-slot) content
  layoutHtml = layoutHtml.replace(/<!--\s*content\s*-->/g, remainingContent)

  // Replace <!-- slot:name --> markers with named slot content or data- attribute values
  layoutHtml = layoutHtml.replace(/<!--\s*slot:(\w[\w-]*)\s*-->/g, (marker, name) => {
    // Content slots (from <slot> elements) take priority
    if (namedSlots[name] !== undefined) return namedSlots[name]
    // Text slots (from data- attributes)
    if (slots && slots[name] !== undefined && slots[name] !== null) return slots[name]
    // Unmatched slot — remove marker
    return ""
  })

  return layoutHtml
}

/**
 * Recursively convert an HTML node tree to createElement call string.
 */
function nodeToCreateElement(node) {
  // Text node
  if (node.nodeType === 3) {
    let text = node.rawText
    if (!text.trim()) return null

    // Handle slideNumber/totalSlides placeholders
    if (text.includes("___SLIDENUM___") || text.includes("___TOTALSLIDES___")) {
      const parts = splitPlaceholders(text)
      if (parts.length === 1) return parts[0]
      return `[${parts.join(", ")}]`
    }

    return JSON.stringify(text)
  }

  // Root node (no tag) — render children
  if (!node.tagName) {
    const children = node.childNodes
      .map(c => nodeToCreateElement(c))
      .filter(c => c !== null)
    if (children.length === 0) return "null"
    if (children.length === 1) return children[0]
    return `createElement("div", null, ${children.join(", ")})`
  }

  const tag = node.tagName.toLowerCase()
  if (tag === "script" || tag === "style") return null

  // Extract animation data attributes
  const step = node.getAttribute("data-step")
  const animate = node.getAttribute("data-animate")
  const delay = node.getAttribute("data-delay")
  const duration = node.getAttribute("data-duration")
  const stagger = node.getAttribute("data-stagger")
  const morph = node.getAttribute("data-morph")

  // Build props object
  const props = buildProps(node, true)

  // Get children
  const voidTags = new Set(["img", "br", "hr", "input", "link", "meta", "area", "base", "col", "embed", "source", "track", "wbr"])
  const isVoid = voidTags.has(tag)

  let childrenArgs = ""
  if (!isVoid) {
    const children = node.childNodes
      .map(c => nodeToCreateElement(c))
      .filter(c => c !== null)
    if (children.length > 0) {
      childrenArgs = ", " + children.join(", ")
    }
  }

  // Build the base element
  let element = `createElement("${tag}", ${props}${childrenArgs})`

  // Wrap in AnimatedGroup if data-stagger
  if (stagger) {
    const delayMs = parseInt(stagger, 10)
    const delaySec = isNaN(delayMs) ? 0.1 : delayMs / 1000
    const startStep = step ? parseInt(step, 10) : 1
    const animType = animate || "slide-up"

    // For stagger, children go into the AnimatedGroup, not the parent element
    const children = node.childNodes
      .map(c => nodeToCreateElement(c))
      .filter(c => c !== null)

    return `createElement(AnimatedGroup, { startStep: ${startStep}, animation: "${animType}", staggerDelay: ${delaySec}, className: ${props !== "null" ? `${props}?.className` : "undefined"} }, ${children.join(", ")})`
  }

  // Wrap in Animated if data-step is present
  if (step) {
    const stepNum = parseInt(step, 10)
    const animType = animate || "slide-up"
    const animProps = { step: stepNum, animation: animType }
    if (delay) animProps.delay = parseInt(delay, 10) / 1000
    if (duration) animProps.duration = parseInt(duration, 10) / 1000

    const propsNoAnim = buildProps(node, false)
    if (isVoid) {
      return `createElement(Animated, ${JSON.stringify(animProps)}, createElement("${tag}", ${propsNoAnim}))`
    }
    const children = node.childNodes.map(c => nodeToCreateElement(c)).filter(c => c !== null)
    return `createElement(Animated, ${JSON.stringify(animProps)}, createElement("${tag}", ${propsNoAnim}${children.length ? ", " + children.join(", ") : ""}))`
  }

  // Wrap in Animated if only data-animate (no step = step 0)
  if (animate && !step) {
    const animProps = { step: 0, animation: animate }
    if (delay) animProps.delay = parseInt(delay, 10) / 1000
    if (duration) animProps.duration = parseInt(duration, 10) / 1000

    const propsNoAnim = buildProps(node, false)
    if (isVoid) {
      return `createElement(Animated, ${JSON.stringify(animProps)}, createElement("${tag}", ${propsNoAnim}))`
    }
    const children = node.childNodes.map(c => nodeToCreateElement(c)).filter(c => c !== null)
    return `createElement(Animated, ${JSON.stringify(animProps)}, createElement("${tag}", ${propsNoAnim}${children.length ? ", " + children.join(", ") : ""}))`
  }

  // Wrap in Morph if data-morph
  if (morph) {
    return `createElement(Morph, { layoutId: "${morph}" }, ${element})`
  }

  return element
}

/**
 * Build a props object string from element attributes.
 *
 * @param {*} node
 * @param {boolean} includeAnimAttrs - Whether to include data-step/animate/etc
 */
function buildProps(node, includeAnimAttrs) {
  const attrs = node.attributes || {}
  const propsObj = {}
  let hasProps = false

  for (const [key, value] of Object.entries(attrs)) {
    // Skip handled data attributes
    if (key === "data-layout" || key === "data-transition") continue
    if (key === "data-morph") continue
    if (!includeAnimAttrs && (key === "data-step" || key === "data-animate" || key === "data-delay" || key === "data-duration" || key === "data-stagger")) continue
    if (includeAnimAttrs && (key === "data-step" || key === "data-animate" || key === "data-delay" || key === "data-duration" || key === "data-stagger")) continue

    hasProps = true

    if (key === "class") {
      propsObj.className = value
    } else if (key === "for") {
      propsObj.htmlFor = value
    } else if (key === "style") {
      // Will be handled specially below
      propsObj.__style = value
    } else if (key === "tabindex") {
      propsObj.tabIndex = parseInt(value, 10) || 0
    } else {
      // Convert kebab-case data attrs to camelCase
      const jsxKey = key.startsWith("data-") ? key : htmlAttrToJsx(key)
      propsObj[jsxKey] = value === "" ? true : value
    }
  }

  if (!hasProps) return "null"

  // Build the props string manually for better output
  const parts = []
  for (const [key, value] of Object.entries(propsObj)) {
    // Quote keys that aren't valid JS identifiers (e.g. data-section)
    const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
    if (key === "__style") {
      parts.push(`style: ${styleToObject(value)}`)
    } else if (typeof value === "boolean") {
      parts.push(`${safeKey}: true`)
    } else {
      parts.push(`${safeKey}: ${JSON.stringify(value)}`)
    }
  }

  return `{ ${parts.join(", ")} }`
}

/**
 * Convert CSS style string to JS object string.
 */
function styleToObject(styleStr) {
  const pairs = styleStr.split(";").filter(s => s.trim())
  const entries = pairs.map(pair => {
    const [prop, ...rest] = pair.split(":")
    const key = prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const val = rest.join(":").trim()
    return `${key}: ${JSON.stringify(val)}`
  })
  return `{ ${entries.join(", ")} }`
}

/**
 * Split text containing placeholders into an array of string/expression parts.
 */
function splitPlaceholders(text) {
  const parts = []
  let rest = text
  while (rest.length > 0) {
    const numIdx = rest.indexOf("___SLIDENUM___")
    const totalIdx = rest.indexOf("___TOTALSLIDES___")

    let nextIdx = -1
    let replacement = ""
    let placeholderLen = 0

    if (numIdx >= 0 && (totalIdx < 0 || numIdx < totalIdx)) {
      nextIdx = numIdx
      replacement = "slideNumber"
      placeholderLen = "___SLIDENUM___".length
    } else if (totalIdx >= 0) {
      nextIdx = totalIdx
      replacement = "totalSlides"
      placeholderLen = "___TOTALSLIDES___".length
    }

    if (nextIdx < 0) {
      if (rest.trim()) parts.push(JSON.stringify(rest))
      break
    }

    if (nextIdx > 0) {
      const before = rest.slice(0, nextIdx)
      if (before.trim()) parts.push(JSON.stringify(before))
    }
    parts.push(replacement)
    rest = rest.slice(nextIdx + placeholderLen)
  }
  return parts
}

function htmlAttrToJsx(attr) {
  const map = {
    tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength",
    colspan: "colSpan", rowspan: "rowSpan", crossorigin: "crossOrigin",
    autocomplete: "autoComplete", autofocus: "autoFocus", autoplay: "autoPlay",
    srcset: "srcSet", cellspacing: "cellSpacing", cellpadding: "cellPadding",
    // SVG attributes
    "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin", "stroke-dasharray": "strokeDasharray",
    "stroke-dashoffset": "strokeDashoffset", "stroke-miterlimit": "strokeMiterlimit",
    "stroke-opacity": "strokeOpacity", "fill-opacity": "fillOpacity",
    "fill-rule": "fillRule", "clip-rule": "clipRule", "clip-path": "clipPath",
    "font-size": "fontSize", "font-family": "fontFamily", "font-weight": "fontWeight",
    "text-anchor": "textAnchor", "dominant-baseline": "dominantBaseline",
    "alignment-baseline": "alignmentBaseline", "baseline-shift": "baselineShift",
    "stop-color": "stopColor", "stop-opacity": "stopOpacity",
    "color-interpolation": "colorInterpolation",
    "color-interpolation-filters": "colorInterpolationFilters",
    "flood-color": "floodColor", "flood-opacity": "floodOpacity",
    "lighting-color": "lightingColor", "pointer-events": "pointerEvents",
    "shape-rendering": "shapeRendering", "text-decoration": "textDecoration",
    "transform-origin": "transformOrigin", "vector-effect": "vectorEffect",
    "writing-mode": "writingMode", "xlink:href": "xlinkHref"
  }
  // If it has a hyphen and isn't in the map, convert kebab-case to camelCase
  if (map[attr]) return map[attr]
  if (attr.includes("-")) {
    return attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  }
  return attr
}

/**
 * Ensure the root <section> element has h-full class.
 * Without it, child elements using h-full or vertical centering won't work
 * because the section defaults to height: auto (content-based).
 */
function ensureSectionHeight(html) {
  // Match the opening <section ...> tag
  return html.replace(/^(\s*<section\b)([^>]*)(>)/i, (match, open, attrs, close) => {
    // Check if h-full is already present
    const classMatch = attrs.match(/class="([^"]*)"/)
    if (classMatch) {
      const classes = classMatch[1]
      if (/\bh-full\b/.test(classes)) return match // already has it
      // Add h-full to existing classes
      return `${open}${attrs.replace(`class="${classes}"`, `class="${classes} h-full"`)}${close}`
    }
    // No class attribute — add one
    return `${open} class="h-full"${attrs}${close}`
  })
}

function toComponentName(filename) {
  const base = filename.replace(/\.html$/, "")
  return base.split(/[-_]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("")
}
