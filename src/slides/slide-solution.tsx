import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"
import { MessageSquare, Eye, Presentation, ChevronRight } from "lucide-react"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

const steps = [
  {
    icon: MessageSquare,
    label: "Describe it",
    description: "Tell your coding agent what slides you need in plain language.",
  },
  {
    icon: Eye,
    label: "See it",
    description: "Watch components appear in real-time with hot reload.",
  },
  {
    icon: Presentation,
    label: "Present it",
    description: "Go fullscreen and present — no export step required.",
  },
]

export function SlideSolution({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="THE SOLUTION"
      title="Describe it. See it. Present it."
    >
      <div className="flex h-full flex-col justify-center gap-10">
        {/* Three-step flow */}
        <Animated step={1} animation="slide-up">
          <div className="flex items-stretch gap-3">
            {steps.map((step, i) => (
              <div key={step.label} className="flex flex-1 items-stretch gap-3">
                <div className="relative flex flex-col items-start rounded-2xl border border-border bg-card p-8">
                  {/* Large step number as background accent */}
                  <span className="pointer-events-none absolute top-4 right-5 text-7xl font-black text-primary/[0.07]">
                    {i + 1}
                  </span>

                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{step.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                {/* Connector arrow between cards */}
                {i < steps.length - 1 && (
                  <div className="flex shrink-0 items-center">
                    <ChevronRight className="h-5 w-5 text-primary/40" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Animated>

        {/* Terminal demo */}
        <Animated step={2} animation="slide-up">
          <div className="w-full rounded-xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-2 font-mono text-xs text-muted-foreground">terminal</span>
            </div>
            <div className="space-y-2 font-mono text-sm">
              <p className="text-muted-foreground">$ claude</p>
              <p className="text-foreground">
                &gt; Create a pitch deck about our AI product with slides for problem, solution,
                market, team, and fundraising
              </p>
              <p className="mt-2 text-primary">Creating 6 slides...</p>
            </div>
          </div>
        </Animated>
      </div>
    </SlideLayoutCentered>
  )
}
