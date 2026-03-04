import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"
import { Presentation } from "lucide-react"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

export function SlideTitle({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="flex h-full w-full flex-col items-center justify-center text-center">
        {/* Oversized background number */}
        <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none text-[280px] font-black leading-none text-white/3">
          PS
        </span>

        <Animated step={1} animation="scale" duration={0.6}>
          <Presentation className="mx-auto mb-8 h-16 w-16 text-primary" />
          <h1 className="max-w-5xl text-8xl font-bold tracking-tighter text-foreground" style={{ fontFamily: "Space Grotesk" }}>
            PromptSlide
          </h1>
        </Animated>

        <Animated step={1} animation="fade" delay={0.3} duration={0.5}>
          <p className="mt-6 max-w-3xl text-xl font-light text-muted-foreground">
            Vibe-code beautiful slide decks with your favorite coding agent
          </p>
        </Animated>

        <Animated step={1} animation="fade" delay={0.5} duration={0.5}>
          <div className="mt-8 h-1 w-32 bg-primary" />
        </Animated>

        <Animated step={1} animation="fade" delay={0.6} duration={0.5}>
          <div className="mt-10 text-sm tracking-widest text-muted-foreground uppercase">
            Open Source &middot; React + Tailwind + Framer Motion
          </div>
        </Animated>
      </div>
    </SlideLayoutCentered>
  )
}
