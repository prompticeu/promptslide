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
  version: "1.0"
---

# PromptSlide

Create distinctive, production-grade slide decks with AI coding agents. Each slide is a React component styled with Tailwind CSS, with built-in animations, presentation mode, and PDF export. Every deck should feel intentionally designed — bold aesthetic choices, unexpected layouts, and memorable visual identity.

## Detect Mode

Check if a PromptSlide project already exists in the current directory:

```bash
ls src/framework/types.ts 2>/dev/null
```

- **File exists** → This is an existing PromptSlide project. Go to [Authoring Slides](#authoring-slides).
- **File does not exist** → No project yet. Go to [Creating a New Deck](#creating-a-new-deck).

---

## Creating a New Deck

### Step 1: Scaffold the project

```bash
git clone https://github.com/prompticeu/promptslide.git my-deck
cd my-deck
rm -rf .git
npm install
```

### Step 2: Start the dev server

```bash
npm run dev
```

Vite starts at http://localhost:5173 with hot module replacement. Slides update instantly as files are saved.

### Step 3: Configure branding

Edit `src/App.tsx`:

```tsx
<SlideBrandingProvider branding={{ name: "Your Company", logoUrl: "/logo.svg" }}>
  <SlideDeck slides={slides} />
</SlideBrandingProvider>
```

Replace `public/logo.svg` with your company logo file.

### Step 4: Set theme color

Edit `src/globals.css` and change `--primary`:

```css
:root {
  --primary: oklch(0.55 0.2 250);  /* Change hue for your brand */
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
2. Use `SlideLayout` as the wrapper component
3. Register it in `src/deck-config.ts`

```tsx
// src/slides/slide-market.tsx
import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

export function SlideMarket({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="MARKET OPPORTUNITY"
      title="$50B Total Addressable Market"
    >
      <div className="flex h-full flex-col justify-center">
        <p className="text-muted-foreground text-lg">Your content here</p>
      </div>
    </SlideLayout>
  )
}
```

```ts
// src/deck-config.ts
import type { SlideConfig } from "@/framework/types"
import { SlideMarket } from "@/slides/slide-market"

export const slides: SlideConfig[] = [
  { component: SlideMarket, steps: 0 },
]
```

Vite hot-reloads — the new slide appears instantly in the browser.

### Architecture

```
src/
├── framework/         # Slide engine — DO NOT MODIFY
├── components/
│   └── slide-deck.tsx # Main deck controller
├── slides/            # YOUR SLIDES GO HERE
├── deck-config.ts     # Slide order + step counts (modify this)
├── App.tsx            # Branding config
├── globals.css        # Theme colors
└── main.tsx           # Vite entry point
```

### SlideLayout API

Every slide wraps its content in `SlideLayout`:

```tsx
<SlideLayout
  slideNumber={slideNumber}
  totalSlides={totalSlides}
  eyebrow="CATEGORY"       // Optional: small label above title
  title="Slide Title"      // Optional: main heading
  subtitle="Description"   // Optional: subtitle text
  hideFooter               // Optional: hide footer with logo + slide number
>
  {/* Your slide content */}
</SlideLayout>
```

Slide dimensions: **1280x720** (16:9). Design content for this size — it scales automatically in presentation mode.

### Step Animations (click-to-reveal)

Use `<Animated>` to reveal content on clicks:

```tsx
import { Animated } from "@/framework/animated"

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
import { AnimatedGroup } from "@/framework/animated"

<AnimatedGroup startStep={1} animation="slide-up" staggerDelay={0.1}>
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
export const slides: SlideConfig[] = [
  { component: SlideTitle, steps: 0 },
  { component: SlideProblem, steps: 3 },
  { component: SlideSolution, steps: 0 },
]
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

### Design Essentials

- Use `flex h-full` on content containers to fill available space
- Pass layout classes to `<Animated className="...">` to preserve flex/grid layout
- Semantic color classes: `text-foreground`, `text-muted-foreground`, `text-primary`, `bg-background`, `bg-card`, `border-border`
- Icons: Import from `lucide-react` — 1000+ icons available (e.g., `import { ArrowRight, CheckCircle } from "lucide-react"`)

For layout patterns and design recipes, see [references/slide-patterns.md](references/slide-patterns.md).

### Design Philosophy

Before building slides, commit to a **bold aesthetic direction** for the deck. Every deck should feel intentionally designed, not assembled from a component library.

**Think before coding:**
- **Purpose**: What's the narrative arc? Who's the audience?
- **Tone**: Pick an extreme and own it — brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian. There are many flavors; design one true to the chosen direction.
- **Differentiation**: What makes this deck UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

### Frontend Aesthetics

- **Typography**: Choose fonts that are beautiful, unique, and characterful. Avoid generic fonts like Arial, Inter, Roboto, and system fonts. Pair a distinctive display font with a refined body font. Import from Google Fonts via `@import` in `globals.css`. Typography itself can be the visual — a 200px bold word needs no card around it.
- **Color & Theme**: Commit to a cohesive aesthetic. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Override the default OKLCH variables in `globals.css` to match the deck's personality — don't just use the default blue.
- **Motion**: Focus on high-impact moments. One well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions on every element. Not every element needs an `<Animated>` wrapper.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density — both work when intentional.
- **Backgrounds & Depth**: Create atmosphere rather than defaulting to solid `bg-background`. Use gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, grain overlays. The background sets the mood.

### What to Avoid

NEVER produce generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- The same purple/blue gradient on white that every AI tool produces
- Predictable 3-column card grids on every slide
- `rounded-xl border border-border bg-card p-8` as the default for everything
- `slide-up` animation on every element
- Cookie-cutter layouts that lack context-specific character
- Cards everywhere — some slides should have NO cards at all. Use large typography, data visualizations, full-bleed images, or negative space as the visual element.

**Every deck should look different.** Vary between light and dark themes, different font families, different aesthetic directions. Never converge on the same safe choices across decks.

### Visual Variety Within a Deck

Do not repeat the same layout pattern on consecutive slides. Mix these approaches:

**Backgrounds:** Gradient mesh orbs, split solid-color panels, radial spotlights, textured overlays, full-bleed color, or pure white/black.

**Content containers:** Glass panels (`backdrop-blur-md bg-white/5`), gradient fills, deep shadows (no border), thick accent borders, or no container at all.

**Animations:** Match to intent — `scale` for dramatic entrances, `fade` for letting words speak, `slide-left`/`slide-right` for panels entering from edges, `AnimatedGroup` for collections. Leave some slides with zero animation for contrast.

**Layouts:** Asymmetric splits, bento grids with mixed tile sizes, vertical timelines, full-width typography, overlapping elements, diagonal compositions. Not everything needs columns.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` or `Space` | Advance (next step or next slide) |
| `←` | Go back (previous step or previous slide) |
| `F` | Toggle fullscreen presentation mode |
| `G` | Toggle grid view |
| `Escape` | Exit fullscreen |

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
