# Theming & Branding Reference

## Brand Color

Change your brand color by editing `--primary` in `src/globals.css`:

```css
:root {
  --primary: oklch(0.55 0.2 250);
}
```

### Example Brand Colors

| Brand          | OKLCH Value             | Hue |
| -------------- | ----------------------- | --- |
| Blue (default) | `oklch(0.55 0.2 250)`   | 250 |
| Purple         | `oklch(0.55 0.2 300)`   | 300 |
| Green          | `oklch(0.6 0.2 145)`    | 145 |
| Orange         | `oklch(0.661 0.201 41)` | 41  |
| Red            | `oklch(0.577 0.245 27)` | 27  |
| Teal           | `oklch(0.6 0.15 195)`   | 195 |

---

## OKLCH Color System

Format: `oklch(lightness chroma hue)`

| Parameter     | Range                    | Description                |
| ------------- | ------------------------ | -------------------------- |
| **Lightness** | 0 (black) to 1 (white)   | How bright the color is    |
| **Chroma**    | 0 (gray) to ~0.4 (vivid) | Color intensity/saturation |
| **Hue**       | 0–360                    | Color wheel angle          |

**Hue reference**: 0=red, 30=orange, 60=yellow, 120=green, 195=teal, 250=blue, 300=purple, 330=pink

**Tips for picking values**:

- Primary: lightness 0.5–0.65, chroma 0.15–0.25
- Keep chroma above 0.15 for vibrant brand colors

---

## All CSS Variables

```css
:root {
  --background: oklch(0.159 0 0); /* Near-black */
  --foreground: oklch(0.985 0 0); /* Near-white */

  --card: oklch(0.205 0 0); /* Dark gray */
  --card-foreground: oklch(0.985 0 0);

  --primary: oklch(0.55 0.2 250); /* Brand color */
  --primary-foreground: oklch(0.985 0 0); /* White text on primary */

  --secondary: oklch(0.985 0 0);
  --secondary-foreground: oklch(0.141 0 0);

  --muted: oklch(0.305 0 0); /* Muted backgrounds */
  --muted-foreground: oklch(0.712 0 0); /* Secondary text */

  --accent: oklch(0.305 0 0);
  --accent-foreground: oklch(0.925 0 0);

  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);

  --border: oklch(0.269 0 0); /* Borders */
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);

  --radius: 0.625rem;
}
```

---

## Semantic Color Classes

Use these Tailwind classes for consistent theming:

| Class                     | Purpose            | Use For                          |
| ------------------------- | ------------------ | -------------------------------- |
| `text-foreground`         | Primary text       | Headings, important text         |
| `text-muted-foreground`   | Secondary text     | Descriptions, labels             |
| `text-primary`            | Brand color text   | Accents, highlights, numbers     |
| `text-primary-foreground` | Text on primary bg | Button labels on primary buttons |
| `bg-background`           | Page background    | Slide background                 |
| `bg-card`                 | Card background    | Content cards, panels            |
| `bg-primary`              | Primary background | Accent backgrounds               |
| `bg-primary/10`           | Subtle primary bg  | Icon backgrounds, highlights     |
| `border-border`           | Standard border    | Card borders, dividers           |

---

## Theme Setup

Configure in `src/theme.ts`:

```ts
import type { ThemeConfig } from "promptslide";

export const theme: ThemeConfig = {
  name: "Acme Inc",
  logo: {
    full: "/logo.svg",
    icon: "/icon.svg",            // Compact variant (title slides)
    fullLight: "/logo-white.svg", // For dark backgrounds
  },
  colors: {
    primary: "oklch(0.55 0.2 250)",
    secondary: "oklch(0.6 0.15 200)",
    accent: "oklch(0.7 0.2 50)",
  },
  fonts: {
    heading: "Inter",
    body: "Inter",
  },
};
```

Everything is optional except `name`. Omitted values fall back to `globals.css` defaults.

- Place your logo file in the `public/` directory (e.g., `public/logo.svg`)
- The logo appears in the footer of every slide (unless `hideFooter` is set)
- Logo renders at `h-8 w-auto` (32px height, auto width)
- Colors use OKLCH format and are injected as CSS variable overrides at runtime

---

## Font Pairings

Load fonts via `<link>` in `index.html` (Google Fonts or Fontshare), then set them in `src/theme.ts`.

Choose fonts that match the deck's personality. Browse [Google Fonts](https://fonts.google.com) or [Fontshare](https://www.fontshare.com) and pick something that fits the mood — don't default to the first familiar name.

**Pairing principles:**
- One font family for the whole deck is fine — don't force a pairing
- Serif headings + sans body = classic contrast (editorial, formal)
- Sans headings + sans body = modern, clean (most presentations)
- Monospace everything = developer/hacker aesthetic only
- Avoid pairing two serif fonts — it gets busy
- **Avoid defaulting to Inter, Roboto, or Arial** — they're readable but generic. If the brand doesn't mandate a specific font, choose one with more character.
