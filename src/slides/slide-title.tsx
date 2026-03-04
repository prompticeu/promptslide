import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"
import { Presentation } from "lucide-react"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

export function SlideTitle({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="flex h-full w-full flex-col items-center justify-center text-center">
        <Animated step={1} animation="scale">
          <Presentation className="mx-auto mb-6 h-14 w-14 text-primary" />
          <h1 className="max-w-5xl text-7xl font-bold tracking-tight text-foreground">
            PromptSlide
          </h1>
        </Animated>

        <Animated step={1} animation="fade" delay={0.2}>
          <p className="mt-6 max-w-3xl text-xl font-light text-muted-foreground">
            Vibe-code beautiful slide decks with your favorite coding agent
          </p>
        </Animated>

        <Animated step={1} animation="fade" delay={0.4}>
          <div className="mt-8 h-1 w-24 rounded-full bg-primary" />
        </Animated>

        <Animated step={1} animation="fade" delay={0.5}>
          <div className="mt-10 text-sm text-muted-foreground">
            Open Source &middot; React + Tailwind + Framer Motion
          </div>
        </Animated>
      </div>
    </SlideLayoutCentered>
  )
}
