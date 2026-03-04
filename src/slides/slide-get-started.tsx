import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"
import { Github } from "lucide-react"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

export function SlideGetStarted({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <Animated step={1} animation="fade" duration={0.6}>
          <div>
            {/* Decorative quotation mark */}
            <span className="block text-[140px] leading-none text-primary/20" style={{ fontFamily: "Space Grotesk" }}>
              &ldquo;
            </span>
            <p className="-mt-12 max-w-4xl text-4xl leading-relaxed font-light text-foreground italic">
              Iterate on your story, not your layouts.
            </p>
          </div>
        </Animated>

        <Animated step={1} animation="scale" delay={0.4} duration={0.5}>
          <div>
            <div className="mx-auto mt-10 mb-10 h-1 w-20 bg-primary" />

            {/* Terminal snippet */}
            <div className="mb-8 w-full max-w-lg bg-white/5 p-5 shadow-2xl">
              <div className="space-y-1.5 text-left font-mono text-xs">
                <p className="text-muted-foreground">
                  $ git clone https://github.com/prompticeu/promptslide
                </p>
                <p className="text-muted-foreground">
                  $ cd promptslide && npm install && npm run dev
                </p>
                <p className="mt-2 text-primary">VITE ready on http://localhost:5173</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Github className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-bold text-primary" style={{ fontFamily: "Space Grotesk" }}>
                github.com/prompticeu/promptslide
              </span>
            </div>

            <p className="mt-5 max-w-md text-sm tracking-wider text-muted-foreground uppercase">
              Open source &middot; MIT License &middot; Works with any coding agent
            </p>
          </div>
        </Animated>
      </div>
    </SlideLayoutCentered>
  )
}
