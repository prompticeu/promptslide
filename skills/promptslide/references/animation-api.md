# Animation API Reference

## Animated Component

Reveals content at a specific animation step (click-to-reveal).

```tsx
import { Animated } from "@/framework/animated"
;<Animated step={1} animation="slide-up" duration={0.4} delay={0.05} className="flex">
  <p>Content</p>
</Animated>
```

### Props

| Prop        | Type            | Default      | Description                                          |
| ----------- | --------------- | ------------ | ---------------------------------------------------- |
| `step`      | `number`        | required     | Which click reveals this content (1-indexed)         |
| `animation` | `AnimationType` | `"slide-up"` | Animation style                                      |
| `duration`  | `number`        | `0.4`        | Duration in seconds                                  |
| `delay`     | `number`        | `0`          | Delay after trigger in seconds                       |
| `className` | `string`        | —            | Additional CSS classes (use for layout preservation) |

### AnimationType Values

| Type          | Effect                      |
| ------------- | --------------------------- |
| `fade`        | Fade in (opacity only)      |
| `slide-up`    | Slide up + fade in          |
| `slide-down`  | Slide down + fade in        |
| `slide-left`  | Slide from right + fade in  |
| `slide-right` | Slide from left + fade in   |
| `scale`       | Scale up from 0.8 + fade in |

---

## AnimatedGroup Component

Staggers multiple children with sequential delays, all triggered by a single step.

```tsx
import { AnimatedGroup } from "@/framework/animated"
;<AnimatedGroup
  startStep={1}
  animation="slide-up"
  staggerDelay={0.1}
  className="grid grid-cols-3 gap-6"
>
  <Card>First</Card>
  <Card>Second</Card>
  <Card>Third</Card>
</AnimatedGroup>
```

### Props

| Prop           | Type            | Default      | Description                               |
| -------------- | --------------- | ------------ | ----------------------------------------- |
| `startStep`    | `number`        | required     | Which click reveals the group (1-indexed) |
| `animation`    | `AnimationType` | `"slide-up"` | Animation style for all children          |
| `staggerDelay` | `number`        | `0.1`        | Delay between each child in seconds       |
| `className`    | `string`        | —            | Additional CSS classes                    |

---

## Step Count Rules

- Steps are **1-indexed** (step 1 = first click)
- Multiple `<Animated>` elements can share the same step (they appear together)
- The `steps` value in `deck-config.ts` **must equal** the highest step number used in that slide
- If a slide has no `<Animated>` components, use `steps: 0`

```ts
// Slide uses step={1}, step={2}, step={3}
{ component: MySlide, steps: 3 }

// Slide has no animations
{ component: MySlide, steps: 0 }
```

### Common Patterns

**Sequential cards** — each card gets its own step:

```tsx
<Animated step={1} animation="slide-up"><Card>A</Card></Animated>
<Animated step={2} animation="slide-up" delay={0.05}><Card>B</Card></Animated>
<Animated step={3} animation="slide-up" delay={0.1}><Card>C</Card></Animated>
// deck-config: steps: 3
```

**Grouped by row** — top row on step 1, bottom row on step 2:

```tsx
{
  items.map((item, index) => (
    <Animated
      key={item.title}
      step={index < 3 ? 1 : 2}
      animation="slide-up"
      delay={(index % 3) * 0.05}
    >
      <Card>{item.title}</Card>
    </Animated>
  ))
}
// deck-config: steps: 2
```

**All at once with stagger** — single step, visual stagger via delay:

```tsx
{
  items.map((item, index) => (
    <Animated key={item.name} step={1} animation="slide-up" delay={index * 0.05}>
      <Row>{item.name}</Row>
    </Animated>
  ))
}
// deck-config: steps: 1
```

---

## Morph Animations

Smoothly transition shared elements between consecutive slides using Framer Motion's `layoutId`.

**Note**: Morph is currently disabled in fullscreen presentation mode due to CSS transform conflicts with Framer Motion's layoutId calculations.

### Morph

```tsx
import { Morph } from "@/framework/morph"

// Slide 1 — large version
<Morph layoutId="hero-title">
  <h1 className="text-6xl">Title</h1>
</Morph>

// Slide 2 — small version (same layoutId = morphs between them)
<Morph layoutId="hero-title">
  <h1 className="text-2xl">Title</h1>
</Morph>
```

| Prop         | Type         | Default            | Description                           |
| ------------ | ------------ | ------------------ | ------------------------------------- |
| `layoutId`   | `string`     | required           | Shared ID between slides (must match) |
| `transition` | `Transition` | `MORPH_TRANSITION` | Custom Framer Motion transition       |
| `className`  | `string`     | —                  | Additional CSS classes                |

### MorphGroup + MorphItem

Group multiple morph elements together:

```tsx
import { MorphGroup, MorphItem } from "@/framework/morph"
;<MorphGroup groupId="card" className="flex gap-4">
  <MorphItem id="icon" prefix="card">
    <Icon />
  </MorphItem>
  <MorphItem id="title" prefix="card">
    <h2>Title</h2>
  </MorphItem>
</MorphGroup>
```

MorphItem generates layoutIds by combining `prefix` and `id` (e.g., `"card-icon"`, `"card-title"`).

### MorphText

Specialized for text that changes size between slides:

```tsx
import { MorphText } from "@/framework/morph"

// Slide 1
<MorphText layoutId="heading" as="h1" className="text-6xl">Title</MorphText>

// Slide 2
<MorphText layoutId="heading" as="h2" className="text-2xl">Title</MorphText>
```

The `as` prop accepts: `"h1"`, `"h2"`, `"h3"`, `"h4"`, `"p"`, `"span"` (default: `"span"`).

---

## Animation Config Constants

All timing values from `src/framework/animation-config.ts`:

### Durations (seconds)

| Constant                    | Value | Purpose                      |
| --------------------------- | ----- | ---------------------------- |
| `SLIDE_TRANSITION_DURATION` | `0.3` | Between slides               |
| `MORPH_DURATION`            | `0.8` | Layout morph animations      |
| `STEP_ANIMATION_DURATION`   | `0.4` | Within-slide step animations |
| `STAGGER_DELAY`             | `0.1` | Default group stagger        |

### Spring Configurations

| Preset          | Stiffness | Damping | Use Case                  |
| --------------- | --------- | ------- | ------------------------- |
| `SPRING_SNAPPY` | 300       | 30      | Step animations (default) |
| `SPRING_SMOOTH` | 200       | 25      | Gentle animations         |
| `SPRING_BOUNCY` | 400       | 20      | Playful animations        |

### Distances (pixels)

| Constant                 | Value | Purpose                         |
| ------------------------ | ----- | ------------------------------- |
| `SLIDE_DISTANCE`         | `100` | Slide transition distance       |
| `ELEMENT_SLIDE_DISTANCE` | `30`  | Within-slide element animations |

### Slide Dimensions

| Property     | Value  |
| ------------ | ------ |
| Width        | `1280` |
| Height       | `720`  |
| Aspect Ratio | `16:9` |
