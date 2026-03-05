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

- **No two consecutive slides should use the same layout.** If slide 3 is a card grid, slide 4 should be something completely different.
- **Vary card styles.** Don't use `rounded-xl border border-border bg-card p-8` on every slide. Mix bordered, tinted, elevated, accent-border, or no cards at all.
- **Vary animations.** Don't use `slide-up` on everything. Match the animation to the content.
- **Use asymmetry.** Not every grid needs equal columns. Try `grid-cols-5` with `col-span-2` + `col-span-3`.
- **Let content breathe.** Whitespace is a design tool. Not every slide needs to be packed with elements.
- **Typography can be the visual.** A large quote, a bold number, or a headline with a highlighted word can carry a slide without any cards or icons.

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
