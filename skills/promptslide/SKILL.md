---
name: promptslide
description: >-
  Creates and authors slide deck presentations using the PromptSlide framework
  (Vite + React 19 + Tailwind v4 + Framer Motion). Use when the user wants to
  create a new slide deck, add or edit slides, customize themes or branding,
  or work with slide animations and transitions. Triggers on mentions of slides,
  decks, presentations, PromptSlide, or slide-related tasks.
metadata:
  author: prompticeu
  version: "2.0"
---

# PromptSlide

Create beautiful slide decks with AI coding agents. Each slide is a React component styled with Tailwind CSS, with built-in animations, presentation mode, and PDF export.

## Detect Mode

Check if a PromptSlide project already exists in the current directory:

```bash
grep -q '"promptslide"' package.json 2>/dev/null
```

- **Match found** → This is an existing PromptSlide project. Go to [Authoring Slides](#authoring-slides).
- **No match** → No project yet. Go to [Creating a New Deck](#creating-a-new-deck).

---

## Creating a New Deck

### Step 1: Scaffold the project

```bash
bun create slides my-deck
cd my-deck
bun install
```

### Step 2: Start the dev server

```bash
bun run dev
```

This runs `promptslide studio` — the development server starts at http://localhost:5173 with hot module replacement. Slides update instantly as files are saved.

### Step 3: Configure branding

Edit `src/theme.ts`:

```ts
import type { ThemeConfig } from "promptslide"

export const theme: ThemeConfig = {
  name: "Your Company",
  logo: { full: "/logo.svg" },
}
```

Replace `public/logo.svg` with your company logo file.

### Step 4: Set theme color

Edit `src/globals.css` and change `--primary`:

```css
:root {
  --primary: oklch(0.55 0.2 250); /* Change hue for your brand */
}
.dark {
  --primary: oklch(0.6 0.2 250);
}
```

OKLCH format: `oklch(lightness chroma hue)` — hue 0=red, 60=yellow, 120=green, 250=blue, 300=purple.

For full theming details, see [references/theming-and-branding.md](references/theming-and-branding.md).

### Step 5: Create your slides

Remove the demo slides from `src/slides/` and clear `src/deck-config.ts`, then follow the authoring instructions below.

---

## Authoring Slides

### Quick Start

1. Create a file in `src/slides/` (e.g., `slide-market.tsx`)
2. Use `SlideLayoutCentered` as the wrapper component
3. Register it in `src/deck-config.ts`

```tsx
// src/slides/slide-market.tsx
import type { SlideProps } from "promptslide"
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

export function SlideMarket({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="MARKET OPPORTUNITY"
      title="$50B Total Addressable Market"
    >
      <div className="flex h-full flex-col justify-center">
        <p className="text-muted-foreground text-lg">Your content here</p>
      </div>
    </SlideLayoutCentered>
  )
}
```

```ts
// src/deck-config.ts
import type { SlideConfig } from "promptslide"
import { SlideMarket } from "@/slides/slide-market"

export const slides: SlideConfig[] = [{ component: SlideMarket, steps: 0 }]
```

Vite hot-reloads — the new slide appears instantly in the browser.

### Architecture

```
src/
├── layouts/                      # Slide layouts (your "master theme" — create freely)
│   └── slide-layout-centered.tsx # Default layout with header + footer
├── slides/            # YOUR SLIDES GO HERE
├── theme.ts           # Theme config (brand name, logo, colors, fonts)
├── deck-config.ts     # Slide order + step counts (modify this)
├── App.tsx            # Theme provider
└── globals.css        # Theme colors

promptslide (CLI)      # Dev server, build, preview (owns Vite config)
promptslide      # Slide engine (npm package — stable, upgradeable)
```

### SlideLayoutCentered API

Every slide wraps its content in `SlideLayoutCentered`:

```tsx
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"
;<SlideLayoutCentered
  slideNumber={slideNumber}
  totalSlides={totalSlides}
  eyebrow="CATEGORY" // Optional: small label above title
  title="Slide Title" // Optional: main heading
  subtitle="Description" // Optional: subtitle text
  hideFooter // Optional: hide footer with logo + slide number
>
  {/* Your slide content */}
</SlideLayoutCentered>
```

Slide dimensions: **1280x720** (16:9). Design content for this size — it scales automatically in presentation mode.

### Step Animations (click-to-reveal)

Use `<Animated>` to reveal content on clicks:

```tsx
import { Animated } from "promptslide"

// Always visible (no wrapper needed)
<h2>Main Title</h2>

// Appears on first click
<Animated step={1} animation="fade">
  <p>First point</p>
</Animated>

// Appears on second click
<Animated step={2} animation="slide-up">
  <p>Second point</p>
</Animated>
```

**Animation types**: `fade`, `slide-up`, `slide-down`, `slide-left`, `slide-right`, `scale`

**AnimatedGroup** for staggered children:

```tsx
import { AnimatedGroup } from "promptslide"
;<AnimatedGroup startStep={1} animation="slide-up" staggerDelay={0.1}>
  <Card>First</Card>
  <Card>Second</Card>
  <Card>Third</Card>
</AnimatedGroup>
```

**Critical rule**: The `steps` value in `deck-config.ts` MUST equal the highest `step` number used in that slide's `<Animated>` components.

```ts
// If your slide uses step={1}, step={2}, step={3}:
{ component: MySlide, steps: 3 }

// If your slide has no animations:
{ component: MySlide, steps: 0 }
```

For full animation API (props tables, Morph system, config constants), see [references/animation-api.md](references/animation-api.md).

### Deck Configuration

`src/deck-config.ts` controls slide order:

```ts
import type { SlideConfig } from "promptslide"

export const slides: SlideConfig[] = [
  { component: SlideTitle, steps: 0 },
  { component: SlideProblem, steps: 3 },
  { component: SlideSolution, steps: 0 }
]
```

Optional metadata fields:

```ts
{
  component: SlideProblem,
  steps: 2,
  title: "The Problem",           // Grid view labels, navigation
  section: "Introduction",        // Chapter grouping in grid view
  transition: "zoom",             // Per-slide transition override
  notes: "Talk about market gap", // Speaker notes (future)
}
```

- **Add a slide**: Import component, append to array
- **Remove a slide**: Remove from array
- **Reorder slides**: Change position in array

### Slide Transitions

The `SlideDeck` component accepts a `transition` prop in `src/App.tsx`:

```tsx
<SlideDeck slides={slides} transition="slide-left" directionalTransition />
```

Options: `fade` (default), `slide-left`, `slide-right`, `slide-up`, `slide-down`, `zoom`, `zoom-fade`, `none`

Per-slide transitions can be set via the `transition` field on individual slide configs in `deck-config.ts`.

### Design Essentials

- Use `flex h-full` on content containers to fill available space
- Pass layout classes to `<Animated className="...">` to preserve flex/grid layout
- Semantic color classes: `text-foreground`, `text-muted-foreground`, `text-primary`, `bg-background`, `bg-card`, `border-border`
- Icons: Import from `lucide-react` — 1000+ icons available (e.g., `import { ArrowRight, CheckCircle } from "lucide-react"`)

For layout patterns, design recipes, and creating custom layouts (master themes), see [references/slide-patterns.md](references/slide-patterns.md).

### Visual Diversity Guidelines

When creating a deck with multiple slides, **vary the visual treatment across slides**. Do not repeat the same layout pattern on consecutive slides.

**Rotate backgrounds:** Not every slide needs a plain `bg-background`. Use:

- Gradient mesh backgrounds (layered blurred gradient orbs)
- Split backgrounds (solid primary on one side, content on the other)
- Subtle radial spotlights

**Vary card styles:** Do NOT use `rounded-xl border border-border bg-card` on every slide. Alternate between:

- Glass panels: `rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md`
- Gradient cards: `bg-gradient-to-br from-primary/15 to-transparent border border-primary/10`
- Elevated cards: `shadow-xl shadow-primary/10` (shadow instead of border)
- Accent-border cards: `border-l-4 border-l-primary`
- No cards at all — use large typography, progress bars, or data visualizations directly

**Use different animations on different slides:**

- `fade` for quotes, images, subtle reveals
- `slide-left` / `slide-right` for split-screen content entering from edges
- `scale` for hero elements and card grids
- `slide-up` for sequential list items or stat metrics
- `AnimatedGroup` for grids/collections (preferred over manual stagger delays)

**Layout variety:** Do not make every slide a 3-column equal grid. Use:

- Asymmetric splits (`grid-cols-5` with `col-span-2` + `col-span-3`)
- Bento grids with mixed tile sizes (`col-span-2`, `row-span-2`)
- Vertical timelines with alternating left/right content
- Full-width typography-driven layouts (where text IS the visual)
- Side-by-side comparisons with contrasting panel styles

### Keyboard Shortcuts

| Key            | Action                                    |
| -------------- | ----------------------------------------- |
| `→` or `Space` | Advance (next step or next slide)         |
| `←`            | Go back (previous step or previous slide) |
| `F`            | Toggle fullscreen presentation mode       |
| `G`            | Toggle grid view                          |
| `Escape`       | Exit fullscreen                           |

### View Modes

1. **Slide view** (default): Single slide with navigation controls
2. **Grid view**: Thumbnail overview — click any slide to jump to it
3. **List view**: Vertical scroll — optimized for PDF export via browser print

### Slide Templates

Reference templates are available in `assets/templates/` — each demonstrates a distinct visual style:

- `slide-hero-gradient.tsx` — Gradient mesh background with glow orbs, large title, accent line (`scale` + `fade`)
- `slide-split-screen.tsx` — Asymmetric 2/5 + 3/5 split with solid primary panel (`slide-right` + `slide-left`)
- `slide-glassmorphism.tsx` — Frosted glass cards on gradient background (`AnimatedGroup` + `scale`)
- `slide-big-number.tsx` — Large metrics with gradient progress bars (`slide-up` per metric)
- `slide-timeline-vertical.tsx` — Vertical timeline with center line, alternating sides (`fade`)
- `slide-comparison.tsx` — Before/After contrasting panels with VS badge (`slide-right` + `slide-left`)
- `slide-bento-grid.tsx` — Mixed-size tiles in a CSS grid (`AnimatedGroup` + `slide-down`)
- `slide-quote.tsx` — Large decorative quotation mark with attribution (`fade`)
