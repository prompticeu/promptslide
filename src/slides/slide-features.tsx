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
        <Animated step={1} animation="scale" duration={0.5} className="col-span-2">
          <div className="relative flex h-full flex-col justify-center bg-white/5 p-8 shadow-2xl">
            <span className="pointer-events-none absolute top-4 right-5 text-7xl font-black text-primary/10">
              01
            </span>
            <Sparkles className="mb-3 h-8 w-8 text-primary" />
            <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "Space Grotesk" }}>Step Animations</h3>
            <p className="mt-2 max-w-md text-muted-foreground">
              Click-to-reveal content with fade, slide, scale, and stagger effects. Build narrative
              flow into every slide.
            </p>
          </div>
        </Animated>

        {/* Tall tile — Themeable, spans 2 rows */}
        <Animated step={1} animation="scale" delay={0.08} duration={0.5} className="row-span-2">
          <div className="flex h-full flex-col justify-between border-l border-primary/20 bg-transparent pl-6">
            <div>
              <Palette className="mb-3 h-8 w-8 text-primary" />
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Space Grotesk" }}>Themeable</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                OKLCH color system — change one variable to rebrand the entire deck. Dark mode built
                in.
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-1.5 w-1.5 bg-primary" />
                Brand colors
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-1.5 w-1.5 bg-primary" />
                Dark & light mode
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-1.5 w-1.5 bg-primary" />
                1000+ Lucide icons
              </div>
            </div>
          </div>
        </Animated>

        {/* Tall tile — Agent Skill, spans 2 rows */}
        <Animated step={1} animation="scale" delay={0.16} duration={0.5} className="row-span-2">
          <div className="flex h-full flex-col justify-between bg-primary/10 p-6 shadow-2xl">
            <div>
              <Blocks className="mb-3 h-8 w-8 text-primary" />
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Space Grotesk" }}>Agent Skill</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Ship a SKILL.md with your deck so any coding agent instantly knows how to add,
                edit, and style slides.
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-1.5 w-1.5 bg-primary" />
                Works with any agent
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-1.5 w-1.5 bg-primary" />
                Layout & theme guidance
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-1.5 w-1.5 bg-primary" />
                Zero config needed
              </div>
            </div>
          </div>
        </Animated>

        {/* Small tile — Presentation Mode */}
        <Animated step={1} animation="scale" delay={0.24} duration={0.5}>
          <div className="flex h-full flex-col justify-center bg-white/5 p-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <Fullscreen className="h-7 w-7 shrink-0 text-primary" />
              <div>
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Space Grotesk" }}>Presentation Mode</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fullscreen, grid view, keyboard nav
                </p>
              </div>
            </div>
          </div>
        </Animated>

        {/* Accent tile — PDF Export */}
        <Animated step={1} animation="scale" delay={0.32} duration={0.5}>
          <div className="flex h-full flex-col justify-center bg-primary p-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <FileDown className="h-7 w-7 shrink-0 text-primary-foreground" />
              <div>
                <h3 className="font-bold text-primary-foreground" style={{ fontFamily: "Space Grotesk" }}>PDF Export</h3>
                <p className="mt-1 text-sm text-primary-foreground/80">
                  One-click download via browser print
                </p>
              </div>
            </div>
          </div>
        </Animated>
      </div>
    </SlideLayoutCentered>
  )
}
