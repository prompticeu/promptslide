import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"

import { SlideLayoutSplit } from "@/layouts/slide-layout-split"

const steps = [
  {
    number: "01",
    title: "Install & Scaffold",
    description: "Install the Agent Skill or run bun create slides my-deck — ready in seconds"
  },
  {
    number: "02",
    title: "Open Your Agent",
    description: "Claude Code, Cursor, Windsurf — any AI coding agent works"
  },
  {
    number: "03",
    title: "Describe Your Deck",
    description: '"Create a 10-slide pitch deck for my fintech startup"'
  },
  {
    number: "04",
    title: "Present & Export",
    description: "Fullscreen presentation mode, grid view, or one-click PDF download"
  }
]

export function SlideHowItWorks({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutSplit
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      left={
        <Animated step={1} animation="fade">
          <div>
            <div className="mb-3 text-xs font-bold tracking-[0.2em] text-primary uppercase">
              HOW IT WORKS
            </div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-foreground">
              From Zero to Presentation in Minutes
            </h2>
            <div className="mt-6 h-1 w-16 rounded-full bg-primary" />
          </div>
        </Animated>
      }
    >
      <div className="space-y-6">
        {steps.map((step, index) => (
          <Animated key={step.title} step={index + 1} animation="slide-left">
            <div className="flex items-start gap-6">
              <span className="text-3xl font-black text-primary/20">{step.number}</span>
              <div className="border-b border-border pb-5">
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          </Animated>
        ))}
      </div>
    </SlideLayoutSplit>
  )
}
