import { Animated } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

export function SlideHeroGradient({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      {/* Gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
      <div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-10 h-64 w-64 rounded-full bg-primary/5 blur-2xl" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
        <Animated step={1} animation="scale">
          <h1 className="text-foreground max-w-5xl text-7xl font-bold tracking-tight">
            Presentation Title
          </h1>
        </Animated>

        <Animated step={1} animation="fade" delay={0.2}>
          <p className="text-muted-foreground mt-6 max-w-2xl text-xl font-light">
            Subtitle or tagline goes here
          </p>
        </Animated>

        <Animated step={1} animation="fade" delay={0.4}>
          <div className="mt-8 h-1 w-24 rounded-full bg-primary" />
        </Animated>

        <Animated step={1} animation="fade" delay={0.5}>
          <div className="text-muted-foreground mt-10 text-sm">
            Additional context
          </div>
        </Animated>
      </div>
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideHeroGradient, steps: 1 }
