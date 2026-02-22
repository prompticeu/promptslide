import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

export function SlideBasic({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="SECTION"
      title="Slide Title"
    >
      <div className="flex h-full flex-col justify-center">
        <p className="text-muted-foreground text-lg">Content here</p>
      </div>
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideBasic, steps: 0 }
