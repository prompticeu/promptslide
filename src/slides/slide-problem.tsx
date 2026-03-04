import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"
import { X, Check } from "lucide-react"

import { SlideLayoutDark } from "@/layouts/slide-layout-dark"

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
    <SlideLayoutDark
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="THE PROBLEM"
      title="Slide Tools Weren't Built for the AI Era"
    >
      <div className="relative flex h-full items-center">
        <div className="grid w-full grid-cols-2 gap-8">
          {/* Left — the old way */}
          <Animated step={1} animation="slide-up">
            <div className="rounded-2xl border border-background/10 bg-background/5 p-8">
              <div className="mb-6 flex items-center gap-3">
                <X className="h-6 w-6 text-background/50" />
                <h3 className="text-lg font-semibold text-background/50">Traditional Tools</h3>
              </div>
              <ul className="space-y-4">
                {oldWay.map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-background/30" />
                    <span className="text-background/40 line-through decoration-background/20">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Animated>

          {/* Right — the new way */}
          <Animated step={2} animation="scale">
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-8">
              <div className="mb-6 flex items-center gap-3">
                <Check className="h-6 w-6" style={{ color: "oklch(0.7 0.2 250)" }} />
                <h3 className="text-lg font-semibold" style={{ color: "oklch(0.7 0.2 250)" }}>AI-Powered Slides</h3>
              </div>
              <ul className="space-y-4">
                {newWay.map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "oklch(0.7 0.2 250)" }} />
                    <span className="text-background">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Animated>
        </div>

        {/* VS badge */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background/20 bg-foreground px-3 py-1.5 text-xs font-bold text-background/60">
          VS
        </div>
      </div>
    </SlideLayoutDark>
  )
}
