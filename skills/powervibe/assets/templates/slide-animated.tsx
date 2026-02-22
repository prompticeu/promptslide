import { Animated } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

export function SlideAnimated({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="SECTION"
      title="Slide Title"
    >
      <div className="flex h-full items-center">
        <div className="grid w-full grid-cols-3 gap-8">
          <Animated step={1} animation="slide-up">
            <div className="rounded-xl border border-border bg-card p-8">
              <h3 className="text-foreground mb-2 text-xl font-semibold">
                Point One
              </h3>
              <p className="text-muted-foreground">Description here</p>
            </div>
          </Animated>

          <Animated step={2} animation="slide-up" delay={0.05}>
            <div className="rounded-xl border border-border bg-card p-8">
              <h3 className="text-foreground mb-2 text-xl font-semibold">
                Point Two
              </h3>
              <p className="text-muted-foreground">Description here</p>
            </div>
          </Animated>

          <Animated step={3} animation="slide-up" delay={0.1}>
            <div className="rounded-xl border border-border bg-card p-8">
              <h3 className="text-foreground mb-2 text-xl font-semibold">
                Point Three
              </h3>
              <p className="text-muted-foreground">Description here</p>
            </div>
          </Animated>
        </div>
      </div>
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideAnimated, steps: 3 }
