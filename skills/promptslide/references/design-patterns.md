# Slide & Layout Design Patterns

Reusable patterns for visually diverse slide decks. **Do not use the same pattern on consecutive slides** — mix and match to keep the deck visually engaging.

---

## Background Treatments

### Gradient Mesh Background

Layered blurred gradient orbs create a rich, ambient backdrop:

```html
<section class="relative flex items-center justify-center overflow-hidden bg-background">
  <div class="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background"></div>
  <div class="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl"></div>
  <div class="absolute bottom-1/4 right-10 h-64 w-64 rounded-full bg-primary/5 blur-2xl"></div>

  <div class="relative z-10 text-center px-16">
    <!-- Content here -->
  </div>
</section>
```

### Split Background

Asymmetric split with solid primary on one side:

```html
<section class="relative overflow-hidden">
  <div class="absolute inset-y-0 left-0 w-2/5 bg-primary"></div>
  <div class="relative flex h-full">
    <div class="w-2/5 flex flex-col justify-center px-12">
      <h2 class="text-5xl font-bold text-primary-foreground">Statement</h2>
    </div>
    <div class="w-3/5 flex flex-col justify-center px-12">
      <!-- Right content -->
    </div>
  </div>
</section>
```

### Spotlight / Vignette

A subtle radial glow that draws focus to the center:

```html
<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--primary)_0%,_transparent_70%)] opacity-10"></div>
<div class="relative z-10">Content here</div>
```

---

## Card Styles

Avoid using the same card style across the entire deck. Alternate between these:

### Glass Card

```html
<div class="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-primary/5 backdrop-blur-md">
  <h3 class="text-lg font-semibold text-foreground">Title</h3>
  <p class="text-sm text-muted-foreground">Description</p>
</div>
```

### Gradient Card

```html
<div class="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/15 to-transparent p-8">
  <h3 class="text-lg font-semibold text-foreground">Title</h3>
  <p class="text-sm text-muted-foreground">Description</p>
</div>
```

### Elevated Card

```html
<div class="rounded-2xl bg-card p-8 shadow-xl shadow-primary/10">
  <h3 class="text-lg font-semibold text-foreground">Title</h3>
  <p class="text-sm text-muted-foreground">Description</p>
</div>
```

### Accent-Border Card

```html
<div class="rounded-2xl border border-border border-l-4 border-l-primary bg-card p-8">
  <h3 class="text-lg font-semibold text-foreground">Title</h3>
  <p class="text-sm text-muted-foreground">Description</p>
</div>
```

---

## Layout Recipes

### Bento Grid

Mixed-size tiles using CSS grid with spanning:

```html
<div class="grid h-full grid-cols-3 grid-rows-2 gap-4">
  <div class="col-span-2 rounded-2xl bg-gradient-to-br from-primary/15 to-transparent p-8"
       data-step="1" data-animate="scale">
    <h3 class="text-xl font-semibold text-foreground">Primary Feature</h3>
    <p class="mt-2 text-muted-foreground">Description</p>
  </div>
  <div class="row-span-2 rounded-2xl border border-border bg-card p-6"
       data-step="1" data-animate="scale" data-delay="100">
    <h3 class="font-semibold text-foreground">Tall Feature</h3>
  </div>
  <div class="rounded-2xl bg-muted/30 p-6"
       data-step="1" data-animate="scale" data-delay="200">
    <h3 class="font-semibold text-foreground">Quick Feature</h3>
  </div>
  <div class="rounded-2xl bg-primary p-6"
       data-step="1" data-animate="scale" data-delay="300">
    <h3 class="font-semibold text-primary-foreground">Highlight</h3>
  </div>
</div>
```

### Vertical Timeline

Zigzag flow along a center line with alternating left/right:

```html
<div class="relative flex h-full items-center justify-center">
  <div class="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-border"></div>
  <div class="relative w-full max-w-4xl space-y-8">
    <!-- Left-aligned item -->
    <div class="relative flex items-center" data-step="1" data-animate="fade">
      <div class="absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background"></div>
      <div class="w-1/2 pr-12 text-right">
        <div class="text-xs font-mono text-primary/60 mb-1">01</div>
        <h3 class="text-lg font-semibold text-foreground">Step One</h3>
        <p class="text-sm text-muted-foreground">Description</p>
      </div>
      <div class="w-1/2"></div>
    </div>
    <!-- Right-aligned item -->
    <div class="relative flex items-center" data-step="2" data-animate="fade">
      <div class="absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background"></div>
      <div class="w-1/2"></div>
      <div class="w-1/2 pl-12">
        <div class="text-xs font-mono text-primary/60 mb-1">02</div>
        <h3 class="text-lg font-semibold text-foreground">Step Two</h3>
        <p class="text-sm text-muted-foreground">Description</p>
      </div>
    </div>
  </div>
</div>
```

### Comparison / Before-After

Contrasting panels with a central VS badge:

```html
<div class="relative flex h-full items-center">
  <div class="grid w-full grid-cols-2 gap-8">
    <div data-step="1" data-animate="slide-right"
         class="rounded-2xl border border-border bg-muted/30 p-8">
      <h3 class="mb-6 text-lg font-semibold text-muted-foreground">The Old Way</h3>
      <ul class="space-y-4">
        <li class="flex items-start gap-3">
          <span class="text-muted-foreground/60">✕</span>
          <span class="text-muted-foreground line-through">Negative point</span>
        </li>
      </ul>
    </div>
    <div data-step="2" data-animate="slide-left"
         class="rounded-2xl border border-primary/20 bg-primary/5 p-8 shadow-lg shadow-primary/10">
      <h3 class="mb-6 text-lg font-semibold text-primary">The New Way</h3>
      <ul class="space-y-4">
        <li class="flex items-start gap-3">
          <span class="text-primary">✓</span>
          <span class="text-foreground">Positive point</span>
        </li>
      </ul>
    </div>
  </div>
  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
    VS
  </div>
</div>
```

### Asymmetric Two-Column

Use `grid-cols-5` for 2/5 + 3/5 splits:

```html
<div class="grid h-full grid-cols-5 gap-12 items-center">
  <div class="col-span-3"><!-- Larger content area --></div>
  <div class="col-span-2"><!-- Smaller supporting content --></div>
</div>
```

---

## Data Visualization

### Big Number with Progress Bar

```html
<div class="grid grid-cols-3 gap-10" data-step="1" data-animate="slide-up" data-stagger="100">
  <div>
    <div class="text-6xl font-bold tracking-tight text-primary">$10M</div>
    <div class="mt-4 h-1 w-4/5 rounded-full bg-gradient-to-r from-primary to-primary/30"></div>
    <div class="mt-3 text-lg font-semibold text-foreground">Revenue</div>
    <div class="text-sm text-muted-foreground">Annual recurring</div>
  </div>
  <div>
    <div class="text-6xl font-bold tracking-tight text-primary">500K</div>
    <div class="mt-4 h-1 w-3/5 rounded-full bg-gradient-to-r from-primary to-primary/30"></div>
    <div class="mt-3 text-lg font-semibold text-foreground">Users</div>
    <div class="text-sm text-muted-foreground">Monthly active</div>
  </div>
  <div>
    <div class="text-6xl font-bold tracking-tight text-primary">99.9%</div>
    <div class="mt-4 h-1 w-full rounded-full bg-gradient-to-r from-primary to-primary/30"></div>
    <div class="mt-3 text-lg font-semibold text-foreground">Uptime</div>
    <div class="text-sm text-muted-foreground">Last 12 months</div>
  </div>
</div>
```

### CSS Bar Chart

```html
<div class="flex h-48 items-end gap-4">
  <div class="flex w-16 flex-col items-center gap-2">
    <div class="w-full rounded-t-lg bg-primary/80" style="height: 80%"></div>
    <span class="text-xs text-muted-foreground">Q1</span>
  </div>
  <div class="flex w-16 flex-col items-center gap-2">
    <div class="w-full rounded-t-lg bg-primary/60" style="height: 55%"></div>
    <span class="text-xs text-muted-foreground">Q2</span>
  </div>
  <div class="flex w-16 flex-col items-center gap-2">
    <div class="w-full rounded-t-lg bg-primary" style="height: 95%"></div>
    <span class="text-xs text-muted-foreground">Q3</span>
  </div>
</div>
```

### SVG Donut Ring

```html
<svg class="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
  <circle cx="60" cy="60" r="50" fill="none" stroke-width="10" class="stroke-border" />
  <circle cx="60" cy="60" r="50" fill="none" stroke-width="10"
    stroke-dasharray="314" stroke-dashoffset="78" stroke-linecap="round"
    class="stroke-primary" />
</svg>
<div class="text-3xl font-bold text-primary">75%</div>
```

---

## Typography-Driven Layouts

### Large Quote

```html
<section class="flex items-center justify-center">
  <div class="text-center px-16">
    <span class="block font-serif text-[120px] leading-none text-primary/20">&ldquo;</span>
    <p class="-mt-10 max-w-4xl text-3xl font-light leading-relaxed italic text-foreground"
       data-step="1" data-animate="fade">
      The quote text goes here.
    </p>
    <div class="mx-auto mt-8 mb-6 h-px w-16 bg-primary/40"></div>
    <div class="text-lg font-semibold text-foreground">Speaker Name</div>
    <div class="text-sm text-muted-foreground">Title, Company</div>
  </div>
</section>
```

### Headline-Only Slide

```html
<section class="flex items-center justify-center">
  <h1 class="max-w-5xl text-6xl font-bold leading-tight text-foreground text-center">
    We don't just build products.
    <br />
    We build <span class="text-primary">movements</span>.
  </h1>
</section>
```

---

## Typography Tips

- Hero titles: `text-6xl` to `text-8xl`, `font-bold`, `tracking-tight`
- Section titles: `text-3xl` to `text-5xl`
- Body: `text-lg` to `text-xl`, `text-muted-foreground`
- Eyebrows: `text-xs font-bold tracking-[0.2em] text-primary uppercase`
- Numbers/stats: `text-5xl font-bold text-primary`

---

## Animation Variety Guide

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

**Prefer `data-stagger`** on parent elements over manually adding delays to each child.

---

## Anti-Patterns

- **Same card style everywhere**: Alternate between glass, gradient, elevated, accent-border, or no cards
- **`slide-up` on everything**: Vary animation types per layout
- **All equal-width columns**: Use asymmetric splits and bento grids
- **Icon above text in every card**: Try inline icons, large numbers, or no icons
- **Two consecutive slides with same layout**: Mix patterns

---

## Visual QA Checklist

After creating or editing slides, use `get_screenshot` to verify:

- **Alignment** — Is content centered when it should be?
- **Color contrast** — Is text readable against its background?
- **Content overflow** — Does text fit within 1280×720?
- **Spacing** — Consistent padding and gaps?
- **Variety** — Use `get_deck_overview` to check consecutive slides differ

---

## Recommended Pitch Deck Order

1. **Title** — Hero gradient with large typography
2. **Problem** — Comparison layout (old way vs new way)
3. **Solution** — Split screen with bold statement
4. **How It Works** — Vertical timeline or process
5. **Features** — Bento grid with mixed tiles
6. **Market** — Big numbers with progress bars
7. **Traction** — Data visualization (charts, rings)
8. **Team** — Glass cards on gradient mesh
9. **Business Model** — Accent-border cards or split layout
10. **Ask / CTA** — Quote-style closing or headline-only
