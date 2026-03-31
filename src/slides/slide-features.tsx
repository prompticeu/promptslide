import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"
import { FileDown, Fullscreen, Palette, Sparkles, Blocks } from "lucide-react"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

export function SlideFeatures({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="FEATURES"
      title="Everything You Need, Nothing You Don't"
    >
      <div className="grid h-full grid-cols-4 grid-rows-2 gap-4">
        {/* Wide tile — top left, spans 2 cols */}
        <Animated step={1} animation="slide-down" className="col-span-2">
          <div className="flex h-full flex-col justify-center rounded-2xl bg-primary/10 p-8">
            <Sparkles className="mb-3 h-8 w-8 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">Step Animations</h3>
            <p className="mt-2 max-w-md text-muted-foreground">
              Click-to-reveal content with fade, slide, scale, and stagger effects. Build narrative
              flow into every slide.
            </p>
          </div>
        </Animated>

        {/* Tall tile — Themeable, spans 2 rows */}
        <Animated step={1} animation="slide-down" className="row-span-2">
          <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-6">
            <div>
              <Palette className="mb-3 h-8 w-8 text-primary" />
              <h3 className="font-semibold text-foreground">Themeable</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                OKLCH color system — change one variable to rebrand the entire deck. Dark mode built
                in.
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
        </Animated>

        {/* Tall tile — Agent Skill, spans 2 rows */}
        <Animated step={1} animation="slide-down" className="row-span-2">
          <div className="flex h-full flex-col justify-between rounded-2xl border border-primary/15 bg-primary/5 p-6">
            <div>
              <Blocks className="mb-3 h-8 w-8 text-primary" />
              <h3 className="font-semibold text-foreground">Agent Skill</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Ship a SKILL.md with your deck so any coding agent instantly knows how to add,
                edit, and style slides.
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Works with any agent
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Layout & theme guidance
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Zero config needed
              </div>
            </div>
          </div>
        </Animated>

        {/* Small tile — Presentation Mode */}
        <Animated step={1} animation="slide-down">
          <div className="flex h-full flex-col justify-center rounded-2xl bg-muted/30 p-6">
            <Fullscreen className="mb-3 h-7 w-7 text-primary" />
            <h3 className="font-semibold text-foreground">Presentation Mode</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Fullscreen, grid view, keyboard nav
            </p>
          </div>
        </Animated>

        {/* Accent tile — PDF Export */}
        <Animated step={1} animation="slide-down">
          <div className="flex h-full flex-col justify-center rounded-2xl bg-primary p-6">
            <FileDown className="mb-3 h-7 w-7 text-primary-foreground" />
            <h3 className="font-semibold text-primary-foreground">PDF Export</h3>
            <p className="mt-1 text-sm text-primary-foreground/80">
              One-click download via browser print
            </p>
          </div>
        </Animated>
      </div>
    </SlideLayoutCentered>
  )
}
