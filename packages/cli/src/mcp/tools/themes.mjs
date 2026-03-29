/**
 * MCP Theme tools: get_theme, write_theme, set_deck_theme
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"

import { resolveDeckPath } from "../deck-resolver.mjs"

export function registerThemeTools(server, context) {
  const { deckRoot } = context

  // ─── get_theme ───
  server.tool(
    "get_theme",
    `Read a theme's CSS content. Returns the raw CSS source of the theme file.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      theme: z.string().describe("Theme name (e.g. 'default', 'corporate')")
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deck, theme }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const filename = theme.endsWith(".css") ? theme : `${theme}.css`
      const themePath = join(deckPath, "themes", filename)

      if (!existsSync(themePath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Theme not found: ${filename}` }) }] }
      }

      const content = readFileSync(themePath, "utf-8")
      return { content: [{ type: "text", text: content }] }
    }
  )

  // ─── write_theme ───
  server.tool(
    "write_theme",
    `Create or update a theme CSS file. Themes use CSS custom properties: ` +
    `--primary, --background, --foreground, --card, --card-foreground, ` +
    `--muted, --muted-foreground, --border, --font-heading, --font-body. ` +
    `Colors in OKLCH format: oklch(lightness chroma hue). ` +
    `Include both :root (light) and .dark sections. Must start with @import "tailwindcss";`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      name: z.string().describe("Theme name (e.g. 'corporate', 'minimal')"),
      content: z.string().describe("CSS content for the theme")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, name, content }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const themesDir = join(deckPath, "themes")
      mkdirSync(themesDir, { recursive: true })

      const filename = name.endsWith(".css") ? name : `${name}.css`
      writeFileSync(join(themesDir, filename), content)

      return { content: [{ type: "text", text: JSON.stringify({ success: true, theme: name, message: `Theme saved. Use set_deck_theme to apply it.` }) }] }
    }
  )

  // ─── set_deck_theme ───
  server.tool(
    "set_deck_theme",
    `Apply a theme to the deck. Updates deck.json to use the specified theme. ` +
    `The theme change propagates to all slides without touching slide content.`,
    {
      deck: z.string().optional().describe("Deck slug (optional if only one deck exists)"),
      theme: z.string().describe("Theme name (must match a .css file in themes/)")
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deck, theme }) => {
      let deckPath
      try {
        deckPath = resolveDeckPath(deckRoot, deck)
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] }
      }

      const manifestPath = join(deckPath, "deck.json")
      if (!existsSync(manifestPath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "No deck.json found." }) }] }
      }

      const themePath = join(deckPath, "themes", `${theme}.css`)
      if (!existsSync(themePath)) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Theme not found: ${theme}.css` }) }] }
      }

      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
      manifest.theme = theme
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

      return { content: [{ type: "text", text: JSON.stringify({ success: true, theme, message: "Theme applied to deck." }) }] }
    }
  )
}
