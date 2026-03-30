# Animation Reference

## Click-to-Reveal (data-step)

Elements with `data-step="N"` are hidden until the Nth click:

```html
<!-- Always visible -->
<h1>Title</h1>

<!-- Appears on 1st click -->
<p data-step="1" data-animate="fade">First point</p>

<!-- Appears on 2nd click -->
<p data-step="2" data-animate="slide-up">Second point</p>
```

Steps are 1-indexed. Multiple elements can share the same step (appear together).
Steps are auto-detected from HTML — no manual step counts needed in deck.json.

## Animation Types

| Type | Effect |
|------|--------|
| `fade` | Fade in (opacity) |
| `slide-up` | Slide up + fade (default) |
| `slide-down` | Slide down + fade |
| `slide-left` | Slide from right + fade |
| `slide-right` | Slide from left + fade |
| `scale` | Scale up from 0.8 + fade |

## Timing

- `data-delay="200"` — delay in ms before animation starts
- `data-duration="400"` — animation duration in ms

## Stagger (Group Animation)

Add `data-stagger="100"` to a parent to stagger children:

```html
<div data-step="1" data-animate="slide-up" data-stagger="100">
  <div class="card">First</div>
  <div class="card">Second</div>
  <div class="card">Third</div>
</div>
```

Children appear one by one with 100ms between each.

## Entrance Animation (No Step)

Elements with `data-animate` but no `data-step` animate on slide entry:

```html
<h1 data-animate="scale">Always animates in</h1>
```

## Cross-Slide Morph (data-morph)

Smoothly transition elements between consecutive slides:

```html
<!-- Slide 1 -->
<h1 data-morph="title" class="text-7xl">Title</h1>

<!-- Slide 2 (same data-morph ID) -->
<h1 data-morph="title" class="text-3xl">Title</h1>
```

The element morphs smoothly between sizes/positions.

---

## Patterns

**Sequential cards** — each on its own step:
```html
<div data-step="1" data-animate="slide-up">Card A</div>
<div data-step="2" data-animate="slide-up">Card B</div>
<div data-step="3" data-animate="slide-up">Card C</div>
```

**Staggered grid** — all at once with visual stagger:
```html
<div class="grid grid-cols-3 gap-6"
     data-step="1" data-animate="slide-up" data-stagger="100">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

**Two-phase reveal** — header then details:
```html
<h2 data-step="1" data-animate="fade">The Answer</h2>
<div data-step="2" data-animate="slide-up" data-stagger="80">
  <p>Detail 1</p>
  <p>Detail 2</p>
</div>
```

## Slide Transitions

Set on the deck level in deck.json via `update_deck` or per-slide via `data-transition`:
- `fade` (default), `slide-left`, `slide-right`, `slide-up`, `slide-down`
- `zoom`, `zoom-fade`, `morph`, `none`

## Animation Config Constants

### Durations

| Constant | Value | Purpose |
|----------|-------|---------|
| Slide transition | 0.3s | Between slides |
| Morph | 0.8s | Layout morph animations |
| Step animation | 0.4s | Within-slide steps (default) |
| Stagger delay | 0.1s | Default group stagger |

### Slide Dimensions

| Property | Value |
|----------|-------|
| Width | 1280px |
| Height | 720px |
| Aspect Ratio | 16:9 |
