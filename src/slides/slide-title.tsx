import type { SlideProps } from "promptslide"

import { Presentation } from "lucide-react"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

function LinkedContentExample({ title }: { title: string }) {
  return (
    <div className="mt-8 border-t border-border pt-5">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">
        Linked content example
      </p>
      <p className="mt-2 text-xl font-medium text-foreground">{title}</p>
    </div>
  )
}

export function SlideTitle({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="flex h-full w-full flex-col items-center justify-center text-center">
        <Presentation className="mx-auto mb-6 h-14 w-14 text-primary" />
        <h1 className="max-w-5xl text-7xl font-bold tracking-tight text-foreground">PromptSlide</h1>
        <p className="mt-6 max-w-3xl text-xl font-light text-muted-foreground">
          Vibe-code beautiful slide decks with your favorite coding agent
        </p>
        <div className="mt-8 h-1 w-24 rounded-full bg-primary" />
        <div className="mt-10 text-sm text-muted-foreground">
          Open Source &middot; React + Tailwind + Framer Motion
        </div>
        <LinkedContentExample title="Our strategy for next year" />
      </div>
    </SlideLayoutCentered>
  )
}
