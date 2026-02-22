import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

export function SlideTitle({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="flex h-full w-full flex-col items-center justify-center text-center">
        <h1 className="text-foreground max-w-5xl text-5xl font-bold tracking-tight md:text-7xl">
          Presentation Title
        </h1>
        <p className="text-muted-foreground mt-6 max-w-3xl text-xl font-light">
          Subtitle or tagline goes here
        </p>
        <div className="text-muted-foreground mt-16 text-sm">
          Additional context
        </div>
      </div>
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideTitle, steps: 0 }
