import type { SlideProps } from "@promptslide/core"

import { Animated } from "@promptslide/core"
import { Check, X } from "lucide-react"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

const oldWay = [
  "Drag-and-drop busywork for hours",
  "Rigid templates that fight your content",
  "20+ hours per deck, every single time",
  "Non-designers get inconsistent results"
]

const newWay = [
  "Describe your deck in plain language",
  "Fully customizable React components",
  "Generated in minutes with live preview",
  "Consistent, polished design every time"
]

export function SlideProblem({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="THE PROBLEM"
      title="Slide Tools Weren't Built for the AI Era"
    >
      <div className="relative flex h-full items-center">
        <div className="grid w-full grid-cols-2 gap-8">
          {/* Left — the old way */}
          <Animated step={1} animation="slide-right">
            <div className="rounded-2xl border border-border bg-muted/30 p-8">
              <div className="mb-6 flex items-center gap-3">
                <X className="h-6 w-6 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-muted-foreground">Traditional Tools</h3>
              </div>
              <ul className="space-y-4">
                {oldWay.map(item => (
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
                <h3 className="text-lg font-semibold text-primary">AI-Powered Slides</h3>
              </div>
              <ul className="space-y-4">
                {newWay.map(item => (
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold text-muted-foreground">
          VS
        </div>
      </div>
    </SlideLayoutCentered>
  )
}
