import {
  FileDown,
  Fullscreen,
  Grid3X3,
  Keyboard,
  Palette,
  Sparkles
} from "lucide-react"

import { Animated, SlideLayout } from "powervibe"
import type { SlideProps } from "powervibe"

const features = [
  {
    icon: Sparkles,
    title: "Step Animations",
    description: "Click-to-reveal content with fade, slide, scale, and stagger effects"
  },
  {
    icon: Fullscreen,
    title: "Presentation Mode",
    description: "True fullscreen with scaled slides at native 1280x720 resolution"
  },
  {
    icon: Grid3X3,
    title: "Grid Overview",
    description: "Thumbnail grid of all slides — click any to jump directly"
  },
  {
    icon: FileDown,
    title: "PDF Export",
    description: "One-click PDF download via browser print with optimized layout"
  },
  {
    icon: Palette,
    title: "Themeable",
    description: "OKLCH color system — change one variable to rebrand the entire deck"
  },
  {
    icon: Keyboard,
    title: "Keyboard Navigation",
    description: "Arrow keys, space, F for fullscreen, G for grid — fast and intuitive"
  }
]

export function SlideFeatures({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="FEATURES"
      title="Everything You Need, Nothing You Don't"
    >
      <div className="flex h-full items-center">
        <div className="grid w-full grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Animated
              key={feature.title}
              step={index < 3 ? 1 : 2}
              animation="slide-up"
              delay={(index % 3) * 0.05}
            >
              <div className="rounded-xl border border-border bg-card p-6">
                <feature.icon className="text-primary mb-3 h-8 w-8" />
                <h3 className="text-foreground mb-1 font-semibold">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </div>
            </Animated>
          ))}
        </div>
      </div>
    </SlideLayout>
  )
}
