import { Lightbulb, Rocket, Zap } from "lucide-react";

import { Animated, AnimatedGroup } from "promptslide";
import type { SlideProps } from "promptslide";
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered";

export function SlideExample({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="EXAMPLE"
      title="Click to Reveal Content"
      subtitle="This slide demonstrates step animations. Click or press Space to advance."
    >
      <div className="flex h-full flex-col justify-center">
        <Animated step={1} animation="fade">
          <p className="text-muted-foreground mb-8 text-lg">
            Each element appears on click. Edit this slide or create new ones in{" "}
            <code className="text-primary font-mono text-sm">src/slides/</code>
          </p>
        </Animated>

        <AnimatedGroup
          startStep={2}
          animation="slide-up"
          staggerDelay={0.1}
          className="grid grid-cols-3 gap-6"
        >
          <div className="rounded-xl border border-border bg-card p-6">
            <Lightbulb className="text-primary mb-3 h-8 w-8" />
            <h3 className="text-foreground mb-1 font-semibold">Idea</h3>
            <p className="text-muted-foreground text-sm">
              Describe your slides in natural language
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <Zap className="text-primary mb-3 h-8 w-8" />
            <h3 className="text-foreground mb-1 font-semibold">Build</h3>
            <p className="text-muted-foreground text-sm">
              Your coding agent creates the components
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <Rocket className="text-primary mb-3 h-8 w-8" />
            <h3 className="text-foreground mb-1 font-semibold">Present</h3>
            <p className="text-muted-foreground text-sm">Press F to go fullscreen and present</p>
          </div>
        </AnimatedGroup>
      </div>
    </SlideLayoutCentered>
  );
}
