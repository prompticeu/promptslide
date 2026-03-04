---
name: promptslide
description: >-
  Creates and authors slide deck presentations using the PromptSlide framework
  (Vite + React 19 + Tailwind v4 + Framer Motion). Use when the user wants to
  create a new slide deck, add or edit slides, customize themes or branding,
  or work with slide animations and transitions. Triggers on mentions of slides,
  decks, presentations, PromptSlide, or slide-related tasks.
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

Suggest a visual direction based on the audience and topic. See [references/style-presets.md](references/style-presets.md) for curated presets. Briefly describe 2–3 options and let the user pick, or ask if they have brand guidelines.

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

### Step 5: Create your slides

Remove the demo slides from `src/slides/` and clear `src/deck-config.ts`, then follow the authoring instructions below.

---

## Authoring Slides

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
- **Semantic colors**: Use `text-foreground`, `text-muted-foreground`, `text-primary`, `bg-background`, `bg-card`, `border-border` — these adapt to light/dark mode.
- **Icons**: Import from `lucide-react` (e.g., `import { ArrowRight } from "lucide-react"`).

### Creating a Slide

Every slide is a React component that receives `SlideProps`:

```tsx
// src/slides/slide-example.tsx
import type { SlideProps } from "promptslide"

export function SlideExample({ slideNumber, totalSlides }: SlideProps) {
  return (
    <div className="bg-background text-foreground flex h-full w-full flex-col p-12">
      <h2 className="text-4xl font-bold">Your Title</h2>
      <div className="flex flex-1 items-center">
        <p className="text-muted-foreground text-lg">Your content</p>
      </div>
    </div>
  )
}
```

Register it in `src/deck-config.ts`:

```ts
import type { SlideConfig } from "promptslide"
import { SlideExample } from "@/slides/slide-example"

export const slides: SlideConfig[] = [{ component: SlideExample, steps: 0 }]
```

### Layouts (Master Themes)

Create reusable layout components in `src/layouts/`. A layout wraps slide content and provides consistent structure (headers, footers, backgrounds). Slides import and use layouts — change a layout, every slide using it updates.

The scaffolded project includes `SlideLayoutCentered` as a starter. Create new layouts freely for different slide types.

For the layout API (`useTheme`, `SlideFooter`, `cn`) and examples, see [references/slide-patterns.md](references/slide-patterns.md).

### Animations

Use `<Animated>` for click-to-reveal steps and `<AnimatedGroup>` for staggered reveals. Available animations: `fade`, `slide-up`, `slide-down`, `slide-left`, `slide-right`, `scale`.

**Critical rule**: The `steps` value in `deck-config.ts` MUST equal the highest `step` number used in that slide. `steps: 0` means no animations.

For the full animation API, see [references/animation-api.md](references/animation-api.md).

### Styling Constraints (PDF Compatibility)

These rules ensure slides look identical on screen and in PDF export:

- **No blur**: `filter: blur()` and `backdrop-filter: blur()` are silently dropped by Chromium's PDF pipeline
- **No gradients**: `bg-gradient-to-*` and radial gradients render inconsistently — use solid colors with opacity instead (e.g., `bg-primary/5`, `bg-muted/20`)
- **Minimal colored shadows**: `shadow-primary/10` renders heavier in PDF — use plain `shadow-lg` or keep at `/5` max

For more on styling and layout patterns, see [references/slide-patterns.md](references/slide-patterns.md).
