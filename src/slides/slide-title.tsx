import type { SlideProps } from "@promptslide/core"

import { Animated } from "@promptslide/core"
import { Presentation } from "lucide-react"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

export function SlideTitle({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      {/* Gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
      <div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute right-10 bottom-1/3 h-64 w-64 rounded-full bg-primary/5 blur-2xl" />

      {/* Content */}
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center">
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
