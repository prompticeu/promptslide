import { MessageSquare, Monitor, Zap } from "lucide-react"

import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

export function SlideSolution({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="THE SOLUTION"
      title="Describe It. See It. Present It."
    >
      <div className="flex h-full items-center">
        <div className="grid w-full grid-cols-2 gap-12">
          <div className="flex flex-col justify-center space-y-8">
            <Animated step={1} animation="slide-up">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 rounded-lg p-3">
                  <MessageSquare className="text-primary h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-foreground mb-1 text-lg font-semibold">
                    Natural Language
                  </h3>
                  <p className="text-muted-foreground">
                    Tell your coding agent what slides you need.
                    &quot;Create a 10-slide pitch deck for my fintech startup.&quot;
                  </p>
                </div>
              </div>
            </Animated>

            <Animated step={2} animation="slide-up">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 rounded-lg p-3">
                  <Zap className="text-primary h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-foreground mb-1 text-lg font-semibold">
                    Instant Hot Reload
                  </h3>
                  <p className="text-muted-foreground">
                    Vite HMR updates your slides in real-time as the agent
                    generates code. No refresh needed.
                  </p>
                </div>
              </div>
            </Animated>

            <Animated step={3} animation="slide-up">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 rounded-lg p-3">
                  <Monitor className="text-primary h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-foreground mb-1 text-lg font-semibold">
                    Present Anywhere
                  </h3>
                  <p className="text-muted-foreground">
                    Fullscreen presentation mode, grid overview,
                    and PDF export — all built in.
                  </p>
                </div>
              </div>
            </Animated>
          </div>

          <Animated step={1} animation="fade">
            <div className="flex items-center justify-center">
              <div className="w-full rounded-xl border border-border bg-card p-6">
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                  <span className="text-muted-foreground ml-2 text-xs font-mono">terminal</span>
                </div>
                <div className="space-y-2 font-mono text-sm">
                  <p className="text-muted-foreground">$ bun create slides my-deck</p>
                  <p className="text-primary">? Brand color: #6366f1</p>
                  <p className="text-primary">? Install skill? Yes</p>
                  <p className="text-green-400">Created my-deck/</p>
                  <p className="text-muted-foreground mt-4">$ cd my-deck && bun dev</p>
                  <p className="text-green-400">VITE v6 ready in 400ms</p>
                </div>
              </div>
            </div>
          </Animated>
        </div>
      </div>
    </SlideLayoutCentered>
  )
}
