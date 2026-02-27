import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

const steps = [
  {
    title: "Clone & Install",
    description: "git clone, npm install, npm run dev — up and running in seconds"
  },
  {
    title: "Open Your Agent",
    description: "Claude Code, Cursor, Windsurf — any AI coding agent works"
  },
  {
    title: "Describe Your Deck",
    description: '"Create a 10-slide pitch deck for my fintech startup"'
  },
  {
    title: "Present & Export",
    description: "Fullscreen presentation mode, grid view, or one-click PDF download"
  }
]

export function SlideHowItWorks({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="HOW IT WORKS"
      title="From Zero to Presentation in Minutes"
    >
      <div className="relative flex h-full items-center justify-center">
        {/* Center line */}
        <div className="absolute top-4 bottom-4 left-1/2 w-px -translate-x-1/2 bg-border" />

        <div className="relative w-full max-w-4xl space-y-8">
          {steps.map((step, index) => {
            const isLeft = index % 2 === 0
            return (
              <Animated key={step.title} step={index + 1} animation="fade">
                <div className="relative flex items-center">
                  {/* Dot on center line */}
                  <div className="absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary ring-4 ring-background" />

                  {isLeft ? (
                    <>
                      <div className="w-1/2 pr-12 text-right">
                        <div className="mb-1 font-mono text-xs text-primary/60">0{index + 1}</div>
                        <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                      <div className="w-1/2" />
                    </>
                  ) : (
                    <>
                      <div className="w-1/2" />
                      <div className="w-1/2 pl-12">
                        <div className="mb-1 font-mono text-xs text-primary/60">0{index + 1}</div>
                        <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </>
                  )}
                </div>
              </Animated>
            )
          })}
        </div>
      </div>
    </SlideLayoutCentered>
  )
}
