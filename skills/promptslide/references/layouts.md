# Slide Master Layouts

## What Layouts Are

Layouts work like PowerPoint slide masters. They define the repeating structure (headers, footers, section numbering, background treatment) shared across slides. The slide provides its content; the layout controls where it goes.

**Create layouts early** — they ensure visual consistency and make batch edits easy. When a layout changes, all slides using it update automatically.

Use `write_layout` to create layouts. Use `data-layout="name"` on slides to apply them.

## Template Slots

Layouts use `<!-- slot:name -->` markers. Slots are flexible — define any you need.

### Text Slots (from data- attributes)

Any `data-*` attribute on `<section>` becomes a text slot:

```html
<section data-layout="content" data-title="Memory" data-section="04">
```

Layout uses: `<!-- slot:title -->` → "Memory", `<!-- slot:section -->` → "04"

### Content Slots (from `<slot>` elements)

For rich HTML content, use named `<slot>` elements:

```html
<section data-layout="split">
  <slot name="left"><h1>Problem</h1><p>Details...</p></slot>
  <slot name="right"><img src="asset://chart.png" /><p data-step="1">Insight</p></slot>
</section>
```

Layout uses: `<!-- slot:left -->` and `<!-- slot:right -->`

### Built-in Markers

| Marker | Source |
|--------|--------|
| `<!-- content -->` | Remaining slide HTML (not inside a `<slot>`) |
| `<!-- slideNumber -->` | Auto — current slide number |
| `<!-- totalSlides -->` | Auto — total slide count |

## Content Wrapping Behavior

When slide content is injected into a slot, the compiler may wrap it in a plain `<div>` (no classes) if there are multiple sibling elements. This means the injected content is not a direct flex/grid child of your layout container.

**This matters for vertical centering.** To handle this:

**Top-aligned content (default):**
```html
<div class="flex-1 px-20 py-10 overflow-hidden">
  <!-- content -->
</div>
```

**Vertically centered content:**
```html
<div class="flex-1 flex items-center justify-center px-20 py-10 overflow-hidden">
  <!-- content -->
</div>
```

**Bottom-aligned content:**
```html
<div class="flex-1 flex items-end px-20 py-10 overflow-hidden">
  <!-- content -->
</div>
```

---

## Example: Content Layout (text slots)

```html
<!-- layouts/content.html -->
<div class="flex h-full w-full flex-col bg-background">
  <!-- Header -->
  <div class="flex items-baseline gap-6 px-20 pt-12 pb-8 border-b border-border">
    <span class="text-xs text-muted-foreground uppercase tracking-[0.3em]"><!-- slot:section --></span>
    <h2 class="text-4xl font-bold tracking-tight text-foreground"><!-- slot:title --></h2>
  </div>

  <!-- Content area -->
  <div class="flex-1 px-20 py-10 overflow-hidden">
    <!-- content -->
  </div>

  <!-- Footer -->
  <div class="flex items-center justify-between px-20 py-4 border-t border-border">
    <img src="asset://logo.svg" class="h-6" />
    <span class="text-xs text-muted-foreground">
      <!-- slideNumber --> / <!-- totalSlides -->
    </span>
  </div>
</div>
```

Usage:

```html
<section data-layout="content" data-section="03" data-title="The Agentic Loop">
  <div class="grid grid-cols-3 gap-8">
    <div data-step="1" data-animate="slide-up">Card 1</div>
    <div data-step="2" data-animate="slide-up">Card 2</div>
    <div data-step="3" data-animate="slide-up">Card 3</div>
  </div>
</section>
```

---

## Example: Split Layout (content slots)

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

Usage:

```html
<section data-layout="split">
  <slot name="sidebar">
    <span class="text-xs text-muted-foreground uppercase tracking-[0.3em] mb-4">04</span>
    <h2 class="text-5xl font-bold tracking-tight text-foreground leading-tight">Memory Systems</h2>
    <p class="mt-6 text-muted-foreground leading-relaxed">How agents persist knowledge across sessions.</p>
  </slot>
  <slot name="main">
    <div class="space-y-6" data-step="1" data-animate="slide-up" data-stagger="100">
      <div>Short-term: context window</div>
      <div>Long-term: vector stores</div>
      <div>Episodic: experience replay</div>
    </div>
  </slot>
</section>
```

---

## Example: Titled Split (mixed slots)

```html
<!-- layouts/titled-split.html -->
<div class="flex h-full w-full flex-col bg-background">
  <div class="px-20 pt-12 pb-6 border-b border-border">
    <span class="text-xs text-muted-foreground uppercase tracking-[0.3em]"><!-- slot:section --></span>
    <h2 class="text-4xl font-bold text-foreground mt-2"><!-- slot:title --></h2>
  </div>
  <div class="flex flex-1">
    <div class="w-1/2 px-16 py-10 border-r border-border"><!-- slot:left --></div>
    <div class="w-1/2 px-16 py-10"><!-- slot:right --></div>
  </div>
</div>
```

---

## Recommended Workflow

1. **Create 2-3 layouts early** (after `create_deck`):
   - `content.html` — standard content slides with header + footer
   - `title.html` — section title slides, large centered text
   - `split.html` — two-column layout for comparison/detail slides
2. **Use layouts on most slides** — only go freeform for hero/closing slides
3. **Edit a layout to update all slides** — change the footer logo once, not 14 times

## Multiple Layouts

```
layouts/
├── content.html     # Standard with header/section/footer
├── title.html       # Section title, large centered
├── split.html       # Two-column with structured left panel
└── full.html        # Minimal — just padding and centering
```

Each slide chooses its layout independently via `data-layout`. Slides without `data-layout` are freeform (full 1280×720 container).

## Verify Layouts Visually

After creating or changing a layout, use `get_screenshot` on a slide that uses it to verify the rendered result. Common layout issues — broken centering from content wrapping, clipped content, wrong slot alignment — are only visible in the rendered output.
