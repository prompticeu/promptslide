---
name: promptslide
description: >-
  Creates and authors slide deck presentations using the PromptSlide framework
  (HTML + Tailwind CSS). Use when the user wants to create a new slide deck,
  add or edit slides, customize themes or branding, work with layouts, or
  manage slide animations and transitions, capture slides as images, or
  visually verify slide appearance. Triggers on mentions of slides,
  decks, presentations, PromptSlide, slide screenshots, or slide-related tasks.
metadata:
  author: prompticeu
  version: "3.0"
---

# PromptSlide

Create beautiful slide decks with AI coding agents. Each slide is an HTML file styled with Tailwind CSS. The framework handles animations, transitions, theming, keyboard navigation, and presentation mode.

## Detect Mode

Check if a PromptSlide project already exists:

- If the PromptSlide **MCP server** is connected, use its tools to manage decks directly. The tools are self-documented — call `get_deck_info` to see an existing deck's state.
- If working in a **CLI-scaffolded project** (has `deck.json` and a `slides/` directory), create and edit slide HTML files directly and run the dev server with `promptslide studio`.
- If **no project exists yet**, scaffold one with the CLI (see below).

---

## Creating a New Deck

### Step 1: Content Discovery

Before writing any code, ask the user:

1. **What is this presentation about?** (topic, key message)
2. **Who is the audience?** (investors, team, customers, conference)
3. **How many slides?** (suggest 5–10 for a focused deck, 10–15 for a detailed one)
4. **Do you have content ready?** (outline, bullet points, or should the agent draft it)

Use the answers to plan slide structure before scaffolding.

### Step 2: Style Direction

Determine the visual direction before writing any code:

1. **Ask if they have brand guidelines** — logo, colors, fonts. If yes, use those directly.
2. **If no brand guidelines**, suggest 2–3 presets from [references/style-presets.md](references/style-presets.md). Briefly describe each (one sentence + mood), let the user pick or mix.
3. **If the user wants something custom**, ask: dark or light? What mood? (professional, playful, dramatic, techy). Then build a custom direction from the building blocks in the presets.

The chosen direction determines what you configure in Steps 3–4:

- **Colors** → Theme CSS files with CSS custom properties
- **Fonts** → Theme CSS with `@theme inline { ... }`
- **Layouts** → HTML templates in `layouts/` (like PowerPoint masters)
- **Card styles & animations** → Applied per-slide based on the direction

Presets are starting points, not rigid templates. The user can change everything — it's all HTML, CSS, and Tailwind.

### Step 3: Scaffold and start

```bash
promptslide create my-deck
cd my-deck
bun install
bun run dev
```

This creates a project with:

```
my-deck/
├── deck.json           # Manifest — slide order, theme, transitions
├── slides/             # Slide HTML files
├── layouts/            # Slide master templates (like PowerPoint masters)
├── themes/             # CSS theme files (default theme auto-created)
├── assets/             # Images, logos, etc.
└── annotations.json    # Feedback/comments (optional)
```

`bun run dev` starts `promptslide studio` — the dev server with hot module replacement. Slides update instantly as files change.

### Step 4: Design Thinking

Before writing any slide code, commit to a clear aesthetic direction and plan the deck holistically. Generic, template-looking slides are worse than no slides at all.

#### Pick a direction and commit

Choose a distinct visual personality — editorial, brutalist, luxury-minimal, bold geometric, warm organic — and execute it with precision throughout the deck. The key is intentionality, not intensity. A restrained minimal deck executed with perfect spacing and typography is just as strong as a bold maximalist one. What kills a deck is indecision: a little of everything, committing to nothing.

#### Design each slide for its content

- **What does this content want to be?** A single powerful stat deserves to be big and alone on the slide. A comparison wants two sides. A list of features might work as clean typography with whitespace — not everything needs cards.
- **What's the rhythm of the deck?** Alternate between dense and spacious, dark and light, structured and freeform. Three white slides in a row is monotonous. Break runs with a dark "breather" slide, a full-bleed color block, or an asymmetric layout.
- **Where are the hero moments?** Every deck needs 1–2 slides that break the pattern — an oversized number, a bold color block, a single sentence with generous whitespace. These are what people remember.
- **What makes this deck UNFORGETTABLE?** Ask this before coding. If the answer is "nothing" — the design direction isn't strong enough.

Don't default to the first layout that comes to mind. Consider 2–3 options for each slide and pick the one that best serves the message.

**Share your design plan with the user before coding.** Briefly describe the visual direction, color strategy, and your layout approach for each slide (e.g., "slide 3: asymmetric two-column with oversized stat", "slide 7: dark hero slide — the most important in the deck"). Let them approve or adjust — don't just decide and start building.

### Step 5: Create your slides

---

## Slide Format

Each slide is a `.html` file in `slides/` containing a `<section>` element:

```html
<section class="relative flex items-center justify-center overflow-hidden bg-background">
  <div class="text-center px-16">
    <h1 class="text-7xl font-bold text-foreground">Title</h1>
    <p class="mt-4 text-xl text-muted-foreground"
       data-step="1" data-animate="fade">
      Subtitle appears on click
    </p>
  </div>
</section>
```

The framework auto-adds `h-full` to the root `<section>` so it fills the 1280×720 slide container. Use `flex items-center justify-center` for vertical centering.

### Slide Dimensions

**1280×720 pixels** (16:9). Design content for this size — it scales automatically in presentation mode.

---

## Deck Manifest (deck.json)

Controls slide order, theme, and transitions:

```json
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
```

- **Add a slide**: Create the `.html` file in `slides/`, add an entry to the `slides` array
- **Remove a slide**: Remove from the array (keep the file if you want it later)
- **Reorder slides**: Change position in the array
- **Steps are auto-detected** from the HTML (highest `data-step` value) — no manual step counts needed

### Slide Transitions

Set the default transition in `deck.json` via the `transition` field, or override per-slide with `data-transition` on the `<section>`:

Options: `fade` (default), `slide-left`, `slide-right`, `slide-up`, `slide-down`, `zoom`, `zoom-fade`, `morph`, `none`

---

## Slide Master Layouts

Layouts work like PowerPoint slide masters. They define repeating structure (headers, footers, section numbering, background treatment) shared across slides. The slide provides content; the layout controls where it goes.

**Create 2-3 layouts early** — they ensure visual consistency and make batch edits easy. When a layout changes, all slides using it update automatically.

### How Layouts Work

Layouts are HTML files in `layouts/` that use `<!-- slot:name -->` markers for content injection.

**Text slots** come from `data-*` attributes on the slide's `<section>`:

```html
<!-- Slide -->
<section data-layout="content" data-title="Memory" data-section="04">
  <p>Slide content goes here</p>
</section>
```

`data-title` → fills `<!-- slot:title -->`, `data-section` → fills `<!-- slot:section -->`, inner HTML → fills `<!-- content -->`.

**Content slots** come from `<slot>` elements for rich HTML:

```html
<section data-layout="split">
  <slot name="sidebar">
    <h2 class="text-5xl font-bold text-foreground">Memory Systems</h2>
    <p class="mt-6 text-muted-foreground">How agents persist knowledge.</p>
  </slot>
  <slot name="main">
    <div class="space-y-6" data-step="1" data-animate="slide-up" data-stagger="100">
      <div>Short-term: context window</div>
      <div>Long-term: vector stores</div>
    </div>
  </slot>
</section>
```

**Built-in markers**: `<!-- content -->` (remaining HTML), `<!-- slideNumber -->`, `<!-- totalSlides -->`

### Example: Content Layout

```html
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
```

### Example: Split Layout

```html
<!-- layouts/split.html -->
<div class="flex h-full w-full bg-background">
  <div class="w-2/5 flex flex-col justify-center px-16 border-r border-border">
    <!-- slot:sidebar -->
  </div>
  <div class="w-3/5 flex flex-col justify-center px-16">
    <!-- slot:main -->
  </div>
</div>
```

### Content Wrapping

When slide content is injected into a slot, the compiler may wrap it in a plain `<div>` if there are multiple sibling elements. This means injected content is not a direct flex/grid child of your layout. To handle vertical centering, wrap the slot marker:

```html
<!-- Vertically centered -->
<div class="flex-1 flex items-center justify-center px-20 py-10 overflow-hidden">
  <!-- content -->
</div>
```

Slides without `data-layout` are freeform — full 1280×720 container, no layout wrapping.

---

## Animations

### Click-to-Reveal (data-step)

Elements with `data-step="N"` are hidden until the Nth click:

```html
<h1>Always visible</h1>
<p data-step="1" data-animate="fade">Appears on 1st click</p>
<p data-step="2" data-animate="slide-up">Appears on 2nd click</p>
```

Steps are 1-indexed. Multiple elements can share the same step.

### Animation Types

| Type | Effect |
|------|--------|
| `fade` | Fade in (opacity) |
| `slide-up` | Slide up + fade (default) |
| `slide-down` | Slide down + fade |
| `slide-left` | Slide from right + fade |
| `slide-right` | Slide from left + fade |
| `scale` | Scale up from 0.8 + fade |

### Timing & Stagger

- `data-delay="200"` — delay in ms before animation starts
- `data-duration="400"` — animation duration in ms
- `data-stagger="100"` — stagger children by ms (on parent element)

```html
<!-- Staggered grid: children appear one by one -->
<div class="grid grid-cols-3 gap-6"
     data-step="1" data-animate="slide-up" data-stagger="100">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

### Entrance Animation (No Step)

Elements with `data-animate` but no `data-step` animate on slide entry:

```html
<h1 data-animate="scale">Always animates in</h1>
```

### Cross-Slide Morph

Smoothly transition shared elements between consecutive slides:

```html
<!-- Slide 1 --><h1 data-morph="title" class="text-7xl">Title</h1>
<!-- Slide 2 --><h1 data-morph="title" class="text-3xl">Title</h1>
```

### Animation Variety Guide

Match animation types to layout styles:

| Layout | Animation | Why |
|--------|----------|-----|
| Hero/Title | `scale` or `fade` | Dramatic, non-directional |
| Split Screen | `slide-right` + `slide-left` | Panels enter from edges |
| Card Grid/Bento | `data-stagger` + `scale` | Uniform pop-in |
| Timeline | `fade` | Clean, no movement |
| Comparison | `slide-right` + `slide-left` | Opposing directions |
| Metrics | `slide-up` | Vertical reveal |
| Quote | `fade` | Let words speak |

---

## Theming

Themes are CSS files in `themes/`. A `default.css` is auto-created with the Tailwind import and color mappings. Custom themes should NOT include `@import "tailwindcss"` (it's already in default.css — duplicating it breaks color resolution). Custom themes only need `:root` and `.dark` CSS variable overrides, and optionally `@theme inline { ... }` for font changes.

Dark mode is the **default and recommended** mode.

### Brand Color

Change your brand color by editing `--primary`:

```css
:root {
  --primary: oklch(0.55 0.2 250);
}
.dark {
  --primary: oklch(0.6 0.2 250);
}
```

OKLCH format: `oklch(lightness chroma hue)`
- **Lightness**: 0 (black) to 1 (white)
- **Chroma**: 0 (gray) to ~0.4 (vivid)
- **Hue**: 0–360 (0=red, 60=yellow, 120=green, 195=teal, 250=blue, 300=purple)

| Brand | Light | Dark | Hue |
|-------|-------|------|-----|
| Blue | `oklch(0.55 0.2 250)` | `oklch(0.6 0.2 250)` | 250 |
| Purple | `oklch(0.55 0.2 300)` | `oklch(0.6 0.2 300)` | 300 |
| Green | `oklch(0.6 0.2 145)` | `oklch(0.65 0.2 145)` | 145 |
| Orange | `oklch(0.661 0.201 41)` | `oklch(0.7 0.2 41)` | 41 |
| Teal | `oklch(0.6 0.15 195)` | `oklch(0.65 0.15 195)` | 195 |

### Semantic Color Classes
### Semantic Color Classes

Always use these for consistent theming:

| Class | Purpose |
|-------|---------|
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary/description text |
| `text-primary` | Brand color text |
| `text-primary-foreground` | Text on primary backgrounds |
| `bg-background` | Slide background |
| `bg-card` | Card/panel background |
| `bg-primary` | Brand color background |
| `bg-primary/10` | Subtle brand background |
| `border-border` | Standard borders |

### Asset Protocol

Use `asset://filename` for images:

```html
<img src="asset://logo.svg" class="h-8" />
<img src="asset://hero-bg.jpg" class="absolute inset-0 object-cover -z-10" />
```

---

## Visual Diversity Guidelines

When creating a deck with multiple slides, **vary the visual treatment**. Do not repeat the same layout pattern on consecutive slides. Don't overwrite the user's primary color without asking.

**Rotate backgrounds**: gradient mesh, split backgrounds, radial spotlights — not just plain `bg-background`.

**Vary card styles**: glass (`backdrop-blur-md`), gradient fill, elevated (shadow), accent-border (`border-l-4 border-l-primary`) — not the same card on every slide.

**Mix animations**: `fade` for quotes, `slide-left`/`slide-right` for splits, `scale` for grids, `slide-up` for metrics, `data-stagger` for collections.

**Layout variety**: asymmetric splits, bento grids, vertical timelines, typography-driven layouts — not all equal-column grids.

**Use primary color sparingly** — for impact, not on every element.

For ready-to-use design recipes (background treatments, card styles, layout patterns, data visualization, typography), see [references/design-patterns.md](references/design-patterns.md).

---

## Visual Verification

**Always verify slides visually after creating or editing them.** HTML and Tailwind classes can look correct in source but render incorrectly — broken alignment, wrong colors, text overflow, content clipped.

When the MCP server is connected, use `get_screenshot` after every slide change and `get_deck_overview` periodically to check consistency across the deck.

Common issues only visible in rendered output:
- Content not centering in layouts (wrapper div breaks flex chain)
- Colors invisible against background
- Text overflowing the 1280×720 container

---

## Keyboard Shortcuts (Presentation Mode)

| Key | Action |
|-----|--------|
| `→` or `Space` | Advance (next step or next slide) |
| `←` | Go back |
| `F` | Toggle fullscreen |
| `G` | Toggle grid view |
| `Escape` | Exit fullscreen |

## View Modes

1. **Slide view** (default): Single slide with navigation controls
2. **Grid view**: Thumbnail overview — click any slide to jump to it
3. **List view**: Vertical scroll — optimized for PDF export

---

## Styling Constraints (PDF Compatibility)

These rules ensure slides look identical on screen and in PDF export:

- **No blur**: `filter: blur()` and `backdrop-filter: blur()` are silently dropped by Chromium's PDF pipeline
- **No gradients**: `bg-gradient-to-*` and radial gradients render inconsistently — use solid colors with opacity instead (e.g., `bg-primary/5`, `bg-muted/20`)
- **No shadows**: `box-shadow` (including `shadow-sm`, `shadow-lg`, `shadow-2xl`) does not export correctly to PDF — use borders or background tints instead (e.g., `border border-border`, `bg-white/5`)

---

## Annotations (User Feedback)

Users can leave annotations — text feedback attached to slides. Annotations are stored in `annotations.json` in the deck directory.

Each annotation has:
- `slide` — which slide filename
- `body` — the user's feedback
- `status` — `"open"` or `"resolved"`

After addressing feedback, resolve the annotation via the MCP `resolve_annotation` tool.

When creating slides, add `data-annotate="descriptive-name"` to key elements (headings, feature cards, stat blocks) to make annotations more stable across edits:

```html
<h2 data-annotate="main-title" class="text-4xl font-bold">Title</h2>
<div data-annotate="feature-card-1" class="rounded-2xl bg-card p-6">...</div>
```

---

## Publish Metadata

After all slides are authored, update `.promptslide-lock.json` with `deckMeta` (title, description, 3–6 tags) and per-slide `meta` entries (title, tags, section) under `items`. These become pre-filled defaults when the user runs `promptslide publish`. Read the existing lockfile first and merge — don't overwrite other fields.
