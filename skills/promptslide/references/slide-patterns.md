# Slide Layout Patterns

These are starting points — not templates to copy verbatim. Adapt, combine, and break these patterns to match the deck's aesthetic direction. The goal is slides that feel intentionally designed, not assembled from a component library.

**Do not use the same pattern on consecutive slides.** More importantly, do not use the same *feeling* on consecutive slides — if slide 3 has cards, slide 4 should use typography, data, or negative space instead.

---

## Background Treatments

### Gradient Mesh Background

Layered blurred gradient orbs create a rich, ambient backdrop. Place behind content with `relative z-10` on the content layer.

```tsx
{/* Place inside SlideLayout's content area */}
<div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
<div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
<div className="absolute bottom-1/4 right-10 h-64 w-64 rounded-full bg-primary/5 blur-2xl" />

{/* Content above */}
<div className="relative z-10">Your content here</div>
```

### Split Background

Asymmetric split with solid primary on one side. Use `hideFooter` on `SlideLayout` for edge-to-edge effect.

```tsx
<div className="-mx-12 -mt-12 -mb-6 grid h-[calc(100%+4.5rem)] grid-cols-5">
  <div className="col-span-2 flex flex-col justify-center bg-primary p-12">
    <h2 className="text-5xl font-bold text-primary-foreground">Statement</h2>
  </div>
  <div className="col-span-3 flex flex-col justify-center p-12">
    {/* Right content */}
  </div>
</div>
```

### Spotlight / Vignette

A subtle radial glow that draws focus to the center.

```tsx
<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
<div className="relative z-10">Your content here</div>
```

---

## Card Styles

Avoid using the same card style across the entire deck. Alternate between these:

### Glass Card

Frosted glass effect — requires a gradient or visual background behind it. Best in dark mode.

```tsx
<div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-primary/5 backdrop-blur-md">
  <h3 className="text-lg font-semibold text-foreground">Title</h3>
  <p className="text-sm text-muted-foreground">Description</p>
</div>
```

### Gradient Card

Soft gradient fill with a subtle tinted border.

```tsx
<div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/15 to-transparent p-8">
  <h3 className="text-lg font-semibold text-foreground">Title</h3>
  <p className="text-sm text-muted-foreground">Description</p>
</div>
```

### Elevated Card

No border — uses shadow for depth. Glow tinted with brand color.

```tsx
<div className="rounded-2xl bg-card p-8 shadow-xl shadow-primary/10">
  <h3 className="text-lg font-semibold text-foreground">Title</h3>
  <p className="text-sm text-muted-foreground">Description</p>
</div>
```

### Accent-Border Card

Thick left accent line for visual emphasis.

```tsx
<div className="rounded-2xl border border-border border-l-4 border-l-primary bg-card p-8">
  <h3 className="text-lg font-semibold text-foreground">Title</h3>
  <p className="text-sm text-muted-foreground">Description</p>
</div>
```

---

## Layout Recipes

### Bento Grid

Mixed-size tiles create visual interest. Uses CSS grid with spanning.

```tsx
<div className="grid h-full grid-cols-3 grid-rows-2 gap-4">
  {/* Wide tile — top, spans 2 cols */}
  <div className="col-span-2 rounded-2xl bg-gradient-to-br from-primary/15 to-transparent p-8">
    <h3 className="text-xl font-semibold text-foreground">Primary Feature</h3>
    <p className="mt-2 text-muted-foreground">Description</p>
  </div>

  {/* Tall tile — right, spans 2 rows */}
  <div className="row-span-2 rounded-2xl border border-border bg-card p-6">
    <h3 className="font-semibold text-foreground">Tall Feature</h3>
  </div>

  {/* Small tile */}
  <div className="rounded-2xl bg-muted/30 p-6">
    <h3 className="font-semibold text-foreground">Quick Feature</h3>
  </div>

  {/* Accent tile — solid primary bg */}
  <div className="rounded-2xl bg-primary p-6">
    <h3 className="font-semibold text-primary-foreground">Highlight</h3>
  </div>
</div>
```

Steps: 1 (use `AnimatedGroup` with `slide-down`)

### Vertical Timeline

Zigzag flow along a center line. Items alternate left and right.

```tsx
const steps = [
  { title: "Step One", description: "..." },
  { title: "Step Two", description: "..." },
  { title: "Step Three", description: "..." },
]

<div className="relative flex h-full items-center justify-center">
  {/* Center line */}
  <div className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-border" />

  <div className="relative w-full max-w-4xl space-y-8">
    {steps.map((step, index) => {
      const isLeft = index % 2 === 0
      return (
        <Animated key={step.title} step={index + 1} animation="fade">
          <div className="relative flex items-center">
            <div className="absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background" />
            {isLeft ? (
              <>
                <div className="w-1/2 pr-12 text-right">
                  <div className="text-xs font-mono text-primary/60 mb-1">0{index + 1}</div>
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                <div className="w-1/2" />
              </>
            ) : (
              <>
                <div className="w-1/2" />
                <div className="w-1/2 pl-12">
                  <div className="text-xs font-mono text-primary/60 mb-1">0{index + 1}</div>
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </>
            )}
          </div>
        </Animated>
      )
    })}
  </div>
</div>
```

Steps: equals number of items (one per timeline node)

### Comparison / Before-After

Contrasting panels with a central VS badge.

```tsx
<div className="relative flex h-full items-center">
  <div className="grid w-full grid-cols-2 gap-8">
    <Animated step={1} animation="slide-right">
      <div className="rounded-2xl border border-border bg-muted/30 p-8">
        <h3 className="mb-6 text-lg font-semibold text-muted-foreground">The Old Way</h3>
        <ul className="space-y-4">
          <li className="flex items-start gap-3">
            <X className="mt-0.5 h-4 w-4 text-muted-foreground/60" />
            <span className="text-muted-foreground line-through">Negative point</span>
          </li>
        </ul>
      </div>
    </Animated>

    <Animated step={2} animation="slide-left">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 shadow-lg shadow-primary/10">
        <h3 className="mb-6 text-lg font-semibold text-primary">The New Way</h3>
        <ul className="space-y-4">
          <li className="flex items-start gap-3">
            <Check className="mt-0.5 h-4 w-4 text-primary" />
            <span className="text-foreground">Positive point</span>
          </li>
        </ul>
      </div>
    </Animated>
  </div>

  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
    VS
  </div>
</div>
```

Steps: 2

### Asymmetric Two-Column

Not everything needs to be 50/50. Use `grid-cols-5` for 2/5 + 3/5 splits.

```tsx
<div className="grid h-full grid-cols-5 gap-12 items-center">
  <div className="col-span-3">
    {/* Larger content area */}
  </div>
  <div className="col-span-2">
    {/* Smaller supporting content */}
  </div>
</div>
```

---

## Data Visualization

### Big Number with Progress Bar

Large metrics with gradient accent bars. No card wrapper needed.

```tsx
<div className="grid grid-cols-3 gap-10">
  <div>
    <div className="text-6xl font-bold tracking-tight text-primary">$10M</div>
    <div className="mt-4 h-1 w-4/5 rounded-full bg-gradient-to-r from-primary to-primary/30" />
    <div className="mt-3 text-lg font-semibold text-foreground">Revenue</div>
    <div className="text-sm text-muted-foreground">Annual recurring</div>
  </div>
</div>
```

### CSS Bar Chart

Vertical bars using flexbox. Vary heights for visual data representation.

```tsx
<div className="flex h-48 items-end gap-4">
  <div className="flex w-16 flex-col items-center gap-2">
    <div className="w-full rounded-t-lg bg-primary/80" style={{ height: "80%" }} />
    <span className="text-xs text-muted-foreground">Q1</span>
  </div>
  <div className="flex w-16 flex-col items-center gap-2">
    <div className="w-full rounded-t-lg bg-primary/60" style={{ height: "55%" }} />
    <span className="text-xs text-muted-foreground">Q2</span>
  </div>
  <div className="flex w-16 flex-col items-center gap-2">
    <div className="w-full rounded-t-lg bg-primary" style={{ height: "95%" }} />
    <span className="text-xs text-muted-foreground">Q3</span>
  </div>
</div>
```

### SVG Donut Ring

Simple percentage ring using two SVG circles.

```tsx
<svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
  {/* Track */}
  <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10"
    className="stroke-border" />
  {/* Fill — adjust strokeDashoffset for percentage (314 = full circle) */}
  <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10"
    strokeDasharray="314" strokeDashoffset="78" strokeLinecap="round"
    className="stroke-primary" />
</svg>
<div className="text-3xl font-bold text-primary">75%</div>
```

---

## Typography-Driven Layouts

### Large Quote

The quote itself is the visual element. No cards needed.

```tsx
<div className="flex h-full flex-col items-center justify-center text-center">
  <span className="block font-serif text-[120px] leading-none text-primary/20">&ldquo;</span>
  <p className="-mt-10 max-w-4xl text-3xl font-light leading-relaxed italic text-foreground">
    The quote text goes here.
  </p>
  <div className="mx-auto mt-8 mb-6 h-px w-16 bg-primary/40" />
  <div className="text-lg font-semibold text-foreground">Speaker Name</div>
  <div className="text-sm text-muted-foreground">Title, Company</div>
</div>
```

Steps: 1 (use `fade`)

### Headline-Only Slide

Large typography as the hero. Use `<span className="text-primary">` to highlight a key word.

```tsx
<div className="flex h-full flex-col items-center justify-center text-center">
  <h1 className="max-w-5xl text-6xl font-bold leading-tight text-foreground">
    We don't just build products.
    <br />
    We build <span className="text-primary">movements</span>.
  </h1>
</div>
```

Steps: 0

---

## Hero / Title Slide

Gradient mesh background with accent line. Use for opening slides.

```tsx
<SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
  <div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
  <div className="absolute bottom-1/4 right-10 h-64 w-64 rounded-full bg-primary/5 blur-2xl" />

  <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
    <h1 className="max-w-5xl text-7xl font-bold tracking-tight text-foreground">
      Title
    </h1>
    <p className="mt-6 max-w-2xl text-xl font-light text-muted-foreground">Tagline</p>
    <div className="mt-8 h-1 w-24 rounded-full bg-primary" />
  </div>
</SlideLayout>
```

Steps: 0 or 1 (use `scale` + `fade`)

---

## CTA / Closing Slide

Combine a strong statement with an action. Can use the quote pattern or a terminal mockup.

```tsx
<SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
  <div className="flex h-full flex-col items-center justify-center text-center">
    <h1 className="text-5xl font-bold tracking-tight text-foreground">
      Ready to Get Started?
    </h1>
    <div className="mt-8 h-1 w-16 rounded-full bg-primary" />
    <p className="mt-6 text-lg text-muted-foreground">
      github.com/your-org/your-repo
    </p>
  </div>
</SlideLayout>
```

Steps: 0

---

## Animation Variety Guide

Match animation types to layout styles for maximum impact:

| Layout | Recommended Animation | Why |
|--------|----------------------|-----|
| Hero / Title | `scale` or `fade` | Dramatic entrance without directional bias |
| Split Screen | `slide-right` (left panel) + `slide-left` (right) | Panels enter from their edges |
| Card Grid / Bento | `AnimatedGroup` with `scale` or `slide-down` | Uniform pop-in effect |
| Timeline items | `fade` | Clean appearance without movement |
| Comparison | `slide-right` + `slide-left` | Opposing directions emphasize contrast |
| Big Numbers | `slide-up` per metric | Vertical reveal suits vertical stacks |
| Quote | `fade` | Let the words speak |
| Data/Charts | `scale` | Drawing attention to the visual element |

---

## Anti-Patterns

These are the hallmarks of generic AI-generated slides. Avoid them:

- **Cards on every slide**: `rounded-xl border border-border bg-card p-8` as the default container for all content. Many slides should have NO card — use large typography, data visualizations, full-bleed color, or negative space as the visual element.
- **`slide-up` on everything**: Vary animation types based on intent. Better yet, leave some slides with zero animation — a static slide between animated ones creates rhythm.
- **All equal-width columns**: Not every grid needs `grid-cols-3` with identical tiles. Use asymmetric splits, bento grids, or abandon grids entirely.
- **Icon above text in every card**: This is the most common AI slide pattern. Try icons inline with text, large numbers as the visual, decorative typography, or no icons.
- **Safe, predictable color**: Don't just use the default primary blue. Override `--primary` in `globals.css` to match the deck's personality. Use bold accent colors.
- **Same energy on consecutive slides**: If slide 3 is dense with information, slide 4 should breathe. If slide 5 is dramatic and dark, slide 6 can be light and airy. Contrast creates rhythm.
- **Generic fonts**: If you haven't imported a custom font for the deck, you're probably producing generic output. Every deck deserves typography that matches its personality.

---

## Recommended Pitch Deck Order

1. **Title** — Hero gradient with large typography
2. **Problem** — Comparison layout (old way vs new way)
3. **Solution** — Split screen with bold statement + demo
4. **How It Works** — Vertical timeline or numbered process
5. **Features** — Bento grid with mixed tile sizes
6. **Market** — Big numbers with progress bars
7. **Traction** — Data visualization (charts, rings)
8. **Team** — Glass cards on gradient mesh
9. **Business Model** — Accent-border cards or split layout
10. **Ask / CTA** — Quote-style closing or headline-only
