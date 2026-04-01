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

Slides are React/TSX components with Tailwind CSS. The framework provides
Animated, AnimatedGroup, Morph for animations, layout components for structure,
SlideDeck for navigation, and SlideThemeProvider for theming.

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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
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

## Visual Verification

**Always verify slides visually after creating or editing them.**

- **get_screenshot(slide)** — capture a single slide as PNG
- **get_deck_overview** — thumbnail grid of all slides

Common issues only visible in rendered output: broken alignment, wrong colors,
text overflow, content clipped by overflow-hidden.

## Workflow

1. create_deck → directory structure + deck.json + globals.css
2. write_layout × 1-2 → slide master layouts
3. write_component (optional) → reusable cards, stat blocks, etc.
4. create_slide × N → slides importing layouts and components
5. get_screenshot / get_deck_overview → verify visuals
6. edit_slide / write_slide → iterate
7. export_pdf (optional) → generate a shareable deck artifact`,

  "design-recipes": `# Design Recipes

Ready-to-use TSX snippets for visually diverse slides.
Do not repeat the same pattern on consecutive slides.

## Background Treatments

### Gradient Mesh
\`\`\`tsx
<div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
<div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
<div className="absolute bottom-1/4 right-10 h-64 w-64 rounded-full bg-primary/5 blur-2xl" />
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

### Radial Spotlight
\`\`\`tsx
<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--primary)_0%,_transparent_70%)] opacity-10" />
\`\`\`

## Card Styles

### Glass
\`\`\`tsx
<div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-primary/5 backdrop-blur-md">
\`\`\`

### Gradient
\`\`\`tsx
<div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/15 to-transparent p-8">
\`\`\`

### Elevated
\`\`\`tsx
<div className="rounded-2xl bg-card p-8 shadow-xl shadow-primary/10">
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
    <div className="col-span-2 rounded-2xl bg-gradient-to-br from-primary/15 to-transparent p-8">Wide tile</div>
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
          <div className="text-xs font-mono text-primary/60 mb-1">01</div>
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
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 shadow-lg shadow-primary/10">
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
    <div className="mt-4 h-1 w-4/5 rounded-full bg-gradient-to-r from-primary to-primary/30" />
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
  <div className="mx-auto mt-8 mb-6 h-px w-16 bg-primary/40" />
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
