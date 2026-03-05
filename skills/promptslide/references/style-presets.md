# Style Presets

Curated visual directions for slide decks. Use these as starting points — adjust colors, fonts, and card styles to match the brand. Each preset specifies the primary OKLCH color for `globals.css`, recommended fonts, card treatment, and animation style.

---

## Dark Themes

### 1. Electric Noir

High-contrast dark background with a single vivid accent color. Large section numbers or oversized typography as visual anchors.

| Property | Value |
|----------|-------|
| **Primary** | `oklch(0.65 0.25 250)` (electric blue) |
| **Background** | Near-black (`oklch(0.13 0 0)`) |
| **Fonts** | Heading: **Space Grotesk**, Body: **Inter** |
| **Cards** | No borders. Subtle `bg-white/5` tint with `shadow-2xl`. |
| **Animations** | `fade` and `scale` — slow (0.5s). Dramatic reveals. |
| **Signature** | Oversized numbers (`text-8xl text-primary/20`) as slide accents |

### 2. Midnight Studio

Warm dark theme with amber/gold accents. Sophisticated and editorial.

| Property | Value |
|----------|-------|
| **Primary** | `oklch(0.7 0.18 70)` (warm amber) |
| **Background** | Deep charcoal (`oklch(0.15 0.01 60)`) |
| **Fonts** | Heading: **Playfair Display**, Body: **Source Sans 3** |
| **Cards** | Thin `border-primary/10` borders. No fill. |
| **Animations** | `fade` only — slow (0.6s). Elegant, minimal motion. |
| **Signature** | Serif headlines create contrast against clean body text |

### 3. Neon Terminal

Developer/hacker aesthetic. Monospace type, green-on-dark, terminal feel.

| Property | Value |
|----------|-------|
| **Primary** | `oklch(0.75 0.2 145)` (terminal green) |
| **Background** | True black (`oklch(0.1 0 0)`) |
| **Fonts** | Heading: **JetBrains Mono**, Body: **JetBrains Mono** |
| **Cards** | `border border-primary/20 bg-primary/5`. Code-block aesthetic. |
| **Animations** | `fade` with short duration (0.2s). Instant, snappy. |
| **Signature** | Monospace everything. Use `>` prefixes and `//` comments as visual texture |

---

## Light Themes

### 4. Clean Corporate

Minimal, professional white theme. No visual noise.

| Property | Value |
|----------|-------|
| **Primary** | `oklch(0.5 0.2 250)` (classic blue) |
| **Background** | Pure white |
| **Fonts** | Heading: **Inter**, Body: **Inter** |
| **Cards** | `border border-border bg-card` with `shadow-sm`. |
| **Animations** | `slide-up` — fast (0.3s). Professional, no-nonsense. |
| **Signature** | Generous whitespace. Let typography and data carry the slide. |

### 5. Warm Editorial

Magazine-inspired layout with warm neutrals and serif headings.

| Property | Value |
|----------|-------|
| **Primary** | `oklch(0.55 0.15 30)` (warm terracotta) |
| **Background** | Off-white (`oklch(0.98 0.005 80)`) |
| **Fonts** | Heading: **Fraunces**, Body: **Inter** |
| **Cards** | No cards. Use horizontal rules (`border-t`), pull quotes, and typography hierarchy. |
| **Animations** | `slide-up` and `fade` — medium (0.4s). Reading-order stagger. |
| **Signature** | Large pull quotes. Asymmetric text layouts. Drop caps. |

### 6. Pastel Soft

Friendly, approachable light theme with soft pastels.

| Property | Value |
|----------|-------|
| **Primary** | `oklch(0.6 0.15 280)` (soft purple) |
| **Background** | Light warm gray (`oklch(0.97 0.005 80)`) |
| **Fonts** | Heading: **DM Sans**, Body: **DM Sans** |
| **Cards** | Rounded (`rounded-2xl`), tinted backgrounds (`bg-primary/5`, `bg-accent/5`). No borders. |
| **Animations** | `scale` and `slide-up` — medium (0.4s), tight stagger (0.08s). Playful. |
| **Signature** | Colored card backgrounds that alternate between primary/accent tints |

---

## Specialty Themes

### 7. Grid Rational

Bauhaus/Swiss design. Geometric precision, strong grid, bold color blocks.

| Property | Value |
|----------|-------|
| **Primary** | `oklch(0.6 0.25 30)` (bold red) |
| **Background** | White |
| **Fonts** | Heading: **Space Grotesk**, Body: **Space Grotesk** |
| **Cards** | Full-bleed color blocks (`bg-primary`, `bg-foreground`). No rounded corners (`rounded-none`). |
| **Animations** | `slide-left` and `slide-up` — fast (0.25s). Geometric, directional. |
| **Signature** | Grid-based layouts. Black/red/white only. Bold geometric dividers. |

### 8. Gradient Night

Rich dark theme with deep blue-to-purple color palette. Polished and modern.

| Property | Value |
|----------|-------|
| **Primary** | `oklch(0.65 0.22 280)` (vibrant purple) |
| **Background** | Deep navy (`oklch(0.15 0.03 270)`) |
| **Fonts** | Heading: **Outfit**, Body: **Inter** |
| **Cards** | `bg-white/5 border border-white/10`. Frosted glass look (without blur — use opacity). |
| **Animations** | `fade` and `slide-up` — medium (0.4s). Smooth, polished. |
| **Signature** | Layered opacity cards. Use `bg-primary/10` accents against dark backgrounds. |

---

## Using a Preset

1. Set the `--primary` color in `src/globals.css` (in the `:root` block)
2. Load fonts via `<link>` in `index.html` (Google Fonts or Fontshare)
3. Set `fonts.heading` and `fonts.body` in `src/theme.ts`
4. Follow the card style and animation recommendations when building slides
5. Use the "signature" element on at least 1–2 slides for visual identity

Presets are starting points. Mix elements across presets if the brand calls for it.
