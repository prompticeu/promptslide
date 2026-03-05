# PromptSlide

Slide deck framework: Vite + React 19 + Tailwind v4 + Framer Motion. Each slide is a React component styled with Tailwind CSS.

> **Recommended**: Install the [PromptSlide skill](https://github.com/prompticeu/promptslide) for guided slide authoring, style presets, design recipes, and best practices: `npx skills add prompticeu/promptslide`

---

## Architecture

```
src/
├── layouts/                      # Slide layouts — your "master themes"
│   └── slide-layout-centered.tsx # Default layout with header + footer
│
├── slides/                       # YOUR SLIDES GO HERE
│   └── slide-title.tsx           # Example starter slide
│
├── theme.ts                      # Theme config (brand name, logo, colors, fonts)
├── deck-config.ts                # Slide order + step counts
├── App.tsx                       # Root component (theme provider)
└── globals.css                   # Theme colors (CSS custom properties)

promptslide (npm package)          # CLI + slide engine
├── Animated, AnimatedGroup       # Step animations (click-to-reveal)
├── Morph, MorphGroup, MorphItem  # Shared element transitions
├── SlideDeck                     # Presentation viewer/controller
├── SlideThemeProvider, useTheme  # Theme context
├── SlideFooter                   # Footer with logo + slide number
├── SlideProps, SlideConfig       # TypeScript types
└── Layouts                       # ContentLayout, TitleLayout, SectionLayout,
                                  # TwoColumnLayout, ImageLayout, QuoteLayout
```

---

## Quick Start

1. Create a file in `src/slides/` (e.g., `src/slides/slide-market.tsx`)
2. Export a React component that receives `SlideProps`
3. Register it in `src/deck-config.ts`

```tsx
// src/slides/slide-market.tsx
import type { SlideProps } from "promptslide";
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered";

export function SlideMarket({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="MARKET OPPORTUNITY"
      title="$50B Total Addressable Market"
    >
      <div className="flex h-full flex-col justify-center">
        <p className="text-muted-foreground text-lg">Your content here</p>
      </div>
    </SlideLayoutCentered>
  );
}
```

```ts
// src/deck-config.ts
import type { SlideConfig } from "promptslide";
import { SlideTitle } from "@/slides/slide-title";
import { SlideMarket } from "@/slides/slide-market";

export const slides: SlideConfig[] = [
  { component: SlideTitle, steps: 0 },
  { component: SlideMarket, steps: 0 },
];
```

---

## Key Constraints

- **Slide dimensions**: 1280×720 (16:9). Content scales automatically in presentation mode.
- **Semantic colors**: Use `text-foreground`, `text-muted-foreground`, `text-primary`, `bg-background`, `bg-card`, `border-border`.
- **Icons**: Import from `lucide-react` (e.g., `import { ArrowRight } from "lucide-react"`).
- **Animations**: Use `<Animated step={n}>` for click-to-reveal. The `steps` value in `deck-config.ts` must equal the highest step number used. Available: `fade`, `slide-up`, `slide-down`, `slide-left`, `slide-right`, `scale`.
- **PDF compatibility**: No `blur()` or `backdrop-filter` (dropped by Chromium). No gradients (use solid colors with opacity). Keep colored shadows at `/5` max.
- **Brand color**: Edit `--primary` in `src/globals.css`. Configure logo and fonts in `src/theme.ts`.
