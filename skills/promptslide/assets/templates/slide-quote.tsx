import type { SlideProps } from "@/framework/types"

import { Animated } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"

export function SlideQuote({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <Animated step={1} animation="fade">
          <div>
            {/* Decorative quotation mark */}
            <span className="block font-serif text-[120px] leading-none text-primary/20">
              &ldquo;
            </span>

            <p className="-mt-10 max-w-4xl text-3xl leading-relaxed font-light text-foreground italic">
              The best presentation is the one you didn't spend twenty hours making.
            </p>
          </div>
        </Animated>

        <Animated step={1} animation="slide-up" delay={0.3}>
          <div>
            <div className="mx-auto mt-8 mb-6 h-px w-16 bg-primary/40" />
            <div className="text-lg font-semibold text-foreground">Speaker Name</div>
            <div className="text-sm text-muted-foreground">Title, Company</div>
          </div>
        </Animated>
      </div>
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideQuote, steps: 1 }
