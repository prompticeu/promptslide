/**
 * Guide content for the get_guide MCP tool.
 *
 * Mirrors the skill structure in skills/promptslide/:
 * - "framework"      — core reference: slide format, layouts, components, PDF constraints, workflow
 * - "animation-api"  — Animated, AnimatedGroup, Morph, step rules, animation intent
 * - "slide-design"   — content density, design principles, anti-patterns, distinctive aesthetics
 * - "style-presets"  — 8 curated visual directions with design philosophy
 * - "theming"        — colors, CSS variables, theme config, fonts, glow
 */

const guides = {
  framework: `# PromptSlide Framework Reference

Create slide decks with AI coding agents. Each slide is a React component styled with Tailwind CSS, with built-in animations and PDF export.

## Content Discovery

Before writing any code, clarify with the user:

1. **What is this presentation about?** (topic, key message)
2. **Who is the audience?** (investors, team, customers, conference)
3. **How many slides?** (suggest 5–10 for a focused deck, 10–15 for a detailed one)
4. **Do you have content ready?** (outline, bullet points, or should the agent draft it)

Use the answers to plan slide structure before creating the deck.

## Style Direction

Determine the visual direction before writing any code:

1. **Ask if they have brand guidelines** — logo, colors, fonts. If yes, use those directly.
2. **If no brand guidelines**, suggest 2–3 presets from the \`style-presets\` guide. Briefly describe each (one sentence + mood), let the user pick or mix.
3. **If the user wants something custom**, ask: dark or light? What mood? (professional, playful, dramatic, techy). Then build a custom direction from the building blocks in the presets.

The chosen direction determines what you configure:

- **Colors** → \`src/globals.css\` (\`--primary\` and other CSS variables)
- **Fonts** → \`src/theme.ts\` (see \`theming\` guide)
- **Layouts** → Custom React components in \`src/layouts/\`
- **Card styles & animations** → Applied per-slide based on the direction

Presets are starting points, not rigid templates. The user can change everything — it's all just React components and CSS variables.

## Configure Branding

Edit \`src/theme.ts\` for brand name and logo, and \`src/globals.css\` for theme colors. See the \`theming\` guide for details.

## Design Thinking

Before writing any slide code, commit to a clear aesthetic direction and plan the deck holistically. Generic, template-looking slides are worse than no slides at all.

### Pick a direction and commit

Choose a distinct visual personality — editorial, brutalist, luxury-minimal, bold geometric, warm organic — and execute it with precision throughout the deck. The key is intentionality, not intensity. A restrained minimal deck executed with perfect spacing and typography is just as strong as a bold maximalist one. What kills a deck is indecision: a little of everything, committing to nothing.

### Design each slide for its content

- **What does this content want to be?** A single powerful stat deserves to be big and alone on the slide. A comparison wants two sides. A list of features might work as clean typography with whitespace — not everything needs cards.
- **What's the rhythm of the deck?** Alternate between dense and spacious, dark and light, structured and freeform. Three white slides in a row is monotonous. Break runs with a dark "breather" slide, a full-bleed color block, or an asymmetric layout.
- **Where are the hero moments?** Every deck needs 1–2 slides that break the pattern — an oversized number, a bold color block, a single sentence with generous whitespace. These are what people remember.
- **What makes this deck UNFORGETTABLE?** Ask this before coding. If the answer is "nothing" — the design direction isn't strong enough.

Don't default to the first layout that comes to mind. Consider 2–3 options for each slide and pick the one that best serves the message.

For content density rules, design principles, and visual anti-patterns, see the \`slide-design\` guide.

---

## Authoring Slides

### Before Writing Slides

Whether this is a new deck or an existing one, confirm the visual direction with the user before creating slide files. The user's primary color may already be configured — don't overwrite it without asking.

### Directory Structure

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

### Deck Manifest (deck.json)

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

### Key Constraints

- **Slide dimensions**: 1280×720 (16:9). Content scales automatically in presentation mode.
- **Semantic colors**: Use \`text-foreground\`, \`text-muted-foreground\`, \`text-primary\`, \`bg-background\`, \`bg-card\`, \`border-border\` — these map to the theme's CSS custom properties.
- **Icons**: Import from \`lucide-react\` (e.g., \`import { ArrowRight } from "lucide-react"\`).

### Creating a Slide

Every slide is a React component that receives \`{ slideNumber, totalSlides }\`:

\`\`\`tsx
// src/slides/slide-example.tsx
import { Animated } from "promptslide"

export const meta = { steps: 1 }

export default function Example({ slideNumber, totalSlides }) {
  return (
    <div className="bg-background text-foreground flex h-full w-full flex-col p-12">
      <h2 className="text-4xl font-bold">Your Title</h2>
      <Animated step={1} animation="fade">
        <p className="text-muted-foreground text-lg mt-4">Your content</p>
      </Animated>
    </div>
  )
}
\`\`\`

Register it in \`deck.json\` by adding \`{ "id": "example" }\` to the slides array.

### Layouts (Master Themes)

Layouts are React components in \`src/layouts/\` that wrap slide content. They control structure (headers, footers, backgrounds, padding) and are the closest thing to "master slides" in traditional tools. Change a layout once, every slide using it updates.

**Create 2–4 layouts per deck for visual variety.**

### Animations

Use \`<Animated>\` for click-to-reveal steps and \`<AnimatedGroup>\` for staggered reveals. Available animations: \`fade\`, \`slide-up\`, \`slide-down\`, \`slide-left\`, \`slide-right\`, \`scale\`.

**Critical rules**:
- The \`steps\` value in \`export const meta\` MUST equal the highest \`step\` number used in that slide. \`steps: 0\` means no animations.
- \`<Animated>\` renders a wrapper \`<div>\`. When inside a **grid or flex container**, you MUST pass layout classes (\`h-full\`, \`w-full\`, \`col-span-*\`) via \`className\` on the \`<Animated>\`, not only on the inner child — otherwise the wrapper collapses and breaks the layout.

For the full animation API, see the \`animation-api\` guide.

### Styling Constraints (PDF Compatibility)

These rules ensure slides look identical on screen and in PDF export:

- **No blur**: \`filter: blur()\` and \`backdrop-filter: blur()\` are silently dropped by Chromium's PDF pipeline
- **No gradients**: \`bg-gradient-to-*\` and radial gradients render inconsistently — use solid colors with opacity instead (e.g., \`bg-primary/5\`, \`bg-muted/20\`)
- **No shadows**: \`box-shadow\` (including \`shadow-sm\`, \`shadow-lg\`, \`shadow-2xl\`) does not export correctly to PDF — use borders or background tints instead (e.g., \`border border-border\`, \`bg-white/5\`)

### Visual Verification

**Always verify slides visually after creating or editing them.**

- **get_screenshot(slide)** — capture a single slide as PNG
- **get_deck_overview** — thumbnail grid of all slides

Common issues only visible in rendered output: broken alignment, wrong colors,
text overflow, content clipped by overflow-hidden.

### Troubleshooting

- **get_build_errors** — check for Vite compilation errors and dev server issues
- **validate_deck** — render every slide and report per-slide status
- **get_project_files** — list all files in the deck directory

Common issues:
- Import errors (\`@/layouts/...\` path wrong) → check with get_build_errors
- Slide not rendering → validate_deck shows per-slide errors
- Animations not working → verify \`export const meta = { steps: N }\` matches highest step number
- Content clipped → check for missing \`overflow-hidden\` or wrong flex layout

## Workflow

1. **Content discovery** → clarify topic, audience, slide count with the user
2. **Style direction** → ask about brand guidelines or suggest presets from \`style-presets\` guide
3. **Design plan** → present your visual direction and per-slide layout approach to the user for approval
4. create_deck → directory structure + deck.json + globals.css
5. Configure branding → edit globals.css (\`--primary\`) and theme.ts via read_file + write tools (see \`theming\` guide)
6. write_layout × 2-4 → purpose-specific layouts (content, title, split, etc.)
7. write_component (optional) → reusable cards, stat blocks, etc.
8. create_slide × N → slides importing different layouts
9. get_screenshot / get_deck_overview → verify visuals
10. get_build_errors → check for compilation issues
11. edit_slide / write_slide → iterate based on visual feedback
12. validate_deck → verify all slides render
13. export_pdf → generate a shareable deck artifact`,

  "animation-api": `# Animation API Reference

## Animated Component

Reveals content at a specific animation step (click-to-reveal).

\`\`\`tsx
import { Animated } from "promptslide"

<Animated step={1} animation="slide-up" duration={0.4} delay={0.05} className="flex">
  <p>Content</p>
</Animated>
\`\`\`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`step\` | \`number\` | required | Which click reveals this content (1-indexed) |
| \`animation\` | \`AnimationType\` | \`"slide-up"\` | Animation style |
| \`duration\` | \`number\` | \`0.4\` | Duration in seconds |
| \`delay\` | \`number\` | \`0\` | Delay after trigger in seconds |
| \`className\` | \`string\` | — | Additional CSS classes (use for layout preservation) |

> **Layout warning:** \`<Animated>\` renders a wrapper \`<div>\`. When used as a direct child of a **grid** or **flex** container, you MUST pass layout classes (\`h-full\`, \`w-full\`, \`col-span-*\`, \`row-span-*\`, etc.) via \`className\` on the \`<Animated>\` — not only on the inner child. Without this, the wrapper collapses and breaks the layout.
>
> \`\`\`tsx
> // BROKEN — wrapper div collapses, card won't fill the grid cell
> <div className="grid h-full grid-cols-2 gap-4">
>   <Animated step={1} animation="slide-up">
>     <div className="h-full rounded-2xl bg-card p-6">...</div>
>   </Animated>
> </div>
>
> // CORRECT — layout classes on the Animated wrapper
> <div className="grid h-full grid-cols-2 gap-4">
>   <Animated step={1} animation="slide-up" className="h-full">
>     <div className="h-full rounded-2xl bg-card p-6">...</div>
>   </Animated>
> </div>
> \`\`\`

### Animation Types

| Type | Effect |
|------|--------|
| \`fade\` | Fade in (opacity only) |
| \`slide-up\` | Slide up + fade in |
| \`slide-down\` | Slide down + fade in |
| \`slide-left\` | Slide from right + fade in |
| \`slide-right\` | Slide from left + fade in |
| \`scale\` | Scale up from 0.8 + fade in |

---

## AnimatedGroup Component

Staggers multiple children with sequential delays, all triggered by a single step.

\`\`\`tsx
import { AnimatedGroup } from "promptslide"

<AnimatedGroup
  startStep={1}
  animation="slide-up"
  staggerDelay={0.1}
  className="grid grid-cols-3 gap-6"
>
  <Card>First</Card>
  <Card>Second</Card>
  <Card>Third</Card>
</AnimatedGroup>
\`\`\`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`startStep\` | \`number\` | required | Which click reveals the group (1-indexed) |
| \`animation\` | \`AnimationType\` | \`"slide-up"\` | Animation style for all children |
| \`staggerDelay\` | \`number\` | \`0.1\` | Delay between each child in seconds |
| \`className\` | \`string\` | — | Additional CSS classes |

> **Grid span warning:** \`AnimatedGroup\` wraps each child in a motion \`<div>\` that has **no className**. CSS grid span classes (\`col-span-*\`, \`row-span-*\`) and sizing classes (\`h-full\`, \`w-full\`) on the inner children will NOT affect grid placement — they must be on the direct grid children. For bento/spanning grids or any grid where children need to fill their cells, use individual \`<Animated>\` components with \`className\` instead:
>
> \`\`\`tsx
> <div className="grid h-full grid-cols-3 grid-rows-2 gap-4">
>   <Animated step={1} animation="slide-down" className="col-span-2 h-full">
>     <div className="h-full rounded-2xl bg-card p-6">Wide card</div>
>   </Animated>
>   <Animated step={1} animation="slide-down" className="row-span-2 h-full">
>     <div className="h-full rounded-2xl bg-card p-6">Tall card</div>
>   </Animated>
> </div>
> \`\`\`

---

## Step Count Rules

- Steps are **1-indexed** (step 1 = first click)
- Multiple \`<Animated>\` elements can share the same step (they appear together)
- The \`steps\` value in \`export const meta\` **must equal** the highest step number used in that slide
- If a slide has no \`<Animated>\` components, use \`steps: 0\`

### Common Patterns

**Sequential cards** — each card gets its own step:

\`\`\`tsx
<Animated step={1} animation="slide-up"><Card>A</Card></Animated>
<Animated step={2} animation="slide-up" delay={0.05}><Card>B</Card></Animated>
<Animated step={3} animation="slide-up" delay={0.1}><Card>C</Card></Animated>
// meta: { steps: 3 }
\`\`\`

**Grouped by row** — top row on step 1, bottom row on step 2 (note \`className="h-full"\` for grid cells):

\`\`\`tsx
{items.map((item, index) => (
  <Animated
    key={item.title}
    step={index < 3 ? 1 : 2}
    animation="slide-up"
    delay={(index % 3) * 0.05}
    className="h-full"
  >
    <Card>{item.title}</Card>
  </Animated>
))}
// meta: { steps: 2 }
\`\`\`

**All at once with stagger** — single step, visual stagger via delay:

\`\`\`tsx
{items.map((item, index) => (
  <Animated key={item.name} step={1} animation="slide-up" delay={index * 0.05}>
    <Row>{item.name}</Row>
  </Animated>
))}
// meta: { steps: 1 }
\`\`\`

---

## Morph Animations

Smoothly transition shared elements between consecutive slides using Framer Motion's \`layoutId\`.

**Note**: Morph is currently disabled in fullscreen presentation mode due to CSS transform conflicts with Framer Motion's layoutId calculations.

### Morph

\`\`\`tsx
import { Morph } from "promptslide"

// Slide 1 — large version
<Morph layoutId="hero-title">
  <h1 className="text-6xl">Title</h1>
</Morph>

// Slide 2 — small version (same layoutId = morphs between them)
<Morph layoutId="hero-title">
  <h1 className="text-2xl">Title</h1>
</Morph>
\`\`\`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| \`layoutId\` | \`string\` | required | Shared ID between slides (must match) |
| \`transition\` | \`Transition\` | \`MORPH_TRANSITION\` | Custom Framer Motion transition |
| \`className\` | \`string\` | — | Additional CSS classes |

### MorphGroup + MorphItem

Group multiple morph elements together:

\`\`\`tsx
import { MorphGroup, MorphItem } from "promptslide"

<MorphGroup groupId="card" className="flex gap-4">
  <MorphItem id="icon" prefix="card"><Icon /></MorphItem>
  <MorphItem id="title" prefix="card"><h2>Title</h2></MorphItem>
</MorphGroup>
\`\`\`

MorphItem generates layoutIds by combining \`prefix\` and \`id\` (e.g., \`"card-icon"\`, \`"card-title"\`).

### MorphText

Specialized for text that changes size between slides:

\`\`\`tsx
import { MorphText } from "promptslide"

// Slide 1
<MorphText layoutId="heading" as="h1" className="text-6xl">Title</MorphText>

// Slide 2
<MorphText layoutId="heading" as="h2" className="text-2xl">Title</MorphText>
\`\`\`

The \`as\` prop accepts: \`"h1"\`, \`"h2"\`, \`"h3"\`, \`"h4"\`, \`"p"\`, \`"span"\` (default: \`"span"\`).

---

## Slide Transitions

Set in deck.json or per-slide via \`export const meta = { transition: "zoom" }\`:
\`fade\` (default), \`slide-left\`, \`slide-right\`, \`slide-up\`, \`slide-down\`,
\`zoom\`, \`zoom-fade\`, \`morph\`, \`none\`

---

## Animation Intent Guide

Choose animations based on the mood and purpose of the presentation, not just technical preference.

| Mood | Recommended Animations | Timing | Notes |
|------|----------------------|--------|-------|
| **Professional / Corporate** | \`fade\`, \`slide-up\` | \`duration: 0.3\`, short delays | Subtle and fast. Don't distract from the message. |
| **Dramatic / Cinematic** | \`fade\`, \`scale\` | \`duration: 0.6–0.8\`, \`delay: 0.1–0.2\` | Slow reveals build tension. Use \`scale\` for hero moments. |
| **Playful / Startup** | \`scale\`, \`slide-up\` | \`duration: 0.4\`, \`staggerDelay: 0.08\` | Bouncy feel. Use \`AnimatedGroup\` with tight stagger for energy. |
| **Techy / Developer** | \`fade\`, \`slide-left\` | \`duration: 0.3\`, sequential steps | Clean directional motion. Step-by-step reveals suit technical content. |
| **Calm / Minimal** | \`fade\` | \`duration: 0.5–0.6\`, \`delay: 0.1\` | Gentle, slow fades only. Avoid slide/scale — less is more. |
| **Editorial / Storytelling** | \`slide-up\`, \`fade\` | \`duration: 0.4\`, staggered | Reveal text in reading order. Stagger headlines then body content. |

**General rules:**
- Faster animations (0.2–0.3s) feel professional; slower (0.5–0.8s) feel dramatic
- Match stagger direction to reading direction (top-to-bottom = \`slide-up\`, left-to-right = \`slide-left\`)
- Use \`scale\` sparingly — it draws the most attention, so reserve it for key moments
- A slide with no animations (\`steps: 0\`) is perfectly fine for simple content slides`,

  "slide-design": `# Slide Design Guide

Design visually diverse, clean slide decks. Every slide should look different from its neighbors — vary layouts, card styles, and animations throughout the deck.

---

## Content Density

Slides are projected, not read. Enforce strict limits per slide type — if content exceeds them, split across multiple slides.

**Title slides:**
- 1 heading + 1 subtitle (max 10 words)
- Optional: logo, tagline, or single visual

**Content slides:**
- 1 heading + 4–6 bullet points, OR
- 1 heading + 2 short paragraphs (2–3 sentences each), OR
- 1 heading + 2–4 cards/items in a grid

**Data slides:**
- 1 heading + 1 chart/table/diagram
- Max 6 rows in a table, max 4 data points in a comparison

**Quote slides:**
- 1 quote (max 30 words) + attribution

**Split rule:** If you're writing a 7th bullet point or a 3rd paragraph, stop — create a second slide instead. Two clean slides always beat one cramped one.

---

## Design Thinking

Before writing any slide code, commit to a clear aesthetic direction and plan the deck holistically. Generic, template-looking slides are worse than no slides at all.

### Pick a direction and commit

Choose a distinct visual personality — editorial, brutalist, luxury-minimal, bold geometric, warm organic — and execute it with precision throughout the deck. The key is intentionality, not intensity. A restrained minimal deck executed with perfect spacing and typography is just as strong as a bold maximalist one. What kills a deck is indecision: a little of everything, committing to nothing.

### Design each slide for its content

- **What does this content want to be?** A single powerful stat deserves to be big and alone on the slide. A comparison wants two sides. A list of features might work as clean typography with whitespace — not everything needs cards.
- **What's the rhythm of the deck?** Alternate between dense and spacious, dark and light, structured and freeform. Three white slides in a row is monotonous. Break runs with a dark "breather" slide, a full-bleed color block, or an asymmetric layout.
- **Where are the hero moments?** Every deck needs 1–2 slides that break the pattern — an oversized number, a bold color block, a single sentence with generous whitespace. These are what people remember.
- **What makes this deck UNFORGETTABLE?** Ask this before coding. If the answer is "nothing" — the design direction isn't strong enough.

Don't default to the first layout that comes to mind. Consider 2–3 options for each slide and pick the one that best serves the message.

---

## Design Principles

**Let the content shape the layout.** Before coding each slide, ask: what is this content trying to say, and what's the best way to show it?

- A single important number → make it huge, give it the whole slide
- A comparison or before/after → side by side, not stacked cards
- A list of features → maybe clean typography with whitespace is enough — not everything needs cards
- A key message or quote → let it breathe with generous space around it
- A process or timeline → show the flow visually, not as a grid of boxes

**Create rhythm across the deck.** A dense data slide followed by a spacious quote creates contrast. Alternate between structured and freeform, tight and airy. Every deck should have 1–2 "hero moments" — slides that break the pattern with oversized typography, a bold color block, or a single idea given the whole canvas.

**Use visual variety as a tool, not a rule.** Mix card treatments (bordered, tinted, accent-border, none), try asymmetric grids (\`col-span-2\` + \`col-span-3\`), vary heading sizes, and match animations to the content's energy. The goal isn't variety for its own sake — it's that each slide feels intentionally designed for what it's showing.

---

## Visual Anti-Patterns

Avoid these common mistakes that make slides look generic or "AI-generated":

**Overused patterns:**
- Same card style on every slide (\`rounded-xl border bg-card p-8\` everywhere)
- Uniform icon-title-description grids on 3+ consecutive slides
- Centering everything — use left-aligned, asymmetric, or split layouts for variety
- Every heading the same size and weight — vary hierarchy with \`text-2xl\` to \`text-6xl\`

**Generic aesthetics:**
- Purple/indigo as the default accent on every deck — match the brand or pick a distinctive palette
- Low-contrast muted colors everywhere — use at least one bold accent or contrast moment
- Identical spacing on all slides — let some content breathe with generous whitespace, pack others tightly for energy

**What to do instead:**
- Mix at least 3 different visual treatments across a deck: full-bleed color, cards, typography-driven, data-heavy, asymmetric grid
- Use one "hero moment" slide with oversized typography or a single bold number
- Alternate between dense and spacious slides for rhythm
- Use color blocking (full-width \`bg-primary\` sections) sparingly but deliberately for impact

---

## Distinctive Aesthetics (Adapted for Slides)

Slides must look genuinely designed, not AI-generated. Apply these principles within the PDF compatibility constraints (no gradients, no blur, no shadows).

### Typography as a design tool

Fonts are projected large and seen at a distance — they carry real visual weight in slides.

- **Choose fonts that fit the deck's personality.** Don't default to the first familiar name. Pick something that matches the mood. See the \`theming\` guide for pairing principles.
- **Use weight contrast for hierarchy.** Headings at 800–900 weight, body at 400. Heavy titles against light body text creates structure without needing color or size alone.
- **Vary heading sizes across slides.** Not every title needs to be \`text-3xl\`. A hero stat at \`text-8xl\` next to a slide with a \`text-xl\` heading creates rhythm.

### Color as a weapon, not wallpaper

- **Use the primary color sparingly and deliberately.** A blue accent bar on every slide means none of them stand out. Save bold color for 3–4 key moments: the cover, a chapter divider, a total-cost callout, the closing.
- **Dominant + accent outperforms even distribution.** A mostly dark/white deck with sharp blue accents on key elements has more impact than blue sprinkled everywhere at equal weight.
- **Refine raw brand colors for screen use.** Pure colors like \`#0000FF\`, \`#FF0000\`, \`#00FF00\` are harsh on screens and projectors. Shift them slightly (e.g., \`#0033FF\`, \`#E63946\`, \`#00B865\`) — still recognizably the brand, but less retina-searing.

### Atmosphere within PDF constraints

You can't use gradients, blur, or box-shadow — but you can create depth and atmosphere:

- **Solid color blocks** as design elements — a bold colored panel, a dark sidebar, a full-bleed background change
- **Glow overlays** — a radial glow PNG can add subtle depth on dark slides. Generate one with Pillow (see style-presets guide) and place in \`public/images/\`. Position it \`absolute inset-0\` with \`object-cover\` and \`opacity-30\` to \`opacity-50\`.
- **Opacity layers** — \`bg-white/5\`, \`bg-primary/10\` on dark backgrounds create subtle depth
- **Borders as structure** — colored top borders (\`border-t-[3px] border-primary\`) on cards create accent without shadows
- **Image overlays at low opacity** — brand patterns or textures at 5–10% opacity add atmosphere without competing with content
- **Asymmetric layouts** — a 60/40 split feels more designed than 50/50. Grid-breaking elements (a column that spans two rows, a stat that overlaps a section boundary) add visual interest.

### The "unforgettable" test

Before finalizing a deck, ask: **if someone saw this deck for 10 seconds, what would they remember?** If the answer is "nothing specific" — the design needs a stronger hero moment. Every deck needs at least one slide that makes someone pause: an oversized number, a bold color block, a single sentence with dramatic whitespace, or an unexpected layout that breaks the grid.`,

  "style-presets": `# Style Presets

Curated visual directions for slide decks. Use these as mood inspiration, not as a spec to follow row by row. Each preset describes a color palette, card treatment, and animation feel — but the actual design of each slide should come from thinking about what the content needs (see the slide-design guide). Choose fonts separately based on the deck's personality (see the theming guide).

---

## Dark Themes

### 1. Electric Noir

High-contrast dark background with a single vivid accent color. Large section numbers or oversized typography as visual anchors.

**Design philosophy:** Let bold scale contrasts do the heavy lifting — oversized numbers next to small labels, huge headlines against dark space. Slides should feel cinematic, not busy.

| Property | Value |
|----------|-------|
| **Primary** | \`oklch(0.65 0.25 250)\` (electric blue) |
| **Background** | Near-black (\`oklch(0.13 0 0)\`) |
| **Cards** | No borders. Subtle \`bg-white/5\` tint. |
| **Animations** | \`fade\` and \`scale\` — slow (0.5s). Dramatic reveals. |
| **Signature** | Oversized numbers (\`text-8xl text-primary/20\`) as slide accents |

### 2. Midnight Studio

Warm dark theme with amber/gold accents. Sophisticated and editorial.

**Design philosophy:** The serif/sans contrast carries the visual weight — let typography be the design element. Reach for pull quotes, editorial layouts, and whitespace over card grids.

| Property | Value |
|----------|-------|
| **Primary** | \`oklch(0.7 0.18 70)\` (warm amber) |
| **Background** | Deep charcoal (\`oklch(0.15 0.01 60)\`) |
| **Cards** | Thin \`border-primary/10\` borders. No fill. |
| **Animations** | \`fade\` only — slow (0.6s). Elegant, minimal motion. |
| **Signature** | Serif headlines create contrast against clean body text |

### 3. Neon Terminal

Developer/hacker aesthetic. Monospace type, green-on-dark, terminal feel.

**Design philosophy:** Lean into the code aesthetic — monospace text, command-line prefixes, and tight structure are the visuals. Slides should feel like well-formatted terminal output, not design artifacts.

| Property | Value |
|----------|-------|
| **Primary** | \`oklch(0.75 0.2 145)\` (terminal green) |
| **Background** | True black (\`oklch(0.1 0 0)\`) |
| **Cards** | \`border border-primary/20 bg-primary/5\`. Code-block aesthetic. |
| **Animations** | \`fade\` with short duration (0.2s). Instant, snappy. |
| **Signature** | Monospace everything. Use \`>\` prefixes and \`//\` comments as visual texture |

---

## Light Themes

### 4. Clean Corporate

Minimal, professional white theme. No visual noise.

**Design philosophy:** Restraint is the design. Use generous whitespace and clean typography to convey authority. Let data and key numbers be the visual anchors — the absence of decoration is the style.

| Property | Value |
|----------|-------|
| **Primary** | \`oklch(0.5 0.2 250)\` (classic blue) |
| **Background** | Pure white |
| **Cards** | \`border border-border bg-card\`. |
| **Animations** | \`slide-up\` — fast (0.3s). Professional, no-nonsense. |
| **Signature** | Generous whitespace. Let typography and data carry the slide. |

### 5. Warm Editorial

Magazine-inspired layout with warm neutrals and serif headings.

**Design philosophy:** Think magazine spread, not slide deck. Use asymmetric text layouts, horizontal rules as structure, and pull quotes as visual anchors. Cards would fight the editorial feel — let typography and spacing do the work.

| Property | Value |
|----------|-------|
| **Primary** | \`oklch(0.55 0.15 30)\` (warm terracotta) |
| **Background** | Off-white (\`oklch(0.98 0.005 80)\`) |
| **Cards** | No cards. Use horizontal rules (\`border-t\`), pull quotes, and typography hierarchy. |
| **Animations** | \`slide-up\` and \`fade\` — medium (0.4s). Reading-order stagger. |
| **Signature** | Large pull quotes. Asymmetric text layouts. Drop caps. |

### 6. Pastel Soft

Friendly, approachable light theme with soft pastels.

**Design philosophy:** Warmth through color, not complexity. Tinted card backgrounds and rounded shapes create friendliness — lean into playful color variety across slides rather than uniform structure.

| Property | Value |
|----------|-------|
| **Primary** | \`oklch(0.6 0.15 280)\` (soft purple) |
| **Background** | Light warm gray (\`oklch(0.97 0.005 80)\`) |
| **Cards** | Rounded (\`rounded-2xl\`), tinted backgrounds (\`bg-primary/5\`, \`bg-accent/5\`). No borders. |
| **Animations** | \`scale\` and \`slide-up\` — medium (0.4s), tight stagger (0.08s). Playful. |
| **Signature** | Colored card backgrounds that alternate between primary/accent tints |

---

## Specialty Themes

### 7. Grid Rational

Bauhaus/Swiss design. Geometric precision, strong grid, bold color blocks.

**Design philosophy:** The grid *is* the design. Use bold color blocks, sharp edges, and geometric layouts. Every element should feel placed with intention — asymmetric grids and strong vertical/horizontal divisions over soft cards.

| Property | Value |
|----------|-------|
| **Primary** | \`oklch(0.6 0.25 30)\` (bold red) |
| **Background** | White |
| **Cards** | Full-bleed color blocks (\`bg-primary\`, \`bg-foreground\`). No rounded corners (\`rounded-none\`). |
| **Animations** | \`slide-left\` and \`slide-up\` — fast (0.25s). Geometric, directional. |
| **Signature** | Grid-based layouts. Black/red/white only. Bold geometric dividers. |

### 8. Deep Night

Rich dark theme with deep blue-to-purple color palette. Polished and modern.

**Design philosophy:** Depth through layered opacity — cards at different transparency levels create a sense of dimension. Vary visual weight across slides with solid primary accents as focal points. Use solid colors with opacity (e.g., \`bg-white/5\`, \`bg-primary/10\`) — not gradients.

| Property | Value |
|----------|-------|
| **Primary** | \`oklch(0.65 0.22 280)\` (vibrant purple) |
| **Background** | Deep navy (\`oklch(0.15 0.03 270)\`) |
| **Cards** | \`bg-white/5 border border-white/10\`. Frosted glass look (without blur — use opacity). |
| **Animations** | \`fade\` and \`slide-up\` — medium (0.4s). Smooth, polished. |
| **Signature** | Layered opacity cards. Use \`bg-primary/10\` accents against dark backgrounds. |

---

## Using a Preset

1. Set the \`--primary\` color in \`src/globals.css\` (in the \`:root\` block)
2. Load fonts via \`<link>\` in \`index.html\` (Google Fonts or Fontshare)
3. Set \`fonts.heading\` and \`fonts.body\` in \`src/theme.ts\`
4. Follow the card style and animation recommendations when building slides
5. Use the "signature" element on at least 1–2 slides for visual identity

Presets are starting points. Mix elements across presets if the brand calls for it.`,

  theming: `# Theming & Branding Reference

## Brand Color

Change your brand color by editing \`--primary\` in \`src/globals.css\`:

\`\`\`css
:root {
  --primary: oklch(0.55 0.2 250);
}
\`\`\`

### Example Brand Colors

| Brand | OKLCH Value | Hue |
|-------|-------------|-----|
| Blue (default) | \`oklch(0.55 0.2 250)\` | 250 |
| Purple | \`oklch(0.55 0.2 300)\` | 300 |
| Green | \`oklch(0.6 0.2 145)\` | 145 |
| Orange | \`oklch(0.661 0.201 41)\` | 41 |
| Red | \`oklch(0.577 0.245 27)\` | 27 |
| Teal | \`oklch(0.6 0.15 195)\` | 195 |

---

## OKLCH Color System

Format: \`oklch(lightness chroma hue)\`

| Parameter | Range | Description |
|-----------|-------|-------------|
| **Lightness** | 0 (black) to 1 (white) | How bright the color is |
| **Chroma** | 0 (gray) to ~0.4 (vivid) | Color intensity/saturation |
| **Hue** | 0–360 | Color wheel angle |

**Hue reference**: 0=red, 30=orange, 60=yellow, 120=green, 195=teal, 250=blue, 300=purple, 330=pink

**Tips for picking values**:
- Primary: lightness 0.5–0.65, chroma 0.15–0.25
- Keep chroma above 0.15 for vibrant brand colors

---

## All CSS Variables

\`\`\`css
:root {
  --background: oklch(0.159 0 0);       /* Near-black */
  --foreground: oklch(0.985 0 0);       /* Near-white */
  --card: oklch(0.205 0 0);             /* Dark gray */
  --card-foreground: oklch(0.985 0 0);
  --primary: oklch(0.55 0.2 250);       /* Brand color */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.985 0 0);
  --secondary-foreground: oklch(0.141 0 0);
  --muted: oklch(0.305 0 0);            /* Muted backgrounds */
  --muted-foreground: oklch(0.712 0 0); /* Secondary text */
  --accent: oklch(0.305 0 0);
  --accent-foreground: oklch(0.925 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.269 0 0);           /* Borders */
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --radius: 0.625rem;
}
\`\`\`

---

## Semantic Color Classes

Use these Tailwind classes for consistent theming:

| Class | Purpose | Use For |
|-------|---------|---------|
| \`text-foreground\` | Primary text | Headings, important text |
| \`text-muted-foreground\` | Secondary text | Descriptions, labels |
| \`text-primary\` | Brand color text | Accents, highlights, numbers |
| \`text-primary-foreground\` | Text on primary bg | Button labels on primary buttons |
| \`bg-background\` | Page background | Slide background |
| \`bg-card\` | Card background | Content cards, panels |
| \`bg-primary\` | Primary background | Accent backgrounds |
| \`bg-primary/10\` | Subtle primary bg | Icon backgrounds, highlights |
| \`border-border\` | Standard border | Card borders, dividers |

---

## Theme Setup

Configure in \`src/theme.ts\`:

\`\`\`ts
import type { ThemeConfig } from "promptslide"

export const theme: ThemeConfig = {
  name: "Acme Inc",
  logo: {
    full: "/logo.svg",
    icon: "/icon.svg",            // Compact variant (title slides)
    fullLight: "/logo-white.svg", // For dark backgrounds
  },
  colors: {
    primary: "oklch(0.55 0.2 250)",
    secondary: "oklch(0.6 0.15 200)",
    accent: "oklch(0.7 0.2 50)",
  },
  fonts: {
    heading: "Inter",
    body: "Inter",
  },
}
\`\`\`

Everything is optional except \`name\`. Omitted values fall back to \`globals.css\` defaults.

- Place your logo file in the \`public/\` directory (e.g., \`public/logo.svg\`)
- The logo appears in the footer of every slide (unless \`hideFooter\` is set)
- Logo renders at \`h-8 w-auto\` (32px height, auto width)
- Colors use OKLCH format and are injected as CSS variable overrides at runtime

---

## Background Glow (Optional)

A radial glow PNG can add subtle depth on dark slides. It's one design option among many — not a default.

**Generating a glow asset** (Python + Pillow):

\`\`\`python
from PIL import Image, ImageDraw, ImageFilter
img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
draw.ellipse([360, 140, 1560, 940], fill=(255, 255, 255, 80))
img = img.filter(ImageFilter.GaussianBlur(radius=150))
img.save("glow-white.png")
\`\`\`

This technique works for any color — swap \`(255, 255, 255, 80)\` for \`(0, 120, 255, 60)\` etc. Save to \`public/images/\` and use \`import_asset\` or \`import_from_url\` to add it to the deck.

Usage in a slide:

\`\`\`tsx
<img
  src="/images/glow-white.png"
  alt=""
  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
/>
\`\`\`

Adjust \`opacity-40\` to control intensity. Uses a PNG (not CSS gradient) for PDF export compatibility.

---

## Font Pairings

Load fonts via \`<link>\` in \`index.html\` (Google Fonts or Fontshare), then set them in \`src/theme.ts\`.

Choose fonts that match the deck's personality. Don't default to the first familiar name.

**Pairing principles:**
- One font family for the whole deck is fine — don't force a pairing
- Serif headings + sans body = classic contrast (editorial, formal)
- Sans headings + sans body = modern, clean (most presentations)
- Monospace everything = developer/hacker aesthetic only
- Avoid pairing two serif fonts — it gets busy
- **Avoid defaulting to Inter, Roboto, or Arial** — they're readable but generic. If the brand doesn't mandate a specific font, choose one with more character.`
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
