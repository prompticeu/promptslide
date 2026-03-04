# Slide Design Guide

Design visually diverse, clean slide decks. Every slide should look different from its neighbors — vary layouts, card styles, and animations throughout the deck.

---

## Building Blocks

### Layouts

Create layout files in `src/layouts/` as React components. These are your "master theme" — change a layout, every slide using it updates.

```tsx
import type { SlideProps } from "@promptslide/core"
import { useTheme, SlideFooter, cn } from "@promptslide/core"

interface MyLayoutProps extends SlideProps {
  children?: React.ReactNode
  title?: string
  hideFooter?: boolean
}

export function MyLayout({ children, slideNumber, totalSlides, title, hideFooter }: MyLayoutProps) {
  const theme = useTheme()
  // theme.name, theme.logo, theme.fonts, theme.assets, theme.colors

  return (
    <div className="bg-background text-foreground relative flex h-full w-full flex-col overflow-hidden px-12 pt-10 pb-6">
      {title && <h2 className="text-4xl font-bold tracking-tight">{title}</h2>}
      <div className="min-h-0 flex-1">{children}</div>
      {!hideFooter && <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />}
    </div>
  )
}
```

**Available APIs:**
- `useTheme()` — returns `ThemeConfig` with `name`, `logo`, `colors`, `fonts`, `assets`
- `SlideFooter` — logo + company name + slide number. Pass `variant="light"` for dark backgrounds
- `cn()` — Tailwind class merge utility
- `theme.fonts.heading` — use via `style={{ fontFamily: theme.fonts.heading }}`
- `theme.logo.fullLight` — use with `SlideFooter variant="light"` for dark backgrounds

### Animations

Wrap content in `<Animated>` for click-to-reveal steps, or `<AnimatedGroup>` for staggered reveals of lists/grids.

```tsx
import { Animated, AnimatedGroup } from "@promptslide/core"

// Single element — appears on step 1
<Animated step={1} animation="fade">content</Animated>

// Staggered group — each child appears one after another starting at step 1
<AnimatedGroup startStep={1} animation="scale" staggerDelay={0.08}>
  <div>Item 1</div>
  <div>Item 2</div>
</AnimatedGroup>
```

Available animations: `fade`, `slide-up`, `slide-down`, `slide-left`, `slide-right`, `scale`

### Icons

Use [Lucide React](https://lucide.dev) — 1000+ icons available:

```tsx
import { Sparkles, Check, X, ArrowRight } from "lucide-react"
<Sparkles className="h-6 w-6 text-primary" />
```

---

## Styling Constraints

These rules ensure slides look identical on screen and in PDF export.

**Do not use:**
- `filter: blur()` or `backdrop-filter: blur()` — silently dropped by Chromium's PDF pipeline
- `bg-gradient-to-*`, radial gradients, gradient meshes — use solid colors with opacity instead
- `shadow-primary/10` or higher — colored shadows render heavier in PDF. Use plain `shadow-lg` or keep at `/5` max

**Use instead:**
- Solid colors at different opacities: `bg-primary/5`, `bg-muted/20`, `bg-white/5`
- Borders for structure: `border border-border`, `border border-primary/15`
- Plain shadows for depth: `shadow-xl`, `shadow-lg`
- Typography and whitespace for hierarchy

---

## Content Density

Slides are projected, not read. Enforce strict limits per slide type — if content exceeds them, split across multiple slides.

**Title slides:**
- 1 heading + 1 subtitle (max 10 words)
- Optional: logo, tagline, or single visual

**Content slides:**
- 1 heading + 4–6 bullet points, OR
- 1 heading + 2 short paragraphs (2–3 sentences each), OR
- 1 heading + 2–4 cards/items in a grid

**Data slides:**
- 1 heading + 1 chart/table/diagram
- Max 6 rows in a table, max 4 data points in a comparison

**Quote slides:**
- 1 quote (max 30 words) + attribution

**Split rule:** If you're writing a 7th bullet point or a 3rd paragraph, stop — create a second slide instead. Two clean slides always beat one cramped one.

---

## Design Principles

- **No two consecutive slides should use the same layout.** If slide 3 is a card grid, slide 4 should be something completely different.
- **Vary card styles.** Don't use `rounded-xl border border-border bg-card p-8` on every slide. Mix bordered, tinted, elevated, accent-border, or no cards at all.
- **Vary animations.** Don't use `slide-up` on everything. Match the animation to the content.
- **Use asymmetry.** Not every grid needs equal columns. Try `grid-cols-5` with `col-span-2` + `col-span-3`.
- **Let content breathe.** Whitespace is a design tool. Not every slide needs to be packed with elements.
- **Typography can be the visual.** A large quote, a bold number, or a headline with a highlighted word can carry a slide without any cards or icons.

---

## Visual Anti-Patterns

Avoid these common mistakes that make slides look generic or "AI-generated":

**Overused patterns:**
- Same card style on every slide (`rounded-xl border bg-card p-8` everywhere)
- Uniform icon-title-description grids on 3+ consecutive slides
- Centering everything — use left-aligned, asymmetric, or split layouts for variety
- Every heading the same size and weight — vary hierarchy with `text-2xl` to `text-6xl`

**Generic aesthetics:**
- Purple/indigo as the default accent on every deck — match the brand or pick a distinctive palette
- Low-contrast muted colors everywhere — use at least one bold accent or contrast moment
- Identical spacing on all slides — let some content breathe with generous whitespace, pack others tightly for energy

**What to do instead:**
- Mix at least 3 different visual treatments across a deck: full-bleed color, cards, typography-driven, data-heavy, asymmetric grid
- Use one "hero moment" slide with oversized typography or a single bold number
- Alternate between dense and spacious slides for rhythm
- Use color blocking (full-width `bg-primary` sections) sparingly but deliberately for impact
