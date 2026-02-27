import type { SlideProps } from "@/framework/types"

import { Animated } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"

const steps = [
  { title: "Step One", description: "First thing that happens in the process" },
  { title: "Step Two", description: "Then this follows naturally from step one" },
  { title: "Step Three", description: "Building on the previous, this deepens impact" },
  { title: "Step Four", description: "The final stage delivers the outcome" }
]

export function SlideTimelineVertical({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="PROCESS"
      title="How It Works"
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
                  {/* Dot on the center line */}
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
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideTimelineVertical, steps: 4 }
