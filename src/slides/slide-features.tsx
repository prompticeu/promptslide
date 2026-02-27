import {
  FileDown,
  Fullscreen,
  Palette,
  Sparkles,
} from "lucide-react"

import { AnimatedGroup } from "@promptslide/core"
import type { SlideProps } from "@promptslide/core"
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

export function SlideFeatures({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="FEATURES"
      title="Everything You Need, Nothing You Don't"
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
          <h3 className="text-xl font-semibold text-foreground">
            Step Animations
          </h3>
          <p className="mt-2 max-w-md text-muted-foreground">
            Click-to-reveal content with fade, slide, scale, and stagger
            effects. Build narrative flow into every slide.
          </p>
        </div>

        {/* Tall tile — right, spans 2 rows */}
        <div className="row-span-2 flex flex-col justify-between rounded-2xl border border-border bg-card p-6">
          <div>
            <Palette className="mb-3 h-8 w-8 text-primary" />
            <h3 className="font-semibold text-foreground">Themeable</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              OKLCH color system — change one variable to rebrand the entire
              deck. Dark mode built in.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Brand colors
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Dark & light mode
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              1000+ Lucide icons
            </div>
          </div>
        </div>

        {/* Small tile — bottom left */}
        <div className="flex flex-col justify-center rounded-2xl bg-muted/30 p-6">
          <div className="flex items-center gap-4">
            <Fullscreen className="h-7 w-7 shrink-0 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground">Presentation Mode</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Fullscreen, grid view, keyboard nav
              </p>
            </div>
          </div>
        </div>

        {/* Accent tile — bottom center, uses primary bg */}
        <div className="flex flex-col justify-center rounded-2xl bg-primary p-6">
          <div className="flex items-center gap-4">
            <FileDown className="h-7 w-7 shrink-0 text-primary-foreground" />
            <div>
              <h3 className="font-semibold text-primary-foreground">
                PDF Export
              </h3>
              <p className="mt-1 text-sm text-primary-foreground/80">
                One-click download via browser print
              </p>
            </div>
          </div>
        </div>
      </AnimatedGroup>
    </SlideLayoutCentered>
  )
}
