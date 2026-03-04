import type { SlideProps } from "promptslide"

import { Animated, AnimatedGroup } from "promptslide"
import { MessageSquare, Eye, Presentation } from "lucide-react"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

const steps = [
  {
    icon: MessageSquare,
    label: "Describe it",
    description: "Tell your coding agent what slides you need in plain language.",
    number: "01",
  },
  {
    icon: Eye,
    label: "See it",
    description: "Watch components appear in real-time with hot reload.",
    number: "02",
  },
  {
    icon: Presentation,
    label: "Present it",
    description: "Go fullscreen and present — no export step required.",
    number: "03",
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
        <AnimatedGroup startStep={1} animation="scale" staggerDelay={0.1} className="flex items-stretch gap-6">
          {steps.map((step) => (
            <div key={step.label} className="relative flex flex-1 flex-col items-start bg-white/5 p-8 shadow-2xl">
              {/* Oversized step number */}
              <span className="pointer-events-none absolute top-3 right-4 text-8xl font-black text-primary/10">
                {step.number}
              </span>

              <div className="mb-5 flex h-12 w-12 items-center justify-center bg-primary/15">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "Space Grotesk" }}>{step.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </AnimatedGroup>

        {/* Terminal demo */}
        <Animated step={2} animation="fade" duration={0.5}>
          <div className="w-full bg-white/5 p-6 shadow-2xl">
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
