import { Sparkles, Shield, Zap, Globe } from "lucide-react"

import { AnimatedGroup } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

const features = [
  { icon: Sparkles, title: "Feature One", description: "Brief description of this capability" },
  { icon: Shield, title: "Feature Two", description: "Brief description of this capability" },
  { icon: Zap, title: "Feature Three", description: "Brief description of this capability" },
  { icon: Globe, title: "Feature Four", description: "Brief description of this capability" },
]

export function SlideGlassmorphism({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="SECTION"
      title="Slide Title"
    >
      <div className="relative flex h-full items-center">
        {/* Background gradient orbs */}
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-gradient-to-br from-primary/30 to-transparent blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-gradient-to-tr from-primary/20 to-transparent blur-xl" />

        {/* Glass cards */}
        <AnimatedGroup startStep={1} animation="scale" staggerDelay={0.12} className="relative z-10 grid w-full grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-primary/5 backdrop-blur-md"
            >
              <feature.icon className="mb-4 h-10 w-10 text-primary" />
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </AnimatedGroup>
      </div>
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideGlassmorphism, steps: 1 }
