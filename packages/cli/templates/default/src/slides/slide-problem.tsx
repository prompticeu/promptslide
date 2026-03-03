import { Clock, Frown, MousePointerClick } from "lucide-react";

import type { SlideProps } from "promptslide";
import { Animated } from "promptslide";
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered";

export function SlideProblem({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="THE PROBLEM"
      title="Slide Tools Weren't Built for the AI Era"
    >
      <div className="flex h-full items-center">
        <div className="grid w-full grid-cols-3 gap-8">
          <Animated step={1} animation="slide-up">
            <div className="rounded-xl border border-border bg-card p-8">
              <MousePointerClick className="text-primary mb-4 h-10 w-10" />
              <h3 className="text-foreground mb-2 text-xl font-semibold">
                Drag & Drop Busywork
              </h3>
              <p className="text-muted-foreground">
                Traditional tools like PowerPoint and Google Slides require
                hours of manual dragging, aligning, and formatting.
              </p>
            </div>
          </Animated>

          <Animated step={2} animation="slide-up" delay={0.05}>
            <div className="rounded-xl border border-border bg-card p-8">
              <Frown className="text-primary mb-4 h-10 w-10" />
              <h3 className="text-foreground mb-2 text-xl font-semibold">
                Design Inconsistency
              </h3>
              <p className="text-muted-foreground">
                Non-designers struggle to create polished, consistent slides.
                Templates are rigid and hard to customize.
              </p>
            </div>
          </Animated>

          <Animated step={3} animation="slide-up" delay={0.1}>
            <div className="rounded-xl border border-border bg-card p-8">
              <Clock className="text-primary mb-4 h-10 w-10" />
              <h3 className="text-foreground mb-2 text-xl font-semibold">
                Time Sink
              </h3>
              <p className="text-muted-foreground">
                The average pitch deck takes 20+ hours to create. That's time
                better spent building your product.
              </p>
            </div>
          </Animated>
        </div>
      </div>
    </SlideLayoutCentered>
  );
}
