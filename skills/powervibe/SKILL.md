---
name: powervibe
description: >-
  Creates and authors slide deck presentations using the PowerVibe framework
  (Vite + React 19 + Tailwind v4 + Framer Motion). Use when the user wants to
  create a new slide deck, add or edit slides, customize themes or branding,
  or work with slide animations and transitions. Triggers on mentions of slides,
  decks, presentations, PowerVibe, or slide-related tasks.
metadata:
  author: prompticeu
  version: "1.0"
---

# PowerVibe

Create beautiful slide decks with AI coding agents. Each slide is a React component styled with Tailwind CSS, with built-in animations, presentation mode, and PDF export.

## Detect Mode

Check if a PowerVibe project already exists in the current directory:

```bash
ls src/framework/types.ts 2>/dev/null
```

- **File exists** → This is an existing PowerVibe project. Go to [Authoring Slides](#authoring-slides).
- **File does not exist** → No project yet. Go to [Creating a New Deck](#creating-a-new-deck).

---

## Creating a New Deck

### Step 1: Scaffold the project

```bash
git clone https://github.com/prompticeu/powervibe.git my-deck
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

Reference templates are available in `assets/templates/` for common patterns:
- `slide-basic.tsx` — Minimal slide, no animations
- `slide-animated.tsx` — 3-column card grid with step animations
- `slide-title.tsx` — Centered hero/title slide
