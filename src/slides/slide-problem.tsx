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
        {/* Oversized accent number */}
        <span className="pointer-events-none absolute -top-4 -right-2 select-none text-[200px] font-black leading-none text-white/3">
          01
        </span>

        <div className="grid w-full grid-cols-2 gap-10">
          {/* Left — the old way */}
          <Animated step={1} animation="fade" duration={0.5}>
            <div className="rounded-none bg-white/5 p-8 shadow-2xl">
              <div className="mb-6 flex items-center gap-3">
                <X className="h-6 w-6 text-white/40" />
                <h3 className="text-lg font-semibold text-white/40">Traditional Tools</h3>
              </div>
              <ul className="space-y-4">
                {oldWay.map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-white/20" />
                    <span className="text-white/30 line-through decoration-white/10">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Animated>

          {/* Right — the new way */}
          <Animated step={2} animation="scale" duration={0.5}>
            <div className="rounded-none bg-primary/10 p-8 shadow-2xl">
              <div className="mb-6 flex items-center gap-3">
                <Check className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold text-primary">AI-Powered Slides</h3>
              </div>
              <ul className="space-y-4">
                {newWay.map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-white/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Animated>
        </div>

        {/* VS badge */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary px-4 py-2 text-xs font-black tracking-wider text-primary-foreground uppercase">
          VS
        </div>
      </div>
    </SlideLayoutDark>
  )
}
