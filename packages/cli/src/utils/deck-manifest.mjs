import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

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
      id: s.id || s.file?.replace(/\.(tsx|jsx|html)$/, ""),
      file: s.file || null,
      section: s.section || null,
      transition: s.transition || null,
      title: s.title || null
    }))
  }
}

/**
 * Read deck.json from a deck directory.
 *
 * @param {string} deckPath - Path to deck directory
 * @returns {Object|null} Parsed manifest or null
 */
export function readDeckManifest(deckPath) {
  const manifestPath = join(deckPath, "deck.json")
  if (!existsSync(manifestPath)) return null
  const raw = readFileSync(manifestPath, "utf-8")
  return parseDeckManifest(raw)
}
