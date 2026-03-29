/**
 * Guide content for the get_guide MCP tool.
 */

const guides = {
  "getting-started": `# Getting Started with PromptSlide

## How It Works

PromptSlide slides are HTML files with Tailwind CSS. The framework handles animations,
transitions, theming, keyboard navigation, and presentation mode.

## Slide Format

Each slide is a \`.html\` file in the \`slides/\` directory containing a \`<section>\` element:

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

The framework auto-adds \`h-full\` to the root \`<section>\` so it fills the 1280×720 slide container.
Use \`flex items-center justify-center\` for vertical centering.
Use \`data-layout="name"\` to wrap in a slide master layout instead.

## Data Attributes

**On <section>:**
- \`data-layout="name"\` — wrap in a slide master layout from layouts/
- \`data-transition="type"\` — per-slide transition override

**On any element:**
- \`data-step="N"\` — reveal on Nth click (1-indexed)
- \`data-animate="type"\` — animation type (fade, slide-up, slide-down, slide-left, slide-right, scale)
- \`data-delay="ms"\` — delay in milliseconds
- \`data-duration="ms"\` — duration in milliseconds
- \`data-stagger="ms"\` — stagger children by ms (on parent element)
- \`data-morph="id"\` — shared element transition between slides

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

Steps are auto-detected from the HTML (highest data-step value).

## Directory Structure

\`\`\`
my-deck/
├── deck.json           # Manifest (slide order, theme, transitions)
├── slides/             # Slide HTML files
├── layouts/            # Slide master templates (optional)
├── themes/             # CSS theme files
├── assets/             # Images, logos, etc.
└── annotations.json    # Feedback/comments (optional)
\`\`\`

## Semantic Color Classes

Always use these for consistent theming:
- \`text-foreground\` — primary text
- \`text-muted-foreground\` — secondary/description text
- \`text-primary\` — brand color text
- \`bg-background\` — slide background
- \`bg-card\` — card/panel background
- \`bg-primary\` — brand color background
- \`bg-primary/10\` — subtle brand background
- \`border-border\` — standard borders

## Slide Dimensions

1280×720 pixels (16:9). Content scales automatically in presentation mode.

## Asset Protocol

Use \`asset://filename\` for images:
\`\`\`html
<img src="asset://logo.svg" class="h-8" />
<img src="asset://hero-bg.jpg" class="absolute inset-0 object-cover -z-10" />
\`\`\`

Upload assets with the upload_asset tool.`,

  animations: `# Animation Reference

## Click-to-Reveal (data-step)

Elements with \`data-step="N"\` are hidden until the Nth click:

\`\`\`html
<!-- Always visible -->
<h1>Title</h1>

<!-- Appears on 1st click -->
<p data-step="1" data-animate="fade">First point</p>

<!-- Appears on 2nd click -->
<p data-step="2" data-animate="slide-up">Second point</p>
\`\`\`

Steps are 1-indexed. Multiple elements can share the same step (appear together).

## Animation Types

| Type | Effect |
|------|--------|
| \`fade\` | Fade in (opacity) |
| \`slide-up\` | Slide up + fade (default) |
| \`slide-down\` | Slide down + fade |
| \`slide-left\` | Slide from right + fade |
| \`slide-right\` | Slide from left + fade |
| \`scale\` | Scale up from 0.8 + fade |

## Timing

- \`data-delay="200"\` — delay in ms before animation starts
- \`data-duration="400"\` — animation duration in ms

## Stagger (Group Animation)

Add \`data-stagger="100"\` to a parent to stagger children:

\`\`\`html
<div data-step="1" data-animate="slide-up" data-stagger="100">
  <div class="card">First</div>
  <div class="card">Second</div>
  <div class="card">Third</div>
</div>
\`\`\`

Children appear one by one with 100ms between each.

## Entrance Animation (No Step)

Elements with \`data-animate\` but no \`data-step\` animate on slide entry:

\`\`\`html
<h1 data-animate="scale">Always animates in</h1>
\`\`\`

## Cross-Slide Morph (data-morph)

Smoothly transition elements between consecutive slides:

\`\`\`html
<!-- Slide 1 -->
<h1 data-morph="title" class="text-7xl">Title</h1>

<!-- Slide 2 (same data-morph ID) -->
<h1 data-morph="title" class="text-3xl">Title</h1>
\`\`\`

The element morphs smoothly between sizes/positions.

## Patterns

**Sequential cards** — each on its own step:
\`\`\`html
<div data-step="1" data-animate="slide-up">Card A</div>
<div data-step="2" data-animate="slide-up">Card B</div>
<div data-step="3" data-animate="slide-up">Card C</div>
\`\`\`

**Staggered grid** — all at once with visual stagger:
\`\`\`html
<div class="grid grid-cols-3 gap-6"
     data-step="1" data-animate="slide-up" data-stagger="100">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
\`\`\`

**Two-phase reveal** — header then details:
\`\`\`html
<h2 data-step="1" data-animate="fade">The Answer</h2>
<div data-step="2" data-animate="slide-up" data-stagger="80">
  <p>Detail 1</p>
  <p>Detail 2</p>
</div>
\`\`\`

## Slide Transitions

Set on the deck level in deck.json or per-slide via data-transition:
- \`fade\` (default), \`slide-left\`, \`slide-right\`, \`slide-up\`, \`slide-down\`
- \`zoom\`, \`zoom-fade\`, \`morph\`, \`none\``,

  design: `# Slide Design Guide

## Visual Diversity

When creating multiple slides, VARY the visual treatment. Do not repeat the same
layout pattern on consecutive slides.

## Background Variety

Not every slide needs plain \`bg-background\`. Alternate between:

**Gradient mesh:**
\`\`\`html
<div class="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background"></div>
<div class="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl"></div>
\`\`\`

**Split background:**
\`\`\`html
<div class="absolute inset-y-0 left-0 w-1/2 bg-primary"></div>
\`\`\`

**Radial spotlight:**
\`\`\`html
<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--primary)_0%,_transparent_70%)] opacity-10"></div>
\`\`\`

## Card Style Variety

Do NOT use \`rounded-xl border border-border bg-card\` on every slide. Alternate:

- **Glass:** \`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md\`
- **Gradient:** \`bg-gradient-to-br from-primary/15 to-transparent border border-primary/10\`
- **Elevated:** \`shadow-xl shadow-primary/10\`
- **Accent border:** \`border-l-4 border-l-primary\`
- **No cards** — use large typography or data visualizations directly

## Layout Patterns

Don't make every slide a 3-column equal grid. Use:
- Asymmetric splits (\`grid-cols-5\` with \`col-span-2\` + \`col-span-3\`)
- Bento grids with mixed tile sizes
- Vertical timelines with alternating left/right
- Full-width typography-driven layouts
- Side-by-side comparisons with contrasting panels

## Animation Variety

Use different animations on different slides:
- \`fade\` for quotes, images, subtle reveals
- \`slide-left\` / \`slide-right\` for split-screen content
- \`scale\` for hero elements and card grids
- \`slide-up\` for sequential list items
- \`data-stagger\` for grids and collections

## Typography Tips

- Hero titles: \`text-6xl\` to \`text-8xl\`, \`font-bold\`, \`tracking-tight\`
- Section titles: \`text-3xl\` to \`text-5xl\`
- Body: \`text-lg\` to \`text-xl\`, \`text-muted-foreground\`
- Eyebrows: \`text-xs font-bold tracking-[0.2em] text-primary uppercase\`
- Numbers/stats: \`text-5xl font-bold text-primary\`

## Icons

Use Lucide icons as inline SVGs or reference them by name in content.
Common useful icons: ArrowRight, Check, Star, Zap, Shield, Globe, Code, etc.`,

  theming: `# Theming Reference

## Theme Files

Themes are CSS files in the \`themes/\` directory. Each theme defines CSS custom
properties for colors, fonts, and spacing.

A theme file MUST start with \`@import "tailwindcss";\` and define variables in
both \`:root\` (light) and \`.dark\` (dark mode) selectors.

## CSS Variables

### Required Variables

\`\`\`css
:root {
  --background: oklch(1 0 0);          /* Page background */
  --foreground: oklch(0.145 0 0);      /* Primary text */
  --card: oklch(1 0 0);               /* Card/panel background */
  --card-foreground: oklch(0.145 0 0); /* Card text */
  --primary: oklch(0.55 0.2 250);      /* Brand color */
  --primary-foreground: oklch(0.985 0 0); /* Text on primary bg */
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0); /* Secondary text */
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --border: oklch(0.922 0 0);          /* Borders */
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}
\`\`\`

### Dark Mode (always include)

\`\`\`css
.dark {
  --background: oklch(0.159 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --primary: oklch(0.6 0.2 250);       /* Slightly brighter for dark */
  --muted-foreground: oklch(0.712 0 0);
  --border: oklch(0.269 0 0);
}
\`\`\`

## OKLCH Color Format

\`oklch(lightness chroma hue)\`

- **Lightness**: 0 (black) to 1 (white)
- **Chroma**: 0 (gray) to ~0.4 (vivid)
- **Hue**: 0-360 (0=red, 60=yellow, 120=green, 195=teal, 250=blue, 300=purple)

### Brand Color Examples

| Brand | Light | Dark | Hue |
|-------|-------|------|-----|
| Blue | oklch(0.55 0.2 250) | oklch(0.6 0.2 250) | 250 |
| Purple | oklch(0.55 0.2 300) | oklch(0.6 0.2 300) | 300 |
| Green | oklch(0.6 0.2 145) | oklch(0.65 0.2 145) | 145 |
| Orange | oklch(0.661 0.201 41) | oklch(0.7 0.2 41) | 41 |
| Teal | oklch(0.6 0.15 195) | oklch(0.65 0.15 195) | 195 |

## Tips

- Light mode primary: lightness 0.5–0.6, chroma 0.15–0.25
- Dark mode: increase lightness by 0.05 for readability
- Dark mode is the default and recommended mode`,

  layouts: `# Slide Master Layouts

## What Layouts Are

Layouts (slide masters) are HTML template files in the \`layouts/\` directory.
They define consistent structure (headers, footers, spacing) shared across slides.

## Template Syntax

Layouts use HTML comment markers as slots:

| Marker | Replaced With |
|--------|---------------|
| \`<!-- content -->\` | The slide's content (inside <section>) |
| \`<!-- slideNumber -->\` | Current slide number |
| \`<!-- totalSlides -->\` | Total slide count |

## Example Layout

\`\`\`html
<!-- layouts/master.html -->
<div class="flex h-full w-full flex-col overflow-hidden bg-background px-12 pt-10 pb-6">

  <!-- Slide content -->
  <div class="min-h-0 w-full flex-1">
    <!-- content -->
  </div>

  <!-- Footer -->
  <div class="flex items-center justify-between pt-4">
    <img src="asset://logo.svg" class="h-8" />
    <span class="text-sm text-muted-foreground">
      <!-- slideNumber --> / <!-- totalSlides -->
    </span>
  </div>
</div>
\`\`\`

## Using a Layout

Reference it with \`data-layout\` on the slide's <section>:

\`\`\`html
<section data-layout="master">
  <h1 class="text-5xl font-bold">My Content</h1>
  <p data-step="1" data-animate="fade">Details...</p>
</section>
\`\`\`

The framework injects the slide's inner HTML at the \`<!-- content -->\` marker.

## When to Use Layouts

- Use layouts when multiple slides share the same structure (footer, header, spacing)
- Change the layout file → all slides using it update
- Slides without \`data-layout\` are freeform (full 1280×720 container)

## Multiple Layouts

You can create multiple layouts for different slide types:

\`\`\`
layouts/
├── master.html        # Standard slides with footer
├── title.html         # Title slides, no footer, centered
└── split.html         # Two-column layout
\`\`\`

Each slide chooses its layout independently via \`data-layout\`.`
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
