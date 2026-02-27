# PromptSlide — Agent Documentation

This file documents the slide presentation framework for coding agents (Claude Code, Cursor, Windsurf, etc.). Read this before creating or modifying slides.

## Quick Start

To create a new slide:

1. Create a file in `src/slides/` (e.g., `src/slides/slide-market.tsx`)
2. Import from `promptslide` and `@/layouts/slide-layout-centered`
3. Add it to `src/deck-config.ts`

```tsx
// src/slides/slide-market.tsx
import type { SlideProps } from "promptslide";
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered";

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
  );
}
```

```ts
// src/deck-config.ts
import type { SlideConfig } from "promptslide";
import { SlideTitle } from "@/slides/slide-title";
import { SlideMarket } from "@/slides/slide-market";

export const slides: SlideConfig[] = [
  { component: SlideTitle, steps: 0 },
  { component: SlideMarket, steps: 0 },
];
```

Vite will hot-reload — the new slide appears instantly in the browser.

---

## Architecture

```
src/
├── layouts/                      # Slide layouts (customizable)
│   └── slide-layout-centered.tsx # Base centered layout with header/footer
│
├── slides/                       # YOUR SLIDES GO HERE
│   └── slide-title.tsx           # Example starter slide
│
├── theme.ts                      # Theme config (brand, colors, fonts, assets)
├── deck-config.ts                # Slide order + step counts (modify this)
├── App.tsx                       # Root component (theme provider)
└── globals.css                   # Theme colors (customize here)

promptslide (npm package)          # CLI + slide engine — stable, upgradeable
├── Animated, AnimatedGroup       # Step animations (click-to-reveal)
├── Morph, MorphGroup, MorphItem  # Shared element transitions
├── SlideDeck                     # Presentation viewer/controller
├── SlideThemeProvider            # Theme context (colors, logos, fonts, assets)
├── useSlideNavigation            # Navigation state machine
├── SlideProps, SlideConfig       # TypeScript types
├── ThemeConfig                   # Theme configuration type
└── Layouts                       # ContentLayout, TitleLayout, SectionLayout,
                                  # TwoColumnLayout, ImageLayout, QuoteLayout
```

**Key principle**: The presentation engine and CLI live in `promptslide` (stable, upgradeable via npm). Layouts and slides are local files you customize freely.

---

## Animation System

The framework provides three types of animations:

| Type                  | Purpose                                          | Import                              |
| --------------------- | ------------------------------------------------ | ----------------------------------- |
| **Slide Transitions** | Animations between slides (fade, slide, zoom)    | `promptslide`                 |
| **Step Animations**   | Within-slide reveal animations (click to reveal) | `Animated` from `promptslide` |
| **Morph Animations**  | Shared element transitions across slides         | `Morph` from `promptslide`    |

---

## 1. SlideLayoutCentered Component

Every slide should use `SlideLayoutCentered` as its wrapper. It provides consistent padding, header, and footer.

```tsx
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered";

<SlideLayoutCentered
  slideNumber={slideNumber}
  totalSlides={totalSlides}
  eyebrow="CATEGORY" // Optional small label above title
  title="Slide Title" // Optional main heading
  subtitle="Description" // Optional subtitle
  hideFooter // Optional: hide footer with logo + slide number
>
  {/* Your slide content */}
</SlideLayoutCentered>;
```

**Slide dimensions**: 1280x720 (16:9 aspect ratio). Design content for this size — it will be scaled to fit the viewport in presentation mode.

---

## 2. Step Animations (click-to-reveal)

Use `<Animated>` to reveal content on clicks:

```tsx
import { Animated } from "promptslide"

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
import { AnimatedGroup } from "promptslide";

<AnimatedGroup startStep={1} animation="slide-up" staggerDelay={0.1}>
  <Card>First</Card>
  <Card>Second</Card>
  <Card>Third</Card>
</AnimatedGroup>;
```

### Step Count Rules

- Steps are **1-indexed** (step 1 = first click)
- Multiple elements can share the same step (appear together)
- **Critical**: The `steps` value in `deck-config.ts` must equal the highest step number used

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
import { Morph, MorphText } from "promptslide"

// Slide 1 - Large version
<Morph layoutId="hero-title">
  <h1 className="text-6xl">Title</h1>
</Morph>

// Slide 2 - Small version (same layoutId = morphs between them)
<Morph layoutId="hero-title">
  <h1 className="text-2xl">Title</h1>
</Morph>
```

**Note**: Morph is currently disabled in fullscreen presentation mode due to CSS transform conflicts with Framer Motion's layoutId calculations.

### MorphGroup + MorphItem

```tsx
import { MorphGroup, MorphItem } from "promptslide";

<MorphGroup groupId="card">
  <MorphItem id="icon">
    <Icon />
  </MorphItem>
  <MorphItem id="title">
    <h2>Title</h2>
  </MorphItem>
</MorphGroup>;
// Generates layoutIds: "card-icon", "card-title"
```

---

## 4. Deck Configuration (`deck-config.ts`)

This file controls which slides appear and in what order.

```ts
import type { SlideConfig } from "promptslide";
import { SlideTitle } from "@/slides/slide-title";
import { SlideProblem } from "@/slides/slide-problem";
import { SlideSolution } from "@/slides/slide-solution";

export const slides: SlideConfig[] = [
  { component: SlideTitle, steps: 0 },
  { component: SlideProblem, steps: 2 }, // Has 2 click-to-reveal steps
  { component: SlideSolution, steps: 0 },
];
```

### Enriched SlideConfig (optional)

Each slide config supports optional metadata fields:

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

### Managing slides

- **Add a slide**: Import it and add to the array
- **Remove a slide**: Remove from the array (keep the file if you want it later)
- **Reorder**: Change position in the array
- **The `steps` value** must match the highest `step` number in `<Animated>` components

---

## 5. Theme Customization (`globals.css`)

Colors use OKLCH format in CSS variables. Edit `src/globals.css` to change the theme.

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

## 6. Theme & Branding (`theme.ts`)

Configure your brand identity in `src/theme.ts`:

```ts
import type { ThemeConfig } from "promptslide";

export const theme: ThemeConfig = {
  name: "Acme Inc",
  logo: {
    full: "/logo.svg",            // Footer logo
    icon: "/icon.svg",            // Compact variant (title slides)
    fullLight: "/logo-white.svg", // For dark backgrounds
  },
  colors: {
    primary: "oklch(0.55 0.2 250)",
  },
  fonts: {
    heading: "Inter",
    body: "Inter",
  },
};
```

Everything is optional except `name`. Omitted values fall back to `globals.css` defaults. Logo files go in `public/`.

---

## 7. Slide Transitions

The `SlideDeck` component accepts a `transition` prop:

```tsx
<SlideDeck
  slides={slides}
  transition="slide-left" // Transition type
  directionalTransition={true} // Reverse on back navigation
/>
```

**Available transitions**: `fade` (default), `slide-left`, `slide-right`, `slide-up`, `slide-down`, `zoom`, `zoom-fade`, `none`

Per-slide transitions can also be set in `deck-config.ts` via the `transition` field on individual slide configs.

---

## 8. Keyboard Shortcuts

| Key            | Action                                    |
| -------------- | ----------------------------------------- |
| `→` or `Space` | Advance (next step or next slide)         |
| `←`            | Go back (previous step or previous slide) |
| `F`            | Toggle fullscreen presentation mode       |
| `G`            | Toggle grid view                          |
| `Escape`       | Exit fullscreen                           |

---

## 9. View Modes

1. **Slide view** (default): Single slide with navigation controls
2. **Grid view**: Thumbnail overview — click any slide to jump to it
3. **List view**: Vertical scroll — optimized for PDF export via browser print

---

## 10. Design Best Practices

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

### Visual Variety Checklist

Before generating a multi-slide deck, plan visual diversity. Aim for:

- At least 2 different background treatments across the deck (plain, gradient mesh, split solid, spotlight)
- At least 2 different card/panel styles (not all `rounded-xl border border-border bg-card`)
- At least 3 different animation types used (not all `slide-up`)
- At least 1 slide using `AnimatedGroup` instead of manual `Animated` stagger
- At least 1 asymmetric layout (not all equal-column grids)
- At least 1 typography-driven slide (where text IS the visual, no cards)
- No two consecutive slides using the same layout pattern

### Layout & Card Recipes

Refer to `references/slide-patterns.md` for ready-to-use recipes including:

- **Backgrounds:** Gradient mesh, split screen, spotlight vignette
- **Card styles:** Glass (`backdrop-blur-md`), gradient, elevated (shadow), accent-border
- **Layouts:** Bento grid, vertical timeline, comparison/before-after, asymmetric columns
- **Data viz:** Big numbers + progress bars, CSS bar charts, SVG donut rings
- **Typography:** Large quotes, headline-only with accent word

### Animation Selection Guide

Match animation types to layout styles:

| Layout       | Animation                    | Why                       |
| ------------ | ---------------------------- | ------------------------- |
| Hero/Title   | `scale` or `fade`            | Dramatic, non-directional |
| Split Screen | `slide-right` + `slide-left` | Panels enter from edges   |
| Card Grids   | `AnimatedGroup` + `scale`    | Uniform pop-in            |
| Timeline     | `fade`                       | Clean, no movement        |
| Comparison   | `slide-right` + `slide-left` | Opposing directions       |
| Metrics      | `slide-up`                   | Vertical reveal           |
| Quote        | `fade`                       | Let words speak           |

**Prefer `AnimatedGroup`** over manually wrapping each child in `<Animated>` for grids and collections — it's cleaner and produces better stagger timing.

---

## 11. Animation Configuration Constants

From `promptslide`:

```ts
SLIDE_TRANSITION_DURATION = 0.3; // Between slides
MORPH_DURATION = 0.8; // Layout morphs
STEP_ANIMATION_DURATION = 0.4; // Within-slide steps
STAGGER_DELAY = 0.1; // Group stagger

SPRING_SNAPPY = { stiffness: 300, damping: 30 };
SPRING_SMOOTH = { stiffness: 200, damping: 25 };
SPRING_BOUNCY = { stiffness: 400, damping: 20 };

SLIDE_DIMENSIONS = { width: 1280, height: 720 };
```

---

## 12. Available Icon Library

[Lucide React](https://lucide.dev) is included. Import icons directly:

```tsx
import { ArrowRight, CheckCircle, TrendingUp } from "lucide-react";

<TrendingUp className="h-6 w-6 text-primary" />;
```
