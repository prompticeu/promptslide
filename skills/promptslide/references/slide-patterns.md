# Slide & Layout Patterns

Reusable patterns for visually diverse slide decks. **Do not use the same pattern on consecutive slides** — mix and match to keep the deck visually engaging.

---

## Creating Custom Layouts

Create layout files in `src/layouts/` to build a "master theme." Each layout is a React component that reads brand identity from `useTheme()` and uses `SlideFooter` for consistent footers.

```tsx
import type { SlideProps } from "@promptslide/core"
import { useTheme, SlideFooter, cn } from "@promptslide/core"

interface MyLayoutProps extends SlideProps {
  children?: React.ReactNode
  title?: string
  hideFooter?: boolean
}

export function MyLayout({ children, slideNumber, totalSlides, title, hideFooter }: MyLayoutProps) {
  const theme = useTheme()
  // theme.name, theme.logo, theme.fonts, theme.assets, theme.colors

  return (
    <div className="bg-background text-foreground relative flex h-full w-full flex-col overflow-hidden px-12 pt-10 pb-6">
      {title && <h2 className="text-4xl font-bold tracking-tight">{title}</h2>}
      <div className="min-h-0 flex-1">{children}</div>
      {!hideFooter && <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />}
    </div>
  )
}
```

**Key building blocks:**
- `useTheme()` — returns `ThemeConfig` with `name`, `logo`, `colors`, `fonts`, `assets`
- `SlideFooter` — logo + company name + slide number. Pass `variant="light"` for dark backgrounds
- `cn()` — Tailwind class merge utility
- Use `theme.fonts.heading` via `style={{ fontFamily: theme.fonts.heading }}` on headings
- Use `theme.logo.fullLight` and `SlideFooter variant="light"` for dark-background layouts

The layouts ARE the master theme. Change a layout, every slide using it updates.

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
  <div className="col-span-3 flex flex-col justify-center p-12">{/* Right content */}</div>
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

## Inline Text Techniques

Use these within any layout to add visual emphasis without additional components.

### Colored Keywords

Highlight key terms with theme-aware colors:

```tsx
<p className="text-lg text-muted-foreground">
  Combine <span className="font-semibold text-primary">retrieval</span> with{" "}
  <span className="font-semibold text-primary">generation</span> for accurate results.
</p>
```

### Inline Badges / Tokens

Small colored labels for categories, tags, or status:

```tsx
<span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
  Retrieval
</span>
<span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
  Optional
</span>
```

### Blockquote with Attribution

Use for pull-quotes, definitions, or key takeaways:

```tsx
<blockquote className="border-l-4 border-primary/40 pl-6">
  <p className="text-lg italic text-foreground/90">
    "The system decides at each step whether to retrieve, reason, or respond."
  </p>
  <footer className="mt-2 text-sm text-muted-foreground">— Paper Title, 2024</footer>
</blockquote>
```

### Comparison Row with Strikethrough

Show before/after inline:

```tsx
<div className="flex items-center gap-4">
  <span className="text-muted-foreground line-through">Manual pipeline</span>
  <span className="text-primary">→</span>
  <span className="font-semibold text-foreground">Autonomous agent</span>
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

### Mixed Card Sizes

2 large cards on top + 3 small cards below. Uses different grid tracks per row.

```tsx
<div className="flex h-full flex-col gap-4">
  {/* Top row — 2 large cards */}
  <div className="grid flex-1 grid-cols-2 gap-4">
    <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/15 to-transparent p-8">
      <h3 className="text-xl font-semibold text-foreground">Primary Feature</h3>
      <p className="mt-3 text-sm text-muted-foreground">Description with more room for detail.</p>
    </div>
    <div className="rounded-2xl border border-border bg-card p-8">
      <h3 className="text-xl font-semibold text-foreground">Secondary Feature</h3>
      <p className="mt-3 text-sm text-muted-foreground">Another substantial feature area.</p>
    </div>
  </div>

  {/* Bottom row — 3 small cards */}
  <div className="grid grid-cols-3 gap-4">
    <div className="rounded-xl bg-muted/30 p-5">
      <h4 className="font-semibold text-foreground">Quick A</h4>
      <p className="mt-1 text-xs text-muted-foreground">Brief note</p>
    </div>
    <div className="rounded-xl bg-muted/30 p-5">
      <h4 className="font-semibold text-foreground">Quick B</h4>
      <p className="mt-1 text-xs text-muted-foreground">Brief note</p>
    </div>
    <div className="rounded-xl bg-primary p-5">
      <h4 className="font-semibold text-primary-foreground">Highlight</h4>
      <p className="mt-1 text-xs text-primary-foreground/80">Accent card</p>
    </div>
  </div>
</div>
```

Steps: 1 (use `AnimatedGroup` with `scale`)

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

### Horizontal Timeline

Year markers or phase labels along a horizontal line. Best for 3–5 items.

```tsx
const phases = [
  { year: "2020", label: "Rule-Based" },
  { year: "2022", label: "RAG Pipelines" },
  { year: "2024", label: "Agentic RAG" },
]

<div className="flex h-full flex-col items-center justify-center">
  <div className="relative flex w-full max-w-4xl items-center justify-between">
    {/* Connecting line */}
    <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

    {phases.map((phase, i) => (
      <Animated key={phase.year} step={i + 1} animation="scale">
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="h-4 w-4 rounded-full bg-primary ring-4 ring-background" />
          <div className="text-lg font-bold text-primary">{phase.year}</div>
          <div className="text-sm text-muted-foreground">{phase.label}</div>
        </div>
      </Animated>
    ))}
  </div>
</div>
```

Steps: equals number of phases

### Flow Diagram / Pipeline

Connected nodes showing a process or architecture. Use flex with arrow separators.

```tsx
const nodes = [
  { label: "Query", icon: Search },
  { label: "Retrieve", icon: Database },
  { label: "Reason", icon: Brain },
  { label: "Respond", icon: MessageSquare },
]

<div className="flex items-center justify-center gap-2">
  {nodes.map((node, i) => (
    <Animated key={node.label} step={i + 1} animation="fade">
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-6 py-4">
          <node.icon className="h-6 w-6 text-primary" />
          <span className="text-sm font-semibold text-foreground">{node.label}</span>
        </div>
        {i < nodes.length - 1 && (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
    </Animated>
  ))}
</div>
```

Steps: equals number of nodes

For corrective/feedback loops, add a dashed curved line back to an earlier node:

```tsx
{/* Dashed feedback loop — place below the node row */}
<div className="mx-auto mt-4 w-2/3 border-b-2 border-dashed border-primary/30 rounded-b-full h-6" />
<div className="text-center text-xs text-primary/60 mt-1">Re-retrieve if insufficient</div>
```

### Definition List

Stacked term/definition pairs, ideal for research concepts or glossaries:

```tsx
const terms = [
  { term: "Agentic RAG", citation: "Smith et al., 2024", definition: "An LLM agent that autonomously decides when and what to retrieve." },
  { term: "Self-Reflection", citation: "Shinn et al., 2023", definition: "The agent evaluates its own outputs and iterates if quality is low." },
]

<div className="space-y-6">
  {terms.map((item, i) => (
    <Animated key={item.term} step={i + 1} animation="slide-up">
      <div className="border-l-2 border-primary/30 pl-6">
        <div className="flex items-baseline gap-3">
          <h3 className="text-lg font-bold text-foreground">{item.term}</h3>
          <span className="text-xs text-muted-foreground">{item.citation}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{item.definition}</p>
      </div>
    </Animated>
  ))}
</div>
```

Steps: equals number of terms

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
  <div className="col-span-3">{/* Larger content area */}</div>
  <div className="col-span-2">{/* Smaller supporting content */}</div>
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

### Data Table

Structured comparison with header row and colored status badges. Keep to 5 columns and 6 rows max for readability.

```tsx
const rows = [
  { method: "Naive RAG", complexity: "Low", accuracy: "72%", adaptive: false },
  { method: "Agentic RAG", complexity: "Medium", accuracy: "91%", adaptive: true },
]

<div className="overflow-hidden rounded-xl border border-border">
  <table className="w-full text-left text-sm">
    <thead>
      <tr className="border-b border-border bg-muted/30">
        <th className="px-6 py-3 font-semibold text-foreground">Method</th>
        <th className="px-6 py-3 font-semibold text-foreground">Complexity</th>
        <th className="px-6 py-3 font-semibold text-foreground">Accuracy</th>
        <th className="px-6 py-3 font-semibold text-foreground">Adaptive</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={row.method} className="border-b border-border/50 last:border-0">
          <td className="px-6 py-3 font-medium text-foreground">{row.method}</td>
          <td className="px-6 py-3">
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              row.complexity === "Low" && "bg-green-500/15 text-green-400",
              row.complexity === "Medium" && "bg-yellow-500/15 text-yellow-400",
              row.complexity === "High" && "bg-red-500/15 text-red-400"
            )}>{row.complexity}</span>
          </td>
          <td className="px-6 py-3 text-muted-foreground">{row.accuracy}</td>
          <td className="px-6 py-3">
            {row.adaptive
              ? <Check className="h-4 w-4 text-primary" />
              : <X className="h-4 w-4 text-muted-foreground/40" />}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

Steps: 1 (use `fade` or `scale` on the whole table)

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
    <h1 className="max-w-5xl text-7xl font-bold tracking-tight text-foreground">Title</h1>
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
    <h1 className="text-5xl font-bold tracking-tight text-foreground">Ready to Get Started?</h1>
    <div className="mt-8 h-1 w-16 rounded-full bg-primary" />
    <p className="mt-6 text-lg text-muted-foreground">github.com/your-org/your-repo</p>
  </div>
</SlideLayout>
```

Steps: 0

---

## Reference / Bibliography Slide

Two-column numbered source list for research or data-heavy decks.

```tsx
const sources = [
  "[1] Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks.",
  "[2] Shinn et al. (2023). Reflexion: Language Agents with Verbal Reinforcement Learning.",
  "[3] Yao et al. (2023). ReAct: Synergizing Reasoning and Acting in Language Models.",
  "[4] Gao et al. (2024). Retrieval-Augmented Generation for Large Language Models: A Survey.",
]

<div className="flex h-full flex-col justify-center">
  <h2 className="mb-8 text-2xl font-bold text-foreground">References</h2>
  <div className="columns-2 gap-12 text-sm leading-relaxed text-muted-foreground">
    {sources.map((s, i) => (
      <p key={i} className="mb-3 break-inside-avoid">{s}</p>
    ))}
  </div>
</div>
```

Steps: 0 or 1 (use `fade` on the whole list)

---

## Animation Variety Guide

Match animation types to layout styles for maximum impact:

| Layout            | Recommended Animation                             | Why                                        |
| ----------------- | ------------------------------------------------- | ------------------------------------------ |
| Hero / Title      | `scale` or `fade`                                 | Dramatic entrance without directional bias |
| Split Screen      | `slide-right` (left panel) + `slide-left` (right) | Panels enter from their edges              |
| Card Grid / Bento | `AnimatedGroup` with `scale` or `slide-down`      | Uniform pop-in effect                      |
| Timeline items    | `fade`                                            | Clean appearance without movement          |
| Comparison        | `slide-right` + `slide-left`                      | Opposing directions emphasize contrast     |
| Big Numbers       | `slide-up` per metric                             | Vertical reveal suits vertical stacks      |
| Quote             | `fade`                                            | Let the words speak                        |
| Data/Charts       | `scale`                                           | Drawing attention to the visual element    |
| Data Table        | `fade` or `scale`                                 | Table appears as a unit                    |
| Horizontal Timeline | `scale` per marker                              | Nodes pop in along the line                |
| Flow Diagram      | `fade` per node                                   | Sequential reveal matches process flow     |
| Definition List   | `slide-up` per term                               | Vertical stack suits vertical reveal       |
| Blockquote        | `fade`                                            | Let the words speak                        |

---

## Anti-Patterns

Avoid these common mistakes that make every slide look the same:

- **Same card style everywhere**: Do not use `rounded-xl border border-border bg-card p-8` on every slide. Alternate between glass, gradient, elevated, accent-border, or no card at all.
- **`slide-up` on everything**: Vary animation types. Use `scale` for grids, `fade` for quotes, `slide-left`/`slide-right` for split layouts.
- **All equal-width columns**: Not every grid needs `grid-cols-3` with identical tiles. Use asymmetric splits (`grid-cols-5` with `col-span-2` + `col-span-3`) and bento grids.
- **Icon above text in every card**: Try icons inline with text, large numbers as the visual element, or no icons at all.
- **Two consecutive slides with the same layout**: If slide 3 is a card grid, slide 4 should be something different (split, timeline, quote, data viz).

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

---

## Recommended Research Deck Order

1. **Title** — Hero layout with topic + subtitle
2. **Problem / Motivation** — Big quote or headline-only with research question
3. **Background** — Definition list with key concepts and citations
4. **Evolution / Timeline** — Horizontal timeline showing progression
5. **Architecture / Pipeline** — Flow diagram of the system
6. **How It Works** — Split layout or numbered steps
7. **Comparison** — Data table or before/after comparing approaches
8. **Results** — Big numbers or bar chart with key metrics
9. **Key Takeaways** — Bento grid or mixed card sizes
10. **Limitations & Future Work** — Accent-border cards
11. **References** — Two-column bibliography
