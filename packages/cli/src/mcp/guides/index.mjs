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

Slides are HTML files with Tailwind CSS. The framework handles animations,
transitions, theming, keyboard navigation, and presentation mode.

## Slide Format

Each slide is a \`.html\` file in \`slides/\` containing a \`<section>\` element:

\`\`\`html
<section class="relative flex items-center justify-center overflow-hidden bg-background">
  <div class="text-center px-16">
    <h1 class="text-7xl font-bold text-foreground">Title</h1>
    <p class="mt-4 text-xl text-muted-foreground"
       data-step="1" data-animate="fade">
      Subtitle appears on click
    </p>
  </div>
</section>
\`\`\`

The framework auto-adds \`h-full\` to the root \`<section>\`.
Use \`flex items-center justify-center\` for vertical centering.
Use \`data-layout="name"\` to wrap in a slide master layout.

Slide dimensions: **1280×720** (16:9). Content scales automatically.

## Directory Structure

\`\`\`
my-deck/
├── deck.json           # Manifest (slide order, theme, transitions)
├── slides/             # Slide HTML files
├── layouts/            # Slide master templates
├── themes/             # CSS theme files
├── assets/             # Images, logos, etc.
└── annotations.json    # Feedback/comments (optional)
\`\`\`

## Deck Manifest (deck.json)

\`\`\`json
{
  "name": "My Deck",
  "slug": "my-deck",
  "theme": "default",
  "transition": "fade",
  "directionalTransition": true,
  "slides": [
    { "file": "hero.html" },
    { "file": "problem.html", "section": "Introduction" }
  ]
}
\`\`\`

Steps are auto-detected from HTML (highest data-step value). No manual counts.

## Data Attributes

**On <section>:**
- \`data-layout="name"\` — wrap in a slide master layout from layouts/
- \`data-transition="type"\` — per-slide transition override

**On any element:**
- \`data-step="N"\` — reveal on Nth click (1-indexed)
- \`data-animate="type"\` — animation type (fade, slide-up, slide-down, slide-left, slide-right, scale)
- \`data-delay="ms"\` — delay in milliseconds
- \`data-duration="ms"\` — animation duration in milliseconds
- \`data-stagger="ms"\` — stagger children by ms (on parent element)
- \`data-morph="id"\` — shared element transition between slides

## Animations

### Click-to-Reveal

\`\`\`html
<h1>Always visible</h1>
<p data-step="1" data-animate="fade">Appears on 1st click</p>
<p data-step="2" data-animate="slide-up">Appears on 2nd click</p>
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

### Stagger

Add \`data-stagger="100"\` to a parent to stagger children:

\`\`\`html
<div data-step="1" data-animate="slide-up" data-stagger="100">
  <div>First</div>
  <div>Second</div>
  <div>Third</div>
</div>
\`\`\`

### Entrance Animation (No Step)

Elements with \`data-animate\` but no \`data-step\` animate on slide entry:

\`\`\`html
<h1 data-animate="scale">Always animates in</h1>
\`\`\`

### Cross-Slide Morph

\`\`\`html
<!-- Slide 1 --><h1 data-morph="title" class="text-7xl">Title</h1>
<!-- Slide 2 --><h1 data-morph="title" class="text-3xl">Title</h1>
\`\`\`

### Slide Transitions

Set in deck.json or per-slide via \`data-transition\`:
\`fade\` (default), \`slide-left\`, \`slide-right\`, \`slide-up\`, \`slide-down\`,
\`zoom\`, \`zoom-fade\`, \`morph\`, \`none\`

## Slide Master Layouts

Layouts define repeating structure (headers, footers, numbering) shared across
slides. Create 2-3 layouts early for visual consistency.

### Template Slots

Layouts use \`<!-- slot:name -->\` markers.

**Text slots** — from \`data-*\` attributes on \`<section>\`:
\`\`\`html
<section data-layout="content" data-title="Memory" data-section="04">
\`\`\`
Layout uses: \`<!-- slot:title -->\` → "Memory", \`<!-- slot:section -->\` → "04"

**Content slots** — from \`<slot>\` elements:
\`\`\`html
<section data-layout="split">
  <slot name="left"><h1>Problem</h1><p>Details...</p></slot>
  <slot name="right"><img src="asset://chart.png" /></slot>
</section>
\`\`\`

**Built-in markers:** \`<!-- content -->\`, \`<!-- slideNumber -->\`, \`<!-- totalSlides -->\`

### Content Wrapping

The compiler may wrap injected content in a plain \`<div>\` when there are
multiple siblings. This breaks direct flex/grid child relationships. Handle it
by wrapping the slot marker in a flex container:

\`\`\`html
<!-- Vertically centered -->
<div class="flex-1 flex items-center justify-center px-20 py-10 overflow-hidden">
  <!-- content -->
</div>
\`\`\`

### Example: Content Layout

\`\`\`html
<!-- layouts/content.html -->
<div class="flex h-full w-full flex-col bg-background">
  <div class="flex items-baseline gap-6 px-20 pt-12 pb-8 border-b border-border">
    <span class="text-xs text-muted-foreground uppercase tracking-[0.3em]"><!-- slot:section --></span>
    <h2 class="text-4xl font-bold tracking-tight text-foreground"><!-- slot:title --></h2>
  </div>
  <div class="flex-1 px-20 py-10 overflow-hidden">
    <!-- content -->
  </div>
  <div class="flex items-center justify-between px-20 py-4 border-t border-border">
    <img src="asset://logo.svg" class="h-6" />
    <span class="text-xs text-muted-foreground"><!-- slideNumber --> / <!-- totalSlides --></span>
  </div>
</div>
\`\`\`

### Example: Split Layout

\`\`\`html
<!-- layouts/split.html -->
<div class="flex h-full w-full bg-background">
  <div class="w-2/5 flex flex-col justify-center px-16 border-r border-border">
    <!-- slot:sidebar -->
  </div>
  <div class="w-3/5 flex flex-col justify-center px-16">
    <!-- slot:main -->
  </div>
</div>
\`\`\`

Slides without \`data-layout\` are freeform (full 1280×720 container).

## Theming

Themes are CSS files in \`themes/\`. A \`default.css\` is auto-created with the
Tailwind import and color mappings — do NOT add \`@import "tailwindcss"\` in
custom themes (it's already in default.css and duplicating it breaks colors).

Custom themes should only contain:
- \`@import url(...)\` for external fonts (optional)
- \`@theme inline { ... }\` for font overrides (use \`inline\` to extend, not replace)
- \`:root\` and \`.dark\` blocks with CSS variable overrides

Define variables in both \`:root\` (light) and \`.dark\` selectors.
Dark mode is the default.

### Brand Color

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

### Asset Protocol

Use \`asset://filename\` for images:
\`\`\`html
<img src="asset://logo.svg" class="h-8" />
\`\`\`

Upload assets with the upload_asset tool.

## Visual Verification

**Always verify slides visually after creating or editing them.**

- **get_screenshot(slide)** — capture a single slide as PNG. Use after every
  create_slide, write_slide, or edit_slide call.
- **get_deck_overview** — thumbnail grid of all slides. Check visual consistency.

Common issues only visible in rendered output: broken alignment, wrong colors,
text overflow, content clipped by overflow-hidden.

## Workflow

1. create_deck → directory structure
2. write_layout × 2-3 → slide master layouts
3. write_theme (optional) → brand colors
4. create_slide × N → slides referencing layouts
5. get_screenshot / get_deck_overview → verify visuals
6. edit_slide / write_slide → iterate
7. open_preview → present in browser
8. export_pdf → export for sharing`,

  "design-recipes": `# Design Recipes

Ready-to-use code snippets for visually diverse slides.
Do not repeat the same pattern on consecutive slides.

## Background Treatments

### Gradient Mesh
\`\`\`html
<div class="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background"></div>
<div class="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl"></div>
<div class="absolute bottom-1/4 right-10 h-64 w-64 rounded-full bg-primary/5 blur-2xl"></div>
<div class="relative z-10">Content here</div>
\`\`\`

### Split Background
\`\`\`html
<div class="absolute inset-y-0 left-0 w-2/5 bg-primary"></div>
<div class="relative flex h-full">
  <div class="w-2/5 flex flex-col justify-center px-12">
    <h2 class="text-5xl font-bold text-primary-foreground">Statement</h2>
  </div>
  <div class="w-3/5 flex flex-col justify-center px-12">Content</div>
</div>
\`\`\`

### Radial Spotlight
\`\`\`html
<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--primary)_0%,_transparent_70%)] opacity-10"></div>
\`\`\`

## Card Styles

### Glass
\`\`\`html
<div class="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-primary/5 backdrop-blur-md">
\`\`\`

### Gradient
\`\`\`html
<div class="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/15 to-transparent p-8">
\`\`\`

### Elevated
\`\`\`html
<div class="rounded-2xl bg-card p-8 shadow-xl shadow-primary/10">
\`\`\`

### Accent Border
\`\`\`html
<div class="rounded-2xl border border-border border-l-4 border-l-primary bg-card p-8">
\`\`\`

## Layout Patterns

### Bento Grid
\`\`\`html
<div class="grid h-full grid-cols-3 grid-rows-2 gap-4">
  <div class="col-span-2 rounded-2xl bg-gradient-to-br from-primary/15 to-transparent p-8"
       data-step="1" data-animate="scale">Wide tile</div>
  <div class="row-span-2 rounded-2xl border border-border bg-card p-6"
       data-step="1" data-animate="scale" data-delay="100">Tall tile</div>
  <div class="rounded-2xl bg-muted/30 p-6"
       data-step="1" data-animate="scale" data-delay="200">Small</div>
  <div class="rounded-2xl bg-primary p-6"
       data-step="1" data-animate="scale" data-delay="300">
    <span class="text-primary-foreground">Highlight</span></div>
</div>
\`\`\`

### Vertical Timeline
\`\`\`html
<div class="relative flex h-full items-center justify-center">
  <div class="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-border"></div>
  <div class="relative w-full max-w-4xl space-y-8">
    <div class="relative flex items-center" data-step="1" data-animate="fade">
      <div class="absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background"></div>
      <div class="w-1/2 pr-12 text-right">
        <div class="text-xs font-mono text-primary/60 mb-1">01</div>
        <h3 class="text-lg font-semibold text-foreground">Step One</h3>
        <p class="text-sm text-muted-foreground">Description</p>
      </div>
      <div class="w-1/2"></div>
    </div>
  </div>
</div>
\`\`\`

### Comparison / Before-After
\`\`\`html
<div class="relative flex h-full items-center">
  <div class="grid w-full grid-cols-2 gap-8">
    <div data-step="1" data-animate="slide-right"
         class="rounded-2xl border border-border bg-muted/30 p-8">
      <h3 class="mb-6 text-lg font-semibold text-muted-foreground">The Old Way</h3>
    </div>
    <div data-step="2" data-animate="slide-left"
         class="rounded-2xl border border-primary/20 bg-primary/5 p-8 shadow-lg shadow-primary/10">
      <h3 class="mb-6 text-lg font-semibold text-primary">The New Way</h3>
    </div>
  </div>
  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">VS</div>
</div>
\`\`\`

### Asymmetric Two-Column
\`\`\`html
<div class="grid h-full grid-cols-5 gap-12 items-center">
  <div class="col-span-3">Larger content</div>
  <div class="col-span-2">Supporting content</div>
</div>
\`\`\`

## Data Visualization

### Big Numbers + Progress Bars
\`\`\`html
<div class="grid grid-cols-3 gap-10" data-step="1" data-animate="slide-up" data-stagger="100">
  <div>
    <div class="text-6xl font-bold tracking-tight text-primary">$10M</div>
    <div class="mt-4 h-1 w-4/5 rounded-full bg-gradient-to-r from-primary to-primary/30"></div>
    <div class="mt-3 text-lg font-semibold text-foreground">Revenue</div>
    <div class="text-sm text-muted-foreground">Annual recurring</div>
  </div>
</div>
\`\`\`

### CSS Bar Chart
\`\`\`html
<div class="flex h-48 items-end gap-4">
  <div class="flex w-16 flex-col items-center gap-2">
    <div class="w-full rounded-t-lg bg-primary/80" style="height: 80%"></div>
    <span class="text-xs text-muted-foreground">Q1</span>
  </div>
</div>
\`\`\`

### SVG Donut Ring
\`\`\`html
<svg class="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
  <circle cx="60" cy="60" r="50" fill="none" stroke-width="10" class="stroke-border" />
  <circle cx="60" cy="60" r="50" fill="none" stroke-width="10"
    stroke-dasharray="314" stroke-dashoffset="78" stroke-linecap="round"
    class="stroke-primary" />
</svg>
<div class="text-3xl font-bold text-primary">75%</div>
\`\`\`

## Typography

### Large Quote
\`\`\`html
<div class="flex h-full flex-col items-center justify-center text-center">
  <span class="block font-serif text-[120px] leading-none text-primary/20">&ldquo;</span>
  <p class="-mt-10 max-w-4xl text-3xl font-light leading-relaxed italic text-foreground"
     data-step="1" data-animate="fade">Quote text here.</p>
  <div class="mx-auto mt-8 mb-6 h-px w-16 bg-primary/40"></div>
  <div class="text-lg font-semibold text-foreground">Speaker Name</div>
  <div class="text-sm text-muted-foreground">Title, Company</div>
</div>
\`\`\`

### Headline-Only
\`\`\`html
<div class="flex h-full flex-col items-center justify-center text-center">
  <h1 class="max-w-5xl text-6xl font-bold leading-tight text-foreground">
    We don't just build products.<br />
    We build <span class="text-primary">movements</span>.
  </h1>
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
| Card Grid | \`data-stagger\` + \`scale\` | Uniform pop-in |
| Timeline | \`fade\` | Clean, no movement |
| Comparison | \`slide-right\` + \`slide-left\` | Opposing directions |
| Metrics | \`slide-up\` | Vertical reveal |
| Quote | \`fade\` | Let words speak |

## Anti-Patterns

- Same card style on every slide
- \`slide-up\` on everything
- All equal-width columns
- Two consecutive slides with same layout pattern

## Pitch Deck Order

1. Title — hero gradient, large typography
2. Problem — comparison (old vs new)
3. Solution — split screen, bold statement
4. How It Works — timeline or process
5. Features — bento grid
6. Market — big numbers
7. Traction — data viz
8. Team — glass cards on gradient
9. Business Model — accent-border or split
10. CTA — quote or headline-only`
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
