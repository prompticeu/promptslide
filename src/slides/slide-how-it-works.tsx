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
        <Animated step={1} animation="fade" duration={0.5}>
          <div>
            <div className="mb-3 text-xs font-semibold tracking-[0.25em] text-primary uppercase">
              HOW IT WORKS
            </div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-foreground" style={{ fontFamily: "Space Grotesk" }}>
              From Zero to Presentation in Minutes
            </h2>
            <div className="mt-6 h-1 w-20 bg-primary" />
          </div>
        </Animated>
      }
    >
      <div className="space-y-5">
        {steps.map((step, index) => (
          <Animated key={step.title} step={index + 1} animation="slide-left" duration={0.5}>
            <div className="flex items-start gap-6 bg-white/5 p-5 shadow-2xl">
              <span className="text-4xl font-black text-primary/20">{step.number}</span>
              <div>
                <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "Space Grotesk" }}>{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          </Animated>
        ))}
      </div>
    </SlideLayoutSplit>
  )
}
