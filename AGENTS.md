# PromptSlide — Agent Documentation

This file documents the slide presentation framework for coding agents (Claude Code, Cursor, Windsurf, etc.). Read this before creating or modifying slides.

## Quick Start

Slides are HTML files with Tailwind CSS. Each slide is a `.html` file in `slides/` containing a `<section>` element:

```html
<section class="relative flex items-center justify-center overflow-hidden bg-background">
  <div class="text-center px-16">
    <h1 class="text-7xl font-bold text-foreground">Title</h1>
    <p class="mt-4 text-xl text-muted-foreground"
       data-step="1" data-animate="fade">
      Subtitle appears on click
    </p>
  </div>
</section>
```

Use `data-layout="name"` to apply a slide master layout:

```html
<section data-layout="content" data-section="02" data-title="Market Opportunity">
  <p class="text-lg text-muted-foreground">$50B Total Addressable Market</p>
</section>
```

The framework auto-adds `h-full` to `<section>`. Slide dimensions: **1280×720** (16:9). Changes appear instantly via HMR.

---

## Architecture

```
my-deck/
├── deck.json           # Manifest — slide order, theme, transitions
├── slides/             # Slide HTML files
├── layouts/            # Slide master templates (like PowerPoint masters)
├── themes/             # CSS theme files
├── assets/             # Images, logos, etc.
└── annotations.json    # Feedback/comments (optional)
```

**Key principle**: Layouts define repeating structure (headers, footers, numbering). Slides provide content. Themes control colors and fonts.

---

## Deck Manifest (deck.json)

```json
{
  "name": "My Deck",
  "slug": "my-deck",
  "theme": "default",
  "transition": "fade",
  "directionalTransition": true,
  "slides": [
    { "file": "hero.html" },
    { "file": "problem.html", "section": "Introduction" }
  ]
}
```

Steps are auto-detected from HTML. Add/remove/reorder slides by editing the `slides` array.

---

## Animations

| Attribute | Purpose |
|-----------|---------|
| `data-step="N"` | Reveal on Nth click (1-indexed) |
| `data-animate="type"` | Animation: `fade`, `slide-up`, `slide-down`, `slide-left`, `slide-right`, `scale` |
| `data-delay="ms"` | Delay before animation |
| `data-duration="ms"` | Animation duration |
| `data-stagger="ms"` | Stagger children |
| `data-morph="id"` | Cross-slide shared element transition |

---

## Layouts

Layouts are HTML files in `layouts/` using `<!-- slot:name -->` markers:

- **Text slots**: `data-*` attributes on `<section>` → `<!-- slot:name -->`
- **Content slots**: `<slot name="...">` elements → `<!-- slot:name -->`
- **Built-in**: `<!-- content -->`, `<!-- slideNumber -->`, `<!-- totalSlides -->`

---

## Theming

Themes are CSS files in `themes/` with CSS custom properties in OKLCH format. Dark mode is the default.

**Semantic colors**: `text-foreground`, `text-muted-foreground`, `text-primary`, `bg-background`, `bg-card`, `border-border`

**Assets**: Use `asset://filename` for images — `<img src="asset://logo.svg" class="h-8" />`

---

## Slide Transitions

Options: `fade` (default), `slide-left`, `slide-right`, `slide-up`, `slide-down`, `zoom`, `zoom-fade`, `morph`, `none`

Set in `deck.json` or per-slide via `data-transition` on `<section>`.

---

## MCP Server

When the PromptSlide MCP server is connected (`promptslide studio --mcp`), it provides tools for creating, reading, editing, and previewing slides — including visual screenshots. Call `get_guide("framework")` for a comprehensive reference, or `get_guide("design-recipes")` for code snippets.

---

## Visual Verification

Always verify slides visually after changes. Common issues only visible in rendered output: broken alignment, wrong colors, text overflow, content clipped by overflow-hidden.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` / `Space` | Advance |
| `←` | Go back |
| `F` | Toggle fullscreen |
| `G` | Toggle grid view |
| `Escape` | Exit fullscreen |
