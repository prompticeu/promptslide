import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"
import { Github } from "lucide-react"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

export function SlideGetStarted({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="flex h-full items-center justify-center">
        <Animated step={1} animation="fade">
          <div className="flex flex-col items-center gap-6 text-center">
          <div>
            <span className="block font-serif text-[80px] leading-none text-primary/20">
              &ldquo;
            </span>
            <p className="-mt-6 max-w-3xl text-2xl leading-relaxed font-light text-foreground italic">
              Iterate on your story, not your layouts.
            </p>
          </div>

          <div className="h-px w-16 bg-primary/40" />

          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4">
            <div className="space-y-1 text-left font-mono text-xs">
              <p className="text-muted-foreground">
                $ bun create slides my-deck
              </p>
              <p className="text-muted-foreground">
                $ cd my-deck && bun install
              </p>
              <p className="text-muted-foreground">
                $ bun run dev
              </p>
              <p className="mt-1 text-green-400">VITE ready on http://localhost:5173</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-medium text-primary">
                github.com/prompticeu/promptslide
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Open source &middot; MIT License &middot; Works with any coding agent
            </p>
          </div>
          </div>
        </Animated>
      </div>
    </SlideLayoutCentered>
  )
}
