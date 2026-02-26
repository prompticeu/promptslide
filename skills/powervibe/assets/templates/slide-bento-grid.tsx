import { Sparkles, Zap, Shield, TrendingUp } from "lucide-react"

import { AnimatedGroup } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

export function SlideBentoGrid({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="FEATURES"
      title="What's Included"
    >
      <AnimatedGroup
        startStep={1}
        animation="slide-down"
        staggerDelay={0.1}
        className="grid h-full grid-cols-3 grid-rows-2 gap-4"
      >
        {/* Wide tile — top left, spans 2 cols */}
        <div className="col-span-2 flex flex-col justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-transparent p-8">
          <Sparkles className="mb-3 h-8 w-8 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">Primary Feature</h3>
          <p className="mt-2 max-w-md text-muted-foreground">
            The main capability — describe what makes this the most important feature.
          </p>
        </div>

        {/* Tall tile — right, spans 2 rows */}
        <div className="row-span-2 flex flex-col justify-between rounded-2xl border border-border bg-card p-6">
          <div>
            <Shield className="mb-3 h-8 w-8 text-primary" />
            <h3 className="font-semibold text-foreground">Tall Feature</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This tile has room for more detail or a vertical list.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Detail one
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Detail two
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Detail three
            </div>
          </div>
        </div>

        {/* Small tile — bottom left */}
        <div className="flex flex-col justify-center rounded-2xl bg-muted/30 p-6">
          <Zap className="mb-2 h-7 w-7 text-primary" />
          <h3 className="font-semibold text-foreground">Quick Feature</h3>
          <p className="mt-1 text-sm text-muted-foreground">Short description</p>
        </div>

        {/* Accent tile — bottom center, uses primary bg */}
        <div className="flex flex-col justify-center rounded-2xl bg-primary p-6">
          <TrendingUp className="mb-2 h-7 w-7 text-primary-foreground" />
          <h3 className="font-semibold text-primary-foreground">Highlight</h3>
          <p className="mt-1 text-sm text-primary-foreground/80">Stands out from the rest</p>
        </div>
      </AnimatedGroup>
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideBentoGrid, steps: 1 }
