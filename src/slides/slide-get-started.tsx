import { Github } from "lucide-react"

import { Animated } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

export function SlideGetStarted({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <Animated step={1} animation="fade">
          <div>
            {/* Decorative quotation mark */}
            <span className="block font-serif text-[120px] leading-none text-primary/20">
              &ldquo;
            </span>
            <p className="-mt-10 max-w-4xl text-3xl font-light leading-relaxed italic text-foreground">
              The best presentation is the one you didn't spend twenty hours making.
            </p>
          </div>
        </Animated>

        <Animated step={1} animation="slide-up" delay={0.3}>
          <div>
            <div className="mx-auto mt-8 mb-8 h-px w-16 bg-primary/40" />

            {/* Terminal snippet */}
            <div className="mb-6 w-full max-w-md rounded-xl border border-border bg-card p-4">
              <div className="space-y-1 text-left font-mono text-xs">
                <p className="text-muted-foreground">
                  $ git clone https://github.com/prompticeu/promptslide
                </p>
                <p className="text-muted-foreground">
                  $ cd promptslide && npm install && npm run dev
                </p>
                <p className="mt-1 text-green-400">
                  VITE ready on http://localhost:5173
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Github className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-medium text-primary">
                github.com/prompticeu/promptslide
              </span>
            </div>

            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Open source &middot; MIT License &middot; Works with any coding
              agent
            </p>
          </div>
        </Animated>
      </div>
    </SlideLayout>
  )
}
