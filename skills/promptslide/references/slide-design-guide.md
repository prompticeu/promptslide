# Slide Design Guide

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

## Design Principles

**Let the content shape the layout.** Before coding each slide, ask: what is this content trying to say, and what's the best way to show it?

- A single important number → make it huge, give it the whole slide
- A comparison or before/after → side by side, not stacked cards
- A list of features → maybe clean typography with whitespace is enough — not everything needs cards
- A key message or quote → let it breathe with generous space around it
- A process or timeline → show the flow visually, not as a grid of boxes

**Create rhythm across the deck.** A dense data slide followed by a spacious quote creates contrast. Alternate between structured and freeform, tight and airy. Every deck should have 1–2 "hero moments" — slides that break the pattern with oversized typography, a bold color block, or a single idea given the whole canvas.

**Use visual variety as a tool, not a rule.** Mix card treatments (bordered, tinted, accent-border, none), try asymmetric grids (`col-span-2` + `col-span-3`), vary heading sizes, and match animations to the content's energy. The goal isn't variety for its own sake — it's that each slide feels intentionally designed for what it's showing.

---

## Visual Anti-Patterns

Avoid these common mistakes that make slides look generic or "AI-generated":

**Overused patterns:**
- Same card style on every slide (`rounded-xl border bg-card p-8` everywhere)
- Uniform icon-title-description grids on 3+ consecutive slides
- Centering everything — use left-aligned, asymmetric, or split layouts for variety
- Every heading the same size and weight — vary hierarchy with `text-2xl` to `text-6xl`

**Generic aesthetics:**
- Purple/indigo as the default accent on every deck — match the brand or pick a distinctive palette
- Low-contrast muted colors everywhere — use at least one bold accent or contrast moment
- Identical spacing on all slides — let some content breathe with generous whitespace, pack others tightly for energy

**What to do instead:**
- Mix at least 3 different visual treatments across a deck: full-bleed color, cards, typography-driven, data-heavy, asymmetric grid
- Use one "hero moment" slide with oversized typography or a single bold number
- Alternate between dense and spacious slides for rhythm
- Use color blocking (full-width `bg-primary` sections) sparingly but deliberately for impact

---

## Distinctive Aesthetics (Adapted for Slides)

Slides must look genuinely designed, not AI-generated. Apply these principles within the PDF compatibility constraints (no gradients, no blur, no shadows).

### Typography as a design tool

Fonts are projected large and seen at a distance — they carry real visual weight in slides.

- **Choose fonts that fit the deck's personality.** Don't default to the first familiar name. Browse [Google Fonts](https://fonts.google.com) or [Fontshare](https://www.fontshare.com) and pick something that matches the mood. See [theming.md](theming.md) for color and font configuration.
- **Use weight contrast for hierarchy.** Headings at 800–900 weight, body at 400. Heavy titles against light body text creates structure without needing color or size alone.
- **Vary heading sizes across slides.** Not every title needs to be `text-3xl`. A hero stat at `text-8xl` next to a slide with a `text-xl` heading creates rhythm.

### Color as a weapon, not wallpaper

- **Use the primary color sparingly and deliberately.** A blue accent bar on every slide means none of them stand out. Save bold color for 3–4 key moments: the cover, a chapter divider, a total-cost callout, the closing.
- **Dominant + accent outperforms even distribution.** A mostly dark/white deck with sharp blue accents on key elements has more impact than blue sprinkled everywhere at equal weight.
- **Refine raw brand colors for screen use.** Pure colors like `#0000FF`, `#FF0000`, `#00FF00` are harsh on screens and projectors. Shift them slightly (e.g., `#0033FF`, `#E63946`, `#00B865`) — still recognizably the brand, but less retina-searing.

### Atmosphere within PDF constraints

You can't use gradients, blur, or box-shadow — but you can create depth and atmosphere:

- **Solid color blocks** as design elements — a bold colored panel, a dark sidebar, a full-bleed background change
- **Opacity layers** — `bg-white/5`, `bg-primary/10` on dark backgrounds create subtle depth
- **Borders as structure** — colored top borders (`border-t-[3px] border-primary`) on cards create accent without shadows
- **Image overlays at low opacity** — brand patterns or textures at 5–10% opacity add atmosphere without competing with content
- **Asymmetric layouts** — a 60/40 split feels more designed than 50/50. Grid-breaking elements (a column that spans two rows, a stat that overlaps a section boundary) add visual interest.

### The "unforgettable" test

Before finalizing a deck, ask: **if someone saw this deck for 10 seconds, what would they remember?** If the answer is "nothing specific" — the design needs a stronger hero moment. Every deck needs at least one slide that makes someone pause: an oversized number, a bold color block, a single sentence with dramatic whitespace, or an unexpected layout that breaks the grid.
