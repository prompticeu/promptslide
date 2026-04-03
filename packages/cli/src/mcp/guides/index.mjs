/**
 * Guide content for the get_guide MCP tool.
 *
 * Two guides:
 * - "framework" — comprehensive reference for the slide format, animations,
 *   layouts, theming, PDF constraints, and workflow. Read once at the start.
 * - "design-recipes" — PDF-safe code snippets for backgrounds, card styles,
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
import { ContentLayout } from "@/layouts/content"

export const meta = { steps: 2 }

export default function Hero({ slideNumber, totalSlides }) {
  return (
    <ContentLayout slideNumber={slideNumber} totalSlides={totalSlides}>
      <h1 className="text-7xl font-bold text-foreground">Title</h1>
      <Animated step={1} animation="fade">
        <p className="mt-4 text-xl text-muted-foreground">Subtitle appears on click</p>
      </Animated>
      <Animated step={2} animation="slide-up">
        <p className="mt-2 text-lg text-muted-foreground">More content</p>
      </Animated>
    </ContentLayout>
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
│   ├── layouts/           # Layout components (2-4 per deck)
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

**Critical**: \`<Animated>\` renders a wrapper \`<div>\`. When inside a **grid or flex container**, pass layout classes (\`h-full\`, \`w-full\`, \`col-span-*\`) via \`className\` on the \`<Animated>\`, not only on the inner child — otherwise the wrapper collapses and breaks the layout.

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

## Layouts

Layouts are React components in \`src/layouts/\` that wrap slide content. They control
structure (headers, footers, backgrounds, padding) — like "master slides" in traditional tools.

**Create 2–4 layouts per deck for visual variety.** Don't use a single layout for every slide.

### Example: Content Layout

\`\`\`tsx
// src/layouts/content.tsx
import { SlideFooter } from "promptslide"

export function ContentLayout({ children, slideNumber, totalSlides }) {
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

### Example: Title Layout

\`\`\`tsx
// src/layouts/title.tsx
export function TitleLayout({ children }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground">
      <div className="max-w-4xl text-center px-16">
        {children}
      </div>
    </div>
  )
}
\`\`\`

### Example: Sidebar Layout

\`\`\`tsx
// src/layouts/sidebar.tsx
export function SidebarLayout({ sidebar, children, slideNumber, totalSlides }) {
  return (
    <div className="flex h-full w-full bg-background">
      <div className="w-1/4 flex flex-col justify-between bg-card px-8 py-10 border-r border-border">
        {sidebar}
        <span className="text-xs text-muted-foreground">{slideNumber} / {totalSlides}</span>
      </div>
      <div className="flex-1 px-16 py-12 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
\`\`\`

Slides without layouts are freeform (full 1280×720 container).

## Reusable Components

Create shared building blocks in \`src/components/\`:

\`\`\`tsx
// src/components/card.tsx — PDF-safe card (no blur or shadow)
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

## PDF Constraints

These rules ensure slides look identical on screen and in PDF export.
Violating them causes elements to **silently disappear** in exported PDFs:

- **NO blur**: \`backdrop-blur-*\` and \`blur-*\` are silently dropped by Chromium's PDF pipeline
- **NO gradients**: \`bg-gradient-to-*\` and radial gradients render inconsistently — use solid colors with opacity instead (e.g., \`bg-primary/5\`, \`bg-muted/20\`)
- **NO shadows**: \`shadow-sm\`, \`shadow-lg\`, \`shadow-xl\`, etc. do not export correctly — use borders or background tints instead (e.g., \`border border-border\`, \`bg-white/5\`)

**PDF-safe alternatives:**

| Instead of | Use |
|-----------|-----|
| \`backdrop-blur-md bg-white/10\` | \`bg-white/5 border border-white/10\` |
| \`bg-gradient-to-br from-primary/15\` | \`bg-primary/10\` |
| \`shadow-lg shadow-primary/10\` | \`border border-border\` |
| \`blur-3xl bg-primary/10\` (blob) | \`bg-primary/5 rounded-full\` (solid, no blur) |

## Content Density

Slides are projected, not read. Enforce strict limits:

- **Title slides**: 1 heading + 1 subtitle (max 10 words). Optional logo or tagline.
- **Content slides**: 1 heading + 4–6 bullet points, OR 1 heading + 2–4 cards in a grid
- **Data slides**: 1 heading + 1 chart/table (max 6 rows)
- **Quote slides**: 1 quote (max 30 words) + attribution

**Split rule**: If you're writing a 7th bullet point, stop — create a second slide instead. Two clean slides always beat one cramped one.

## Design Thinking

Before writing slide code, plan the deck holistically:

- **Let content shape the layout.** A single important number → make it huge. A comparison → side by side. A feature list → maybe clean typography is enough, not everything needs cards.
- **Create rhythm.** Alternate dense and spacious, dark and light, structured and freeform. Three similar slides in a row is monotonous — break runs with a dark "breather" slide, a full-bleed color block, or an asymmetric layout.
- **Plan hero moments.** Every deck needs 1–2 slides that break the pattern — an oversized number, a bold color block, a single sentence with generous whitespace. These are what people remember.
- **Use color sparingly.** A primary-colored accent on every slide means none stand out. Save bold color for 3–4 key moments: the cover, a chapter divider, a key stat, the closing.
- **The "unforgettable" test**: If someone saw this deck for 10 seconds, what would they remember? If the answer is "nothing" — the design needs a stronger hero moment.

## Visual Anti-Patterns

Avoid these:

- Same card style (\`rounded-xl border bg-card p-8\`) on every slide
- Uniform icon-title-description grids on 3+ consecutive slides
- Centering everything — use left-aligned, asymmetric, or split layouts for variety
- Every heading the same size — vary with \`text-2xl\` to \`text-6xl\`
- \`slide-up\` animation on everything — match animation to content (see design-recipes guide)
- Using primary color on every element — save it for impact

## Style Presets

Use these as mood inspiration when starting a new deck:

| Preset | Mood | Primary | Key Feature |
|--------|------|---------|-------------|
| Electric Noir | Cinematic dark | \`oklch(0.65 0.25 250)\` blue | Oversized numbers, high contrast |
| Midnight Studio | Warm editorial | \`oklch(0.7 0.18 70)\` amber | Serif/sans contrast, elegant |
| Neon Terminal | Hacker/dev | \`oklch(0.75 0.2 145)\` green | Monospace, terminal aesthetic |
| Clean Corporate | Professional | \`oklch(0.5 0.2 250)\` blue | Generous whitespace, data-focused |
| Warm Editorial | Magazine | \`oklch(0.55 0.15 30)\` terracotta | Asymmetric text, pull quotes |
| Pastel Soft | Friendly | \`oklch(0.6 0.15 280)\` purple | Tinted card backgrounds, playful |
| Grid Rational | Bauhaus/Swiss | \`oklch(0.6 0.25 30)\` red | Bold color blocks, geometric |
| Deep Night | Polished dark | \`oklch(0.65 0.22 280)\` purple | Layered opacity cards |

## Theming

Theme variables are in \`src/globals.css\`. Customize by editing CSS variables:

\`\`\`css
:root { --primary: oklch(0.55 0.2 250); }
.dark { --primary: oklch(0.6 0.2 250); }
\`\`\`

OKLCH: \`oklch(lightness chroma hue)\` — lightness 0-1, chroma 0-0.4, hue 0-360

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

## Troubleshooting

- **get_build_errors** — check for Vite compilation errors and dev server issues
- **validate_deck** — render every slide and report per-slide status
- **get_project_files** — list all files in the deck directory

Common issues:
- Import errors (\`@/layouts/...\` path wrong) → check with get_build_errors
- Slide not rendering → validate_deck shows per-slide errors
- Animations not working → verify \`export const meta = { steps: N }\` matches highest step number
- Content clipped → check for missing \`overflow-hidden\` or wrong flex layout

## Workflow

1. create_deck → directory structure + deck.json + globals.css
2. write_layout × 2-4 → purpose-specific layouts (content, title, split, etc.)
3. write_component (optional) → reusable cards, stat blocks, etc.
4. create_slide × N → slides importing different layouts
5. get_screenshot / get_deck_overview → verify visuals
6. get_build_errors → check for compilation issues
7. edit_slide / write_slide → iterate
8. validate_deck → verify all slides render
9. export_pdf → generate a shareable deck artifact`,

  "design-recipes": `# Design Recipes

Ready-to-use TSX snippets for visually diverse slides.
All recipes are **PDF-export safe** — no gradients, no blur, no box-shadow.
Do not repeat the same pattern on consecutive slides.

## Background Treatments

### Layered Opacity

\`\`\`tsx
<div className="absolute inset-0 bg-primary/5" />
<div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10" />
<div className="absolute bottom-1/4 right-10 h-64 w-64 rounded-full bg-primary/5" />
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

### Solid Accent Block

\`\`\`tsx
<div className="absolute inset-0 bg-primary/5" />
<div className="absolute top-0 left-0 w-full h-1/3 bg-primary/10" />
<div className="relative z-10">Content here</div>
\`\`\`

## Card Styles

### Frosted (PDF-safe)

\`\`\`tsx
<div className="rounded-2xl border border-white/10 bg-white/5 p-8">
\`\`\`

### Tinted

\`\`\`tsx
<div className="rounded-2xl border border-primary/10 bg-primary/10 p-8">
\`\`\`

### Bordered

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
  <Animated step={1} animation="scale" className="col-span-2">
    <div className="h-full rounded-2xl bg-primary/10 p-8">Wide tile</div>
  </Animated>
  <Animated step={1} animation="scale" delay={0.1} className="row-span-2">
    <div className="h-full rounded-2xl border border-border bg-card p-6">Tall tile</div>
  </Animated>
  <Animated step={1} animation="scale" delay={0.2}>
    <div className="h-full rounded-2xl bg-muted/30 p-6">Small</div>
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
    <div className="mt-4 h-1 w-4/5 rounded-full bg-primary/30" />
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
- Two consecutive slides with same layout pattern
- Using blur, gradients, or shadows (breaks PDF export)`
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
