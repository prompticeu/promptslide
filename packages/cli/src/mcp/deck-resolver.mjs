/**
 * Deck path resolver for multi-deck mode.
 *
 * Resolves a deck slug to its directory path under deckRoot.
 * If no slug is provided and only one deck exists, auto-selects it.
 */

import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

/**
 * Find all deck slugs (subdirectories containing deck.json) under deckRoot.
 *
 * @param {string} deckRoot - Base decks directory (e.g. ~/.promptslide/decks/)
 * @returns {string[]} Array of deck slugs
 */
export function listDeckSlugs(deckRoot) {
  if (!existsSync(deckRoot)) return []

  const slugs = []
  for (const entry of readdirSync(deckRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (existsSync(join(deckRoot, entry.name, "deck.json"))) {
      slugs.push(entry.name)
    }
  }
  return slugs
}

/**
 * Resolve a deck slug to its full directory path.
 *
 * - If `slug` is provided, returns `join(deckRoot, slug)`.
 * - If `slug` is omitted and exactly one deck exists, auto-selects it.
 * - Otherwise throws with a descriptive error.
 *
 * @param {string} deckRoot - Base decks directory
 * @param {string} [slug] - Deck slug (optional)
 * @returns {string} Resolved deck directory path
 * @throws {Error} If slug is missing and auto-detection fails
 */
export function resolveDeckPath(deckRoot, slug) {
  if (slug) {
    return join(deckRoot, slug)
  }

  // Auto-detect: if only one deck exists, use it
  const slugs = listDeckSlugs(deckRoot)

  if (slugs.length === 1) {
    return join(deckRoot, slugs[0])
  }

  if (slugs.length === 0) {
    throw new Error("No decks found. Create one with create_deck.")
  }

  throw new Error(
    `Multiple decks found: ${slugs.join(", ")}. ` +
    `Please specify a deck slug. Use list_decks to see available decks.`
  )
}
