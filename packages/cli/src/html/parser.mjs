/**
 * HTML slide parser.
 *
 * Parses an HTML slide file and extracts metadata, animation attributes,
 * and content. Lightweight wrapper around node-html-parser.
 */

import { parse as parseHTML } from "node-html-parser"

/**
 * @typedef {Object} ParsedSlide
 * @property {string} content - Full HTML of the slide (including <section> wrapper if present)
 * @property {string|null} layout - data-layout value
 * @property {string|null} transition - data-transition value
 * @property {number} steps - Auto-detected from highest data-step
 */

/**
 * Parse an HTML slide file.
 *
 * Preserves the full HTML including the <section> tag and its attributes
 * (classes, styles, etc.), since they are part of the slide's visual design.
 *
 * @param {string} html - Raw HTML content of a .html slide file
 * @returns {ParsedSlide}
 */
export function parseSlide(html) {
  const root = parseHTML(html, { comment: true })

  // Find the <section> element (top-level slide container)
  const section = root.querySelector("section")
  if (!section) {
    // If no <section>, treat the entire HTML as freeform content
    return {
      content: html.trim(),
      layout: null,
      transition: null,
      steps: detectSteps(root)
    }
  }

  return {
    // Return the full outer HTML so <section> classes/styles are preserved
    content: section.outerHTML,
    layout: section.getAttribute("data-layout") || null,
    transition: section.getAttribute("data-transition") || null,
    steps: detectSteps(section)
  }
}

/**
 * Auto-detect the number of animation steps by finding the highest
 * data-step value in the HTML.
 *
 * @param {import("node-html-parser").HTMLElement} root
 * @returns {number}
 */
function detectSteps(root) {
  let maxStep = 0
  const elements = root.querySelectorAll("[data-step]")
  for (const el of elements) {
    const step = parseInt(el.getAttribute("data-step"), 10)
    if (!isNaN(step) && step > maxStep) {
      maxStep = step
    }
  }
  return maxStep
}

/**
 * Read and parse deck.json manifest.
 *
 * @param {string} jsonString - Content of deck.json
 * @returns {Object} Parsed deck manifest
 */
export function parseDeckManifest(jsonString) {
  const manifest = JSON.parse(jsonString)
  return {
    name: manifest.name || "Untitled Deck",
    slug: manifest.slug || "untitled",
    theme: manifest.theme || null,
    transition: manifest.transition || "fade",
    directionalTransition: manifest.directionalTransition ?? true,
    logo: manifest.logo || null,
    slides: (manifest.slides || []).map(s => ({
      file: s.file,
      section: s.section || null,
      transition: s.transition || null
    }))
  }
}
