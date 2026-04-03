/**
 * Guide content for the get_guide MCP tool.
 *
 * Two guides:
 * - "framework" — comprehensive reference for the slide format, animations,
 *   layouts, theming, and workflow. Read once at the start of a session.
 * - "design-recipes" — optional code snippets for backgrounds, card styles,
 *   layout patterns, data visualization, and typography.
 */

const guides = {
  framework: `# PromptSlide Framework Reference

Slides are React/TSX components with Tailwind CSS. PromptSlide is meant to be
used with design intent, not by repeating the same safe layout on every slide.

## Before You Start

Before writing any slide code, confirm the visual direction with the user:

1. Theme colors, logo, and fonts
2. Audience and deck tone
3. Whether the deck should feel editorial, brutalist, luxury-minimal, bold geometric, warm organic, or another distinct direction

Then think about what each slide's content wants to be. A hero stat, comparison,
timeline, quote, or dense information slide should not all look the same.

Share the design plan before coding when the deck direction is still open.

Present the design plan explicitly when the direction is still open:

1. overall visual direction and color strategy
2. layout approach for each slide, not just generic cards or grids
3. which slides should become hero moments
4. font choice and why it fits the deck's personality

## Content Density

Slides are projected, not read. Keep each slide focused:

- title slides: 1 heading + 1 subtitle
- content slides: 1 heading + 4-6 bullet points, or 2 short paragraphs, or 2-4 cards/items
- data slides: 1 heading + 1 chart/table/diagram
- quote slides: 1 quote + attribution

If a slide needs a 7th bullet point or a 3rd paragraph, split it into another slide.

## MCP-First Workflow

When the MCP server is available, use this workflow:

1. **inspect** the workspace or deck before editing
2. **show_tree** when you need the actual file structure
3. **read** and **search** the current slides, layouts, components, and themes
4. **apply** targeted file or manifest changes
5. **validate** the affected slide or deck before visual verification
6. **render** PNG, HTML, overview, or PDF output only after validation is clean

## Slide Format

Each slide is a \`.tsx\` file in \`src/slides/\` exporting a default React component:

\`\`\`tsx
import { Animated } from "promptslide"
import { MasterLayout } from "@/layouts/master"

export const meta = { steps: 2 }

export default function Hero({ slideNumber, totalSlides }) {
  return (
    <MasterLayout slideNumber={slideNumber} totalSlides={totalSlides}>
      <h1 className="text-7xl font-bold text-foreground">Title</h1>
      <Animated step={1} animation="fade">
        <p className="mt-4 text-xl text-muted-foreground">Subtitle appears on click</p>
      </Animated>
      <Animated step={2} animation="slide-up">
        <p className="mt-2 text-lg text-muted-foreground">More content</p>
      </Animated>
    </MasterLayout>
  )
}
\`\`\`

**Key rules:**
- Default export is the slide component
- \`export const meta = { steps: N }\` declares animation step count
- Props: \`{ slideNumber, totalSlides }\`
- Import layouts from \`@/layouts/...\`, components from \`@/components/...\`
- Import Animated, AnimatedGroup, Morph from \`"promptslide"\`

Slide dimensions: **1280×720** (16:9). Content scales automatically.

## Import Rules

Use import paths consistently:

- Use \`@/slides/...\`, \`@/layouts/...\`, and \`@/components/...\` for deck-local code under \`src/\`
- Use \`promptslide\` for framework exports like \`Animated\`, \`AnimatedGroup\`, \`Morph\`, \`SlideDeck\`, and \`SlideThemeProvider\`
- Use root-relative paths like \`/images/glow-white.png\` only for public/static browser assets

Do not add a custom \`tsconfig\` path alias for \`promptslide\`. It should resolve as a package import, not to a specific file path inside \`node_modules\`.

## Directory Structure

\`\`\`
my-deck/
├── deck.json              # Manifest (slide order, transitions)
├── src/
│   ├── slides/            # Slide TSX components
│   ├── layouts/           # Layout components (shared structure)
│   ├── components/        # Reusable components (cards, etc.)
│   ├── globals.css        # Tailwind CSS + theme variables
│   └── theme.ts           # Theme config (optional)
├── themes/                # Optional deck theme CSS files
├── assets/                # Images, logos, etc.
└── annotations.json       # Feedback/comments (optional)
\`\`\`

## Deck Manifest (deck.json)

\`\`\`json
{
  "name": "My Deck",
  "transition": "fade",
  "directionalTransition": true,
  "slides": [
    { "id": "hero", "section": "Introduction" },
    { "id": "problem", "section": "Introduction" },
    { "id": "solution" }
  ]
}
\`\`\`

The \`id\` maps to \`src/slides/slide-{id}.tsx\`. Steps are read from \`export const meta\`.

## Animations

### Click-to-Reveal (Animated)

\`\`\`tsx
import { Animated } from "promptslide"

<h1>Always visible</h1>
<Animated step={1} animation="fade">
  <p>Appears on 1st click</p>
</Animated>
<Animated step={2} animation="slide-up" delay={0.2}>
  <p>Appears on 2nd click with delay</p>
</Animated>
\`\`\`

Steps are 1-indexed. Multiple elements can share the same step.

Important layout rule: \`Animated\` renders a wrapper \`<div>\`. When it lives inside a grid or flex layout, put layout classes such as \`h-full\`, \`w-full\`, or \`col-span-*\` on the \`Animated\` wrapper itself or the layout can collapse.

### Animation Types

| Type | Effect |
|------|--------|
| \`fade\` | Fade in (opacity) |
| \`slide-up\` | Slide up + fade (default) |
| \`slide-down\` | Slide down + fade |
| \`slide-left\` | Slide from right + fade |
| \`slide-right\` | Slide from left + fade |
| \`scale\` | Scale up from 0.8 + fade |

### Stagger (AnimatedGroup)

\`\`\`tsx
import { AnimatedGroup } from "promptslide"

<AnimatedGroup startStep={1} animation="slide-up" staggerDelay={0.1}>
  <div>First</div>
  <div>Second</div>
  <div>Third</div>
</AnimatedGroup>
\`\`\`

### Cross-Slide Morph

\`\`\`tsx
import { Morph } from "promptslide"

// Slide 1
<Morph layoutId="hero-title"><h1 className="text-7xl">Title</h1></Morph>

// Slide 2 (same layoutId = morphs between them)
<Morph layoutId="hero-title"><h1 className="text-3xl">Title</h1></Morph>
\`\`\`

### Slide Transitions

Set in deck.json or per-slide via \`export const meta = { transition: "zoom" }\`:
\`fade\` (default), \`slide-left\`, \`slide-right\`, \`slide-up\`, \`slide-down\`,
\`zoom\`, \`zoom-fade\`, \`morph\`, \`none\`

## Slide Master Layouts

Layouts are React components that wrap slide content for consistent structure.

\`\`\`tsx
// src/layouts/master.tsx
import { SlideFooter } from "promptslide"

export function MasterLayout({ children, slideNumber, totalSlides }) {
  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex-1 px-20 py-12 overflow-hidden">
        {children}
      </div>
      <div className="flex items-center justify-between px-20 py-4 border-t border-border">
        <img src="/assets/logo.svg" className="h-6" />
        <span className="text-xs text-muted-foreground">
          {slideNumber} / {totalSlides}
        </span>
      </div>
    </div>
  )
}
\`\`\`

Used in slides:
\`\`\`tsx
import { MasterLayout } from "@/layouts/master"

export default function Problem({ slideNumber, totalSlides }) {
  return (
    <MasterLayout slideNumber={slideNumber} totalSlides={totalSlides}>
      <h2 className="text-4xl font-bold">The Problem</h2>
      <p className="mt-4 text-xl text-muted-foreground">Description...</p>
    </MasterLayout>
  )
}
\`\`\`

### Example: Split Layout

\`\`\`tsx
// src/layouts/split.tsx
export function SplitLayout({ left, right, slideNumber, totalSlides }) {
  return (
    <div className="flex h-full w-full bg-background">
      <div className="w-2/5 flex flex-col justify-center px-16 border-r border-border">
        {left}
      </div>
      <div className="w-3/5 flex flex-col justify-center px-16">
        {right}
      </div>
    </div>
  )
}
\`\`\`

Slides without layouts are freeform (full 1280×720 container).

## Reusable Components

Create shared building blocks in \`src/components/\`:

\`\`\`tsx
// src/components/card.tsx
export function Card({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
      {icon && <span className="text-2xl">{icon}</span>}
      <h3 className="mt-3 text-lg font-semibold text-foreground">{title}</h3>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}
\`\`\`

Use in slides:
\`\`\`tsx
import { Card } from "@/components/card"

<div className="grid grid-cols-3 gap-6">
  {features.map((f, i) => (
    <Animated key={f.title} step={1} animation="scale" delay={i * 0.1}>
      <Card title={f.title} icon={f.icon}>{f.desc}</Card>
    </Animated>
  ))}
</div>
\`\`\`

## Theming

Theme variables are in \`src/globals.css\`. The default theme includes Tailwind
import and color mappings. Customize by editing CSS variables:

\`\`\`css
:root { --primary: oklch(0.55 0.2 250); }
.dark { --primary: oklch(0.6 0.2 250); }
\`\`\`

OKLCH: \`oklch(lightness chroma hue)\` — lightness 0-1, chroma 0-0.4, hue 0-360

| Brand | Light | Dark | Hue |
|-------|-------|------|-----|
| Blue | oklch(0.55 0.2 250) | oklch(0.6 0.2 250) | 250 |
| Purple | oklch(0.55 0.2 300) | oklch(0.6 0.2 300) | 300 |
| Green | oklch(0.6 0.2 145) | oklch(0.65 0.2 145) | 145 |
| Orange | oklch(0.661 0.201 41) | oklch(0.7 0.2 41) | 41 |
| Teal | oklch(0.6 0.15 195) | oklch(0.65 0.15 195) | 195 |

### Semantic Color Classes

- \`text-foreground\` / \`text-muted-foreground\` / \`text-primary\`
- \`bg-background\` / \`bg-card\` / \`bg-primary\` / \`bg-primary/10\`
- \`border-border\`

Choose fonts that fit the deck's personality. Avoid defaulting to the first familiar sans-serif unless the brand requires it. Serif headings plus sans body can feel editorial; sans for both can feel modern and restrained.

## PDF Compatibility Constraints

Use these constraints when designing slides that will be rendered or exported:

- **No blur**: \`filter: blur()\` and \`backdrop-filter\` are dropped by Chromium's PDF pipeline
- **No gradients**: use solid colors with opacity instead of CSS gradients
- **No shadows**: use borders and layered background tints instead of \`box-shadow\`

If you want a soft radial glow effect on dark slides, use a PNG overlay instead of CSS blur or gradients:

\`\`\`tsx
<img
  src="/images/glow-white.png"
  alt=""
  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
/>
\`\`\`

Adjust the opacity to control intensity. This keeps the effect PDF-safe.

## Visual Verification

**Always validate before rendering when a slide might be broken.**

- **validate { scope: "slide", slide: "hero", include_runtime: true }** — catch import failures, step mismatches, and recent runtime errors
- **render { format: "png", slide: "hero" }** — capture a single slide as PNG
- **render { format: "overview" }** — thumbnail grid of all slides in a deck
- **render { format: "pdf" }** — export the full deck as a PDF

Common issues only visible in rendered output: broken alignment, wrong colors,
text overflow, content clipped by overflow-hidden. When rendering fails, inspect validation diagnostics first instead of retrying screenshots blindly.

## Design Principles

- Let the content shape the layout.
- Create rhythm across the deck by alternating dense and spacious slides.
- Use visual variety intentionally, not mechanically.
- Reserve bold color and oversized typography for a few memorable hero moments.

## Anti-Patterns

- same card style on every slide
- uniform icon-title-description grids across consecutive slides
- centering everything
- every heading using the same size and weight
- generic default accent choices without regard to brand or mood

## Workflow

1. inspect the workspace or deck to understand the current semantics and runtime state
2. show_tree when you need the actual file structure
3. read and search the existing slides, layouts, and components before editing
4. apply file or manifest changes for new slides, layouts, components, or deck metadata
5. validate the affected deck or slide to catch structural and runtime problems early
6. render PNG or HTML output to verify visuals and final DOM
7. render PDF only after deck-level validation is clean

This is the intended clean tool surface for PromptSlide MCP agents.`,

  "design-recipes": `# Design Recipes

Ready-to-use TSX snippets for visually diverse slides.
Do not repeat the same pattern on consecutive slides.

All recipes below are intended to stay compatible with PDF export:

- no CSS gradients
- no blur or backdrop blur
- no box shadows
- prefer borders, opacity layers, and image overlays for depth

## Background Treatments

### Glow Image Overlay
\`\`\`tsx
<img
  src="/images/glow-white.png"
  alt=""
  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
/>
<div className="relative z-10">Content here</div>
\`\`\`

### Split Background
\`\`\`tsx
<div className="absolute inset-y-0 left-0 w-2/5 bg-primary" />
<div className="relative flex h-full">
  <div className="w-2/5 flex flex-col justify-center px-12">
    <h2 className="text-5xl font-bold text-primary-foreground">Statement</h2>
  </div>
  <div className="w-3/5 flex flex-col justify-center px-12">Content</div>
</div>
\`\`\`

### Soft Layered Tint
\`\`\`tsx
<div className="absolute inset-0 bg-background" />
<div className="absolute inset-x-0 top-0 h-64 bg-primary/8" />
<div className="absolute inset-y-0 right-0 w-1/3 bg-white/5" />
\`\`\`

## Card Styles

### Frosted Without Blur
\`\`\`tsx
<div className="rounded-2xl border border-white/10 bg-white/5 p-8">
\`\`\`

### Tinted Panel
\`\`\`tsx
<div className="rounded-2xl border border-primary/20 bg-primary/8 p-8">
\`\`\`

### Layered Panel
\`\`\`tsx
<div className="rounded-2xl border border-border bg-card p-8">
\`\`\`

### Accent Border
\`\`\`tsx
<div className="rounded-2xl border border-border border-l-4 border-l-primary bg-card p-8">
\`\`\`

## Layout Patterns

### Bento Grid
\`\`\`tsx
<div className="grid h-full grid-cols-3 grid-rows-2 gap-4">
  <Animated step={1} animation="scale">
    <div className="col-span-2 rounded-2xl border border-primary/20 bg-primary/8 p-8">Wide tile</div>
  </Animated>
  <Animated step={1} animation="scale" delay={0.1}>
    <div className="row-span-2 rounded-2xl border border-border bg-card p-6">Tall tile</div>
  </Animated>
  <Animated step={1} animation="scale" delay={0.2}>
    <div className="rounded-2xl bg-muted/30 p-6">Small</div>
  </Animated>
</div>
\`\`\`

### Vertical Timeline
\`\`\`tsx
<div className="relative flex h-full items-center justify-center">
  <div className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-border" />
  <div className="relative w-full max-w-4xl space-y-8">
    <Animated step={1} animation="fade">
      <div className="relative flex items-center">
        <div className="absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background" />
        <div className="w-1/2 pr-12 text-right">
          <div className="mb-1 text-xs font-mono text-primary/60">01</div>
          <h3 className="text-lg font-semibold text-foreground">Step One</h3>
        </div>
      </div>
    </Animated>
  </div>
</div>
\`\`\`

### Comparison / Before-After
\`\`\`tsx
<div className="relative flex h-full items-center">
  <div className="grid w-full grid-cols-2 gap-8">
    <Animated step={1} animation="slide-right">
      <div className="rounded-2xl border border-border bg-muted/30 p-8">
        <h3 className="mb-6 text-lg font-semibold text-muted-foreground">The Old Way</h3>
      </div>
    </Animated>
    <Animated step={2} animation="slide-left">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8">
        <h3 className="mb-6 text-lg font-semibold text-primary">The New Way</h3>
      </div>
    </Animated>
  </div>
</div>
\`\`\`

## Data Visualization

### Big Numbers + Progress Bars
\`\`\`tsx
<AnimatedGroup startStep={1} animation="slide-up" staggerDelay={0.1} className="grid grid-cols-3 gap-10">
  <div>
    <div className="text-6xl font-bold tracking-tight text-primary">$10M</div>
    <div className="mt-4 h-1 w-4/5 rounded-full bg-primary/20">
      <div className="h-full w-4/5 rounded-full bg-primary" />
    </div>
    <div className="mt-3 text-lg font-semibold text-foreground">Revenue</div>
    <div className="text-sm text-muted-foreground">Annual recurring</div>
  </div>
</AnimatedGroup>
\`\`\`

### CSS Bar Chart
\`\`\`tsx
<div className="flex h-48 items-end gap-4">
  <div className="flex w-16 flex-col items-center gap-2">
    <div className="w-full rounded-t-lg bg-primary/80" style={{ height: "80%" }} />
    <span className="text-xs text-muted-foreground">Q1</span>
  </div>
</div>
\`\`\`

## Typography

### Large Quote
\`\`\`tsx
<div className="flex h-full flex-col items-center justify-center text-center">
  <span className="block font-serif text-[120px] leading-none text-primary/20">&ldquo;</span>
  <Animated step={1} animation="fade">
    <p className="-mt-10 max-w-4xl text-3xl font-light leading-relaxed italic text-foreground">
      Quote text here.
    </p>
  </Animated>
  <div className="mx-auto mb-6 mt-8 h-px w-16 bg-primary/40" />
  <div className="text-lg font-semibold text-foreground">Speaker Name</div>
</div>
\`\`\`

## Typography Scale

- Hero: \`text-6xl\` to \`text-8xl\`, \`font-bold\`, \`tracking-tight\`
- Section: \`text-3xl\` to \`text-5xl\`
- Body: \`text-lg\` to \`text-xl\`, \`text-muted-foreground\`
- Eyebrow: \`text-xs font-bold tracking-[0.2em] text-primary uppercase\`
- Stats: \`text-5xl font-bold text-primary\`

## Animation Matching

| Layout | Animation | Why |
|--------|----------|-----|
| Hero/Title | \`scale\` or \`fade\` | Dramatic, non-directional |
| Split Screen | \`slide-right\` + \`slide-left\` | Panels from edges |
| Card Grid | \`AnimatedGroup\` + \`scale\` | Uniform pop-in |
| Timeline | \`fade\` | Clean, no movement |
| Comparison | \`slide-right\` + \`slide-left\` | Opposing directions |
| Metrics | \`slide-up\` | Vertical reveal |
| Quote | \`fade\` | Let words speak |

## Anti-Patterns

- Same card style on every slide
- \`slide-up\` on everything
- All equal-width columns
- Two consecutive slides with same layout pattern`
}

/**
 * Get guide content by topic.
 *
 * @param {string} topic
 * @returns {string}
 */
export function getGuideContent(topic) {
  return guides[topic] || `Unknown guide topic: "${topic}". Available: ${Object.keys(guides).join(", ")}`
}
