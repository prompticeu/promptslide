# Theming & Branding Reference

## Theme Files

Themes are CSS files in the `themes/` directory of each deck. Each theme defines CSS custom properties for colors, fonts, and spacing.

A `default.css` theme is auto-created with `@import "tailwindcss"` and `@theme inline` color mappings. Custom themes should **NOT** include `@import "tailwindcss"` — it's already in default.css and duplicating it breaks color resolution.

Custom themes only need:
- `@import url(...)` for external fonts (optional)
- `@theme inline { ... }` for font overrides (use `inline` to extend, not replace the theme)
- `:root` and `.dark` blocks with CSS variable overrides

Use `write_theme` to create or update themes, and `set_deck_theme` to apply one.

---

## OKLCH Color System

Format: `oklch(lightness chroma hue)`

| Parameter | Range | Description |
|-----------|-------|-------------|
| **Lightness** | 0 (black) to 1 (white) | How bright the color is |
| **Chroma** | 0 (gray) to ~0.4 (vivid) | Color intensity/saturation |
| **Hue** | 0–360 | Color wheel angle |

**Hue reference**: 0=red, 30=orange, 60=yellow, 120=green, 195=teal, 250=blue, 300=purple, 330=pink

**Tips for picking values**:
- Light mode primary: lightness 0.5–0.6, chroma 0.15–0.25
- Dark mode primary: increase lightness by 0.05 for readability
- Keep chroma above 0.15 for vibrant brand colors

### Brand Color Examples

| Brand | Light Mode | Dark Mode | Hue |
|-------|-----------|----------|-----|
| Blue (default) | `oklch(0.55 0.2 250)` | `oklch(0.6 0.2 250)` | 250 |
| Purple | `oklch(0.55 0.2 300)` | `oklch(0.6 0.2 300)` | 300 |
| Green | `oklch(0.6 0.2 145)` | `oklch(0.65 0.2 145)` | 145 |
| Orange | `oklch(0.661 0.201 41)` | `oklch(0.7 0.2 41)` | 41 |
| Red | `oklch(0.577 0.245 27)` | `oklch(0.65 0.22 27)` | 27 |
| Teal | `oklch(0.6 0.15 195)` | `oklch(0.65 0.15 195)` | 195 |

---

## CSS Variables

### Required Variables (Light Mode — `:root`)

```css
:root {
  --background: oklch(1 0 0);          /* Page background */
  --foreground: oklch(0.145 0 0);      /* Primary text */
  --card: oklch(1 0 0);               /* Card/panel background */
  --card-foreground: oklch(0.145 0 0); /* Card text */
  --primary: oklch(0.55 0.2 250);      /* Brand color */
  --primary-foreground: oklch(0.985 0 0); /* Text on primary bg */
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0); /* Secondary text */
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --border: oklch(0.922 0 0);          /* Borders */
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}
```

### Dark Mode (always include)

```css
.dark {
  --background: oklch(0.159 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --primary: oklch(0.6 0.2 250);       /* Slightly brighter for dark */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.305 0 0);
  --muted-foreground: oklch(0.712 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --border: oklch(0.269 0 0);
  --input: oklch(1 0 0 / 15%);
}
```

---

## Semantic Color Classes

Use these Tailwind classes for consistent theming:

| Class | Purpose | Use For |
|-------|---------|---------|
| `text-foreground` | Primary text | Headings, important text |
| `text-muted-foreground` | Secondary text | Descriptions, labels |
| `text-primary` | Brand color text | Accents, highlights, numbers |
| `text-primary-foreground` | Text on primary bg | Button labels on primary backgrounds |
| `bg-background` | Page background | Slide background |
| `bg-card` | Card background | Content cards, panels |
| `bg-primary` | Primary background | Accent backgrounds |
| `bg-primary/10` | Subtle primary bg | Icon backgrounds, highlights |
| `border-border` | Standard border | Card borders, dividers |

---

## Dark Mode

Dark mode is the default and recommended mode. The `<html>` element is rendered with `class="dark"` by the PromptSlide runtime.

---

## Asset Protocol

Use `asset://filename` for logos and images in slides and layouts:

```html
<img src="asset://logo.svg" class="h-8" />
```

Upload assets with the `upload_asset` tool. Reference them with `asset://filename`.

Set a deck-level logo with `update_deck(logo: "asset://logo.svg")`.
