---
name: promptslide
description: >-
  Creates and authors slide deck presentations using the PromptSlide framework
  (Vite + React 19 + Tailwind v4 + Framer Motion). Use when the user wants to
  create a new slide deck, add or edit slides, customize themes or branding,
  work with slide animations and transitions, capture slides as images, or
  visually verify slide appearance. Triggers on mentions of slides, decks,
  presentations, PromptSlide, slide screenshots, or slide-related tasks.
metadata:
  author: prompticeu
  version: "2.0"
---

# PromptSlide

Create slide decks with AI coding agents. Each slide is a React component styled with Tailwind CSS, with built-in animations and PDF export.

## Detect Mode

Check if a PromptSlide project already exists in the current directory:

```bash
grep -q '"promptslide"' package.json 2>/dev/null
```

- **Match found** → This is an existing PromptSlide project. Go to [Authoring Slides](#authoring-slides).
- **No match** → No project yet. Go to [Creating a New Deck](#creating-a-new-deck).

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

- **Colors** → `src/globals.css` (`--primary` and other CSS variables)
- **Fonts** → `<link>` in `index.html` + `fonts` in `src/theme.ts`
- **Layouts** → Custom React components in `src/layouts/` (see [Layouts](#layouts-master-themes) below)
- **Card styles & animations** → Applied per-slide based on the direction

Presets are starting points, not rigid templates. The user can change everything — it's all just React components and CSS variables.

### Step 3: Scaffold and start

```bash
bun create slides my-deck -- --yes
cd my-deck
bun install
bun run dev
```

The `--yes` flag skips interactive prompts and uses sensible defaults. Replace `my-deck` with the user's desired name. The dev server starts at http://localhost:5173 with hot module replacement.

### Step 4: Configure branding

Edit `src/theme.ts` for brand name and logo, and `src/globals.css` for theme colors. See [references/theming-and-branding.md](references/theming-and-branding.md) for details.

### Step 5: Design Thinking

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

### Step 6: Create your slides

Remove the demo slides from `src/slides/` and clear `src/deck-config.ts`, then follow the authoring instructions below.

---

## Authoring Slides

### Before Writing Slides

Whether this is a new deck or an existing one, confirm the visual direction with the user before creating slide files. The user's primary color may already be configured from scaffolding — don't overwrite it without asking.

**Present your design plan to the user before writing any slide code.** Include:
1. The overall visual direction — mood, color strategy, how the primary color will be used (sparingly for impact, not on every element)
2. The layout approach for each slide — not just "cards" but the specific composition (e.g., "asymmetric split with oversized number left, description right")
3. Which slides will be the "hero moments" that break the pattern
4. Font choice and why it fits the deck's personality

For each slide, think about what the content wants to be. See [references/slide-design-guide.md](references/slide-design-guide.md) for design principles and anti-patterns to avoid.

### Architecture

```
src/
├── layouts/           # Slide layouts — your "master themes", create freely
├── slides/            # Your slides go here
├── theme.ts           # Brand name, logo, fonts
├── deck-config.ts     # Slide order + step counts
├── App.tsx            # Theme provider
└── globals.css        # Theme colors (CSS custom properties)
```

### Key Constraints

- **Slide dimensions**: 1280×720 (16:9). Content scales automatically in presentation mode.
- **Semantic colors**: Use `text-foreground`, `text-muted-foreground`, `text-primary`, `bg-background`, `bg-card`, `border-border` — these map to the theme's CSS custom properties.
- **Icons**: Import from `lucide-react` (e.g., `import { ArrowRight } from "lucide-react"`).

### Creating a Slide

Every slide is a React component that receives `SlideProps`:

```tsx
// src/slides/slide-example.tsx
import type { SlideProps } from "promptslide";

export function SlideExample({ slideNumber, totalSlides }: SlideProps) {
  return (
    <div className="bg-background text-foreground flex h-full w-full flex-col p-12">
      <h2 className="text-4xl font-bold">Your Title</h2>
      <div className="flex flex-1 items-center">
        <p className="text-muted-foreground text-lg">Your content</p>
      </div>
    </div>
  );
}
```

Register it in `src/deck-config.ts`:

```ts
import type { SlideConfig } from "promptslide";
import { SlideExample } from "@/slides/slide-example";

export const slides: SlideConfig[] = [{ component: SlideExample, steps: 0 }];
```

### Layouts (Master Themes)

Layouts are React components in `src/layouts/` that wrap slide content. They control structure (headers, footers, backgrounds, padding) and are the closest thing to "master slides" in traditional tools. Change a layout once, every slide using it updates.

**Create 2–4 layouts per deck for visual variety.**

The scaffolded project includes `SlideLayoutCentered` as a starter. Create new ones freely — they're just React components. Users can customize padding, backgrounds, header styles, or add entirely new structural patterns.

### Animations

Use `<Animated>` for click-to-reveal steps and `<AnimatedGroup>` for staggered reveals. Available animations: `fade`, `slide-up`, `slide-down`, `slide-left`, `slide-right`, `scale`.

**Critical rule**: The `steps` value in `deck-config.ts` MUST equal the highest `step` number used in that slide. `steps: 0` means no animations.

For the full animation API, see [references/animation-api.md](references/animation-api.md).

### Styling Constraints (PDF Compatibility)

These rules ensure slides look identical on screen and in PDF export:

- **No blur**: `filter: blur()` and `backdrop-filter: blur()` are silently dropped by Chromium's PDF pipeline
- **No gradients**: `bg-gradient-to-*` and radial gradients render inconsistently — use solid colors with opacity instead (e.g., `bg-primary/5`, `bg-muted/20`). If you want a soft radial glow effect, the project includes `/public/images/glow-white.png` which can be placed as an absolutely-positioned image — see the [theming reference](references/theming-and-branding.md) for details.
- **No shadows**: `box-shadow` (including `shadow-sm`, `shadow-lg`, `shadow-2xl`) does not export correctly to PDF — use borders or background tints instead (e.g., `border border-border`, `bg-white/5`)

For content density rules, design principles, and visual anti-patterns, see [references/slide-design-guide.md](references/slide-design-guide.md).

### Visual Verification

After creating or modifying a slide, you can capture a screenshot to visually verify it renders correctly. See [references/visual-verification.md](references/visual-verification.md) for the `promptslide to-image` command and workflow.

### Annotations (User Feedback)

Users can click on slide elements in the browser to leave annotations — text feedback attached to specific DOM elements. Annotations are stored in `annotations.json` at the project root.

#### Reading Annotations

Check for annotations before starting work:

```bash
cat annotations.json 2>/dev/null
```

Each annotation has:
- `slideIndex` — which slide (0-based, matching `deck-config.ts` order)
- `slideTitle` — human-readable slide name
- `target.selector` — CSS selector to the element within the slide
- `target.textContent` — text content of the target element
- `target.dataAnnotate` — stable identifier if the element has a `data-annotate` attribute
- `body` — the user's feedback
- `status` — `"open"` or `"resolved"`

#### Resolving Annotations

After addressing feedback, update the annotation's `status` to `"resolved"` and optionally add a `resolution` note explaining what was changed. Edit `annotations.json` directly.

#### Adding data-annotate Attributes

When creating slides, add `data-annotate="descriptive-name"` to key elements (headings, feature cards, stat blocks) to make annotations more stable across edits:

```tsx
<h2 data-annotate="main-title" className="text-4xl font-bold">Title</h2>
<div data-annotate="feature-card-1" className="rounded-2xl bg-card p-6">...</div>
```

### Publish Metadata

After all slides are authored, update `.promptslide-lock.json` with `deckMeta` (title, description, 3–6 tags) and per-slide `meta` entries (title, tags, section) under `items`. These become pre-filled defaults when the user runs `promptslide publish`. Read the existing lockfile first and merge — don't overwrite other fields.
