import { Check, X } from "lucide-react"

import { Animated } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

const negatives = [
  "Manual drag-and-drop formatting",
  "Rigid, hard-to-customize templates",
  "Hours of tedious alignment work",
]

const positives = [
  "Describe what you need in plain language",
  "Fully customizable React components",
  "Generated in minutes, not hours",
]

export function SlideComparison({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="COMPARISON"
      title="A Better Way"
    >
      <div className="relative flex h-full items-center">
        <div className="grid w-full grid-cols-2 gap-8">
          {/* Left — the old way */}
          <Animated step={1} animation="slide-right">
            <div className="rounded-2xl border border-border bg-muted/30 p-8">
              <div className="mb-6 flex items-center gap-3">
                <X className="h-6 w-6 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-muted-foreground">The Old Way</h3>
              </div>
              <ul className="space-y-4">
                {negatives.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                    <span className="text-muted-foreground line-through decoration-muted-foreground/40">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Animated>

          {/* Right — the new way */}
          <Animated step={2} animation="slide-left">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 shadow-lg shadow-primary/10">
              <div className="mb-6 flex items-center gap-3">
                <Check className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold text-primary">The New Way</h3>
              </div>
              <ul className="space-y-4">
                {positives.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Animated>
        </div>

        {/* VS badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
          VS
        </div>
      </div>
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideComparison, steps: 2 }
