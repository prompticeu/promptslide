# PowerVibe — Agent Documentation

This file documents the slide presentation framework for coding agents (Claude Code, Cursor, Windsurf, etc.). Read this before creating or modifying slides.

## Quick Start

To create a new slide:

1. Create a file in `src/slides/` (e.g., `src/slides/slide-market.tsx`)
2. Import components from `powervibe`
3. Add it to `deck.config.ts`

```tsx
// src/slides/slide-market.tsx
import { SlideLayout } from "powervibe"
import type { SlideProps } from "powervibe"

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
// deck.config.ts
import { defineConfig } from "powervibe"
import { SlideTitle } from "./src/slides/slide-title"
import { SlideMarket } from "./src/slides/slide-market"

export default defineConfig({
  branding: { name: "My Deck", logoUrl: "/logo.svg" },
  slides: [
    { component: SlideTitle, steps: 0 },
    { component: SlideMarket, steps: 0 },
  ],
})
```

Vite will hot-reload — the new slide appears instantly in the browser.

---

## Architecture

```
my-deck/
├── deck.config.ts          # Slides + branding (single config file)
├── theme.css               # Color customization
├── tsconfig.json
├── package.json            # "dev": "powervibe dev"
├── .gitignore
├── AGENTS.md               # This file
├── public/logo.svg
└── src/slides/
    ├── slide-title.tsx     # import { SlideLayout } from "powervibe"
    └── slide-example.tsx
```

All framework code lives in the `powervibe` npm package. You import everything from `"powervibe"`:

```tsx
import { SlideLayout, Animated, AnimatedGroup, Morph, cn } from "powervibe"
import type { SlideProps, SlideConfig } from "powervibe"
```

---

## Animation System

The framework provides three types of animations:

| Type | Purpose | Import |
|------|---------|--------|
| **Step Animations** | Within-slide reveal animations (click to reveal) | `Animated`, `AnimatedGroup` |
| **Morph Animations** | Shared element transitions across slides | `Morph`, `MorphGroup`, `MorphItem`, `MorphText` |
| **Slide Transitions** | Animations between slides (fade, slide, zoom) | Set in `deck.config.ts` |

---

## 1. SlideLayout Component

Every slide should use `SlideLayout` as its wrapper. It provides consistent padding, header, and footer.

```tsx
<SlideLayout
  slideNumber={slideNumber}
  totalSlides={totalSlides}
  eyebrow="CATEGORY"        // Optional small label above title
  title="Slide Title"       // Optional main heading
  subtitle="Description"    // Optional subtitle
  hideFooter               // Optional: hide footer with logo + slide number
>
  {/* Your slide content */}
</SlideLayout>
```

**Slide dimensions**: 1280x720 (16:9 aspect ratio). Design content for this size — it will be scaled to fit the viewport in presentation mode.

---

## 2. Step Animations (click-to-reveal)

Use `<Animated>` to reveal content on clicks:

```tsx
import { Animated } from "powervibe"

// Always visible content (no wrapper needed)
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

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `step` | number | required | Which click reveals this (1-indexed) |
| `animation` | AnimationType | `"slide-up"` | Animation style |
| `duration` | number | `0.4` | Duration in seconds |
| `delay` | number | `0` | Delay after trigger |
| `className` | string | — | Additional CSS classes |

### AnimatedGroup (staggered children)

```tsx
import { AnimatedGroup } from "powervibe"

<AnimatedGroup startStep={1} animation="slide-up" staggerDelay={0.1}>
  <Card>First</Card>
  <Card>Second</Card>
  <Card>Third</Card>
</AnimatedGroup>
```

### Step Count Rules

- Steps are **1-indexed** (step 1 = first click)
- Multiple elements can share the same step (appear together)
- **Critical**: The `steps` value in `deck.config.ts` must equal the highest step number used

```ts
// If your slide uses step={1} and step={2}:
{ component: MySlide, steps: 2 }

// If your slide has no animations:
{ component: MySlide, steps: 0 }
```

---

## 3. Morph Animations

Morph animations smoothly transition shared elements between consecutive slides.

```tsx
import { Morph, MorphText } from "powervibe"

// Slide 1 - Large version
<Morph layoutId="hero-title">
  <h1 className="text-6xl">Title</h1>
</Morph>

// Slide 2 - Small version (same layoutId = morphs between them)
<Morph layoutId="hero-title">
  <h1 className="text-2xl">Title</h1>
</Morph>
```

### MorphGroup + MorphItem

```tsx
import { MorphGroup, MorphItem } from "powervibe"

<MorphGroup groupId="card">
  <MorphItem id="icon"><Icon /></MorphItem>
  <MorphItem id="title"><h2>Title</h2></MorphItem>
</MorphGroup>
// Generates layoutIds: "card-icon", "card-title"
```

---

## 4. Deck Configuration (`deck.config.ts`)

This file controls everything about your deck:

```ts
import { defineConfig } from "powervibe"
import { SlideTitle } from "./src/slides/slide-title"
import { SlideProblem } from "./src/slides/slide-problem"

export default defineConfig({
  branding: { name: "Acme Inc", logoUrl: "/logo.svg" },
  transition: "slide-left",            // Optional: slide transition type
  directionalTransition: true,         // Optional: reverse on back navigation
  slides: [
    { component: SlideTitle, steps: 0 },
    { component: SlideProblem, steps: 2 },
  ],
})
```

**Available transitions**: `fade` (default), `slide-left`, `slide-right`, `slide-up`, `slide-down`, `zoom`, `zoom-fade`, `none`

### Managing slides

- **Add a slide**: Import it and add to the slides array
- **Remove a slide**: Remove from the array (keep the file if you want it later)
- **Reorder**: Change position in the array
- **The `steps` value** must match the highest `step` number in `<Animated>` components

---

## 5. Theme Customization (`theme.css`)

Colors use OKLCH format in CSS variables. Edit `theme.css` to change the theme.

**Change your brand color** by modifying `--primary`:

```css
:root {
  /* Blue brand (default) */
  --primary: oklch(0.55 0.2 250);

  /* Orange brand */
  /* --primary: oklch(0.661 0.201 41.38); */

  /* Green brand */
  /* --primary: oklch(0.6 0.2 145); */

  /* Purple brand */
  /* --primary: oklch(0.55 0.2 300); */
}
```

OKLCH format: `oklch(lightness chroma hue)`
- **Lightness**: 0 (black) to 1 (white)
- **Chroma**: 0 (gray) to ~0.4 (vivid)
- **Hue**: 0–360 (color wheel: 0=red, 120=green, 250=blue)

---

## 6. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` or `Space` | Advance (next step or next slide) |
| `←` | Go back (previous step or previous slide) |
| `F` | Toggle fullscreen presentation mode |
| `G` | Toggle grid view |
| `Escape` | Exit fullscreen |

---

## 7. View Modes

1. **Slide view** (default): Single slide with navigation controls
2. **Grid view**: Thumbnail overview — click any slide to jump to it
3. **List view**: Vertical scroll — optimized for PDF export via browser print

---

## 8. Design Best Practices

### Layout tips

- Use `flex h-full` on content containers to fill available space
- Use Tailwind's responsive classes (`md:`, `lg:`) for adaptive layouts
- Content should look good at 1280x720 — it's scaled in presentation mode

### Preserve layout with className

```tsx
// BAD — animation wrapper breaks flex centering
<div className="flex justify-center">
  <Animated step={1}>
    <Content />
  </Animated>
</div>

// GOOD — pass layout classes to Animated
<Animated step={1} className="flex justify-center">
  <Content />
</Animated>
```

### Color classes

Use semantic color classes from the theme:
- `text-foreground` — primary text
- `text-muted-foreground` — secondary text
- `text-primary` — brand color text
- `bg-background` — page background
- `bg-card` — card backgrounds
- `border-border` — borders

### Common patterns

**Two-column layout:**
```tsx
<div className="grid h-full grid-cols-2 gap-8">
  <div>{/* Left column */}</div>
  <div>{/* Right column */}</div>
</div>
```

**Stat cards:**
```tsx
<div className="grid grid-cols-3 gap-6">
  <div className="rounded-xl border border-border bg-card p-6">
    <div className="text-3xl font-bold text-primary">$10M</div>
    <div className="text-sm text-muted-foreground">Revenue</div>
  </div>
</div>
```

---

## 9. Available Icon Library

[Lucide React](https://lucide.dev) is included. Import icons directly:

```tsx
import { ArrowRight, CheckCircle, TrendingUp } from "lucide-react"

<TrendingUp className="h-6 w-6 text-primary" />
```

---

## 10. Animation Constants

Available from `powervibe`:

```ts
import {
  SLIDE_DIMENSIONS,        // { width: 1280, height: 720 }
  SPRING_SNAPPY,           // { stiffness: 300, damping: 30 }
  SPRING_SMOOTH,           // { stiffness: 200, damping: 25 }
  SPRING_BOUNCY,           // { stiffness: 400, damping: 20 }
} from "powervibe"
```

---

## 11. Updating PowerVibe

To get the latest framework features and fixes:

```sh
npm update powervibe
```

No need to re-scaffold — your slides stay exactly as they are.
