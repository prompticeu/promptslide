# Slide Layout Patterns

Reusable patterns extracted from the PowerVibe demo slides. Copy and adapt these for your own decks.

---

## Two-Column Layout

Left content + right visual (from `slide-solution.tsx`):

```tsx
<div className="flex h-full items-center">
  <div className="grid w-full grid-cols-2 gap-12">
    <div className="flex flex-col justify-center space-y-8">
      {/* Left: text content */}
      <Animated step={1} animation="slide-up">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 rounded-lg p-3">
            <Icon className="text-primary h-6 w-6" />
          </div>
          <div>
            <h3 className="text-foreground mb-1 text-lg font-semibold">Feature</h3>
            <p className="text-muted-foreground">Description text</p>
          </div>
        </div>
      </Animated>
    </div>

    <Animated step={1} animation="fade">
      {/* Right: visual (image, mockup, chart) */}
      <div className="flex items-center justify-center">
        <div className="w-full rounded-xl border border-border bg-card p-6">
          Visual content here
        </div>
      </div>
    </Animated>
  </div>
</div>
```

---

## Three-Column Card Grid

The most common animated pattern (from `slide-problem.tsx`):

```tsx
<div className="flex h-full items-center">
  <div className="grid w-full grid-cols-3 gap-8">
    <Animated step={1} animation="slide-up">
      <div className="rounded-xl border border-border bg-card p-8">
        <Icon className="text-primary mb-4 h-10 w-10" />
        <h3 className="text-foreground mb-2 text-xl font-semibold">Title</h3>
        <p className="text-muted-foreground">Description</p>
      </div>
    </Animated>

    <Animated step={2} animation="slide-up" delay={0.05}>
      <div className="rounded-xl border border-border bg-card p-8">
        <Icon className="text-primary mb-4 h-10 w-10" />
        <h3 className="text-foreground mb-2 text-xl font-semibold">Title</h3>
        <p className="text-muted-foreground">Description</p>
      </div>
    </Animated>

    <Animated step={3} animation="slide-up" delay={0.1}>
      <div className="rounded-xl border border-border bg-card p-8">
        <Icon className="text-primary mb-4 h-10 w-10" />
        <h3 className="text-foreground mb-2 text-xl font-semibold">Title</h3>
        <p className="text-muted-foreground">Description</p>
      </div>
    </Animated>
  </div>
</div>
```

Steps: 3 (one per card)

---

## Stat Cards

```tsx
<div className="grid grid-cols-3 gap-6">
  <div className="rounded-xl border border-border bg-card p-6">
    <div className="text-3xl font-bold text-primary">$10M</div>
    <div className="text-sm text-muted-foreground">Revenue</div>
  </div>
  <div className="rounded-xl border border-border bg-card p-6">
    <div className="text-3xl font-bold text-primary">50K</div>
    <div className="text-sm text-muted-foreground">Users</div>
  </div>
  <div className="rounded-xl border border-border bg-card p-6">
    <div className="text-3xl font-bold text-primary">99%</div>
    <div className="text-sm text-muted-foreground">Uptime</div>
  </div>
</div>
```

---

## Icon + Text List

Vertical list with icon accents (from `slide-solution.tsx`):

```tsx
<div className="space-y-8">
  <Animated step={1} animation="slide-up">
    <div className="flex items-start gap-4">
      <div className="bg-primary/10 rounded-lg p-3">
        <CheckCircle className="text-primary h-6 w-6" />
      </div>
      <div>
        <h3 className="text-foreground mb-1 text-lg font-semibold">Feature Name</h3>
        <p className="text-muted-foreground">Feature description goes here</p>
      </div>
    </div>
  </Animated>
</div>
```

---

## Timeline / Numbered Steps

Horizontal process flow with arrows (from `slide-how-it-works.tsx`):

```tsx
const steps = [
  { number: "1", title: "Step One", description: "Do this first" },
  { number: "2", title: "Step Two", description: "Then do this" },
  { number: "3", title: "Step Three", description: "Finally this" },
]

<div className="flex h-full items-center">
  <div className="flex w-full items-center justify-between gap-4">
    {steps.map((step, index) => (
      <Animated key={step.number} step={index + 1} animation="slide-up" delay={index * 0.05}>
        <div className="flex items-center gap-4">
          <div className="rounded-xl border border-border bg-card p-6 w-[280px]">
            <div className="text-primary mb-3 text-3xl font-bold">{step.number}</div>
            <h3 className="text-foreground mb-2 text-lg font-semibold">{step.title}</h3>
            <p className="text-muted-foreground text-sm">{step.description}</p>
          </div>
          {index < steps.length - 1 && (
            <ArrowRight className="text-muted-foreground h-5 w-5 shrink-0" />
          )}
        </div>
      </Animated>
    ))}
  </div>
</div>
```

Steps: equals number of items (one per step card)

---

## Title / Hero Slide

Centered content with no footer (from `slide-title.tsx`):

```tsx
<SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
  <div className="flex h-full w-full flex-col items-center justify-center text-center">
    <Icon className="text-primary mb-6 h-16 w-16" />
    <h1 className="text-foreground max-w-5xl text-5xl font-bold tracking-tight md:text-7xl">
      Presentation Title
    </h1>
    <p className="text-muted-foreground mt-6 max-w-3xl text-xl font-light">
      Subtitle or tagline
    </p>
    <div className="text-muted-foreground mt-16 text-sm">
      Additional context
    </div>
  </div>
</SlideLayout>
```

Steps: 0

---

## CTA / Closing Slide

Call-to-action with terminal mockup (from `slide-get-started.tsx`):

```tsx
<SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
  <div className="flex h-full w-full flex-col items-center justify-center text-center">
    <h1 className="text-foreground mb-8 text-5xl font-bold tracking-tight">
      Call to Action
    </h1>
    <div className="mb-12 w-full max-w-lg rounded-xl border border-border bg-card p-6">
      {/* Content: terminal, code snippet, signup form, etc. */}
    </div>
    <p className="text-muted-foreground mt-6 text-sm">
      Supporting text
    </p>
  </div>
</SlideLayout>
```

Steps: 0

---

## Terminal Mockup

Fake terminal window with colored dots:

```tsx
<div className="rounded-xl border border-border bg-card p-6">
  <div className="mb-3 flex items-center gap-2">
    <div className="h-3 w-3 rounded-full bg-red-500/60" />
    <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
    <div className="h-3 w-3 rounded-full bg-green-500/60" />
    <span className="text-muted-foreground ml-2 text-xs font-mono">terminal</span>
  </div>
  <div className="space-y-2 font-mono text-sm">
    <p className="text-muted-foreground">$ npm run dev</p>
    <p className="text-green-400">VITE v6.4 ready in 400ms</p>
  </div>
</div>
```

---

## Tech Stack / Data List

Horizontal rows with fixed-width columns (from `slide-tech-stack.tsx`):

```tsx
const items = [
  { name: "React 19", role: "UI", description: "Component-based slides" },
  { name: "Tailwind 4", role: "Styling", description: "Utility-first CSS" },
]

<div className="w-full space-y-4">
  {items.map((item, index) => (
    <Animated key={item.name} step={1} animation="slide-up" delay={index * 0.05}>
      <div className="flex items-center gap-6 rounded-lg border border-border bg-card px-6 py-4">
        <div className="text-primary w-40 shrink-0 text-lg font-bold">{item.name}</div>
        <div className="text-foreground w-32 shrink-0 text-sm font-medium uppercase tracking-wider opacity-60">
          {item.role}
        </div>
        <div className="text-muted-foreground text-sm">{item.description}</div>
      </div>
    </Animated>
  ))}
</div>
```

Steps: 1 (all items appear together with stagger)

---

## Data-Driven Feature Grid

Map an array to a 3x2 grid, grouped by row (from `slide-features.tsx`):

```tsx
const features = [
  { icon: Sparkles, title: "Feature 1", description: "..." },
  { icon: Shield, title: "Feature 2", description: "..." },
  // ... 6 items total
]

<div className="flex h-full items-center">
  <div className="grid w-full grid-cols-3 gap-6">
    {features.map((feature, index) => (
      <Animated
        key={feature.title}
        step={index < 3 ? 1 : 2}
        animation="slide-up"
        delay={(index % 3) * 0.05}
      >
        <div className="rounded-xl border border-border bg-card p-6">
          <feature.icon className="text-primary mb-3 h-8 w-8" />
          <h3 className="text-foreground mb-1 font-semibold">{feature.title}</h3>
          <p className="text-muted-foreground text-sm">{feature.description}</p>
        </div>
      </Animated>
    ))}
  </div>
</div>
```

Steps: 2 (top row on click 1, bottom row on click 2)

---

## Layout Tip: Animated className

Always pass layout classes to `<Animated className>` to preserve flex/grid behavior:

```tsx
// BAD — animation wrapper breaks flex centering
<div className="flex justify-center">
  <Animated step={1}>
    <Content />
  </Animated>
</div>

// GOOD — pass layout classes to Animated
<Animated step={1} className="flex justify-center">
  <Content />
</Animated>
```

---

## Recommended Pitch Deck Order

1. **Title** — Company name, tagline, hero visual
2. **Problem** — What pain point you solve
3. **Solution** — Your product/approach
4. **How It Works** — Process or workflow steps
5. **Features** — Key capabilities
6. **Market** — TAM/SAM, market size
7. **Traction** — Metrics, users, revenue
8. **Team** — Key people
9. **Business Model** — Pricing, revenue streams
10. **Ask / CTA** — Fundraising ask or call-to-action
