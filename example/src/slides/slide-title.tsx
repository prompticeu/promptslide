import { Presentation } from "lucide-react"

import { SlideLayout } from "powervibe"
import type { SlideProps } from "powervibe"

export function SlideTitle({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="relative flex h-full w-full flex-col items-center justify-center text-center">
        <Presentation className="text-primary mb-6 h-16 w-16" />

        <h1 className="text-foreground max-w-5xl text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl">
          PowerVibe
        </h1>

        <p className="text-muted-foreground mt-6 max-w-3xl text-xl font-light md:text-2xl">
          Vibe-code beautiful slide decks with your favorite coding agent
        </p>

        <div className="text-muted-foreground mt-16 text-sm">
          Open Source &middot; React + Tailwind + Framer Motion
        </div>
      </div>
    </SlideLayout>
  )
}
