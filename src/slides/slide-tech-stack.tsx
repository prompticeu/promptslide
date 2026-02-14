import { Animated } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

const stack = [
  {
    name: "React 19",
    role: "UI Components",
    description: "Each slide is a React component with full access to the ecosystem"
  },
  {
    name: "Tailwind CSS 4",
    role: "Styling",
    description: "Utility-first CSS with OKLCH color theme and dark mode support"
  },
  {
    name: "Framer Motion 12",
    role: "Animations",
    description: "Spring-based step animations, slide transitions, and layout morphs"
  },
  {
    name: "Vite 6",
    role: "Dev Server",
    description: "Instant HMR — slides appear the moment the agent saves a file"
  },
  {
    name: "Lucide Icons",
    role: "Iconography",
    description: "1000+ beautiful, consistent icons ready to use in any slide"
  }
]

export function SlideTechStack({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="TECH STACK"
      title="Built on Modern, Battle-Tested Tools"
    >
      <div className="flex h-full items-center">
        <div className="w-full space-y-4">
          {stack.map((item, index) => (
            <Animated key={item.name} step={1} animation="slide-up" delay={index * 0.05}>
              <div className="flex items-center gap-6 rounded-lg border border-border bg-card px-6 py-4">
                <div className="text-primary w-40 shrink-0 text-lg font-bold">
                  {item.name}
                </div>
                <div className="text-foreground w-32 shrink-0 text-sm font-medium uppercase tracking-wider opacity-60">
                  {item.role}
                </div>
                <div className="text-muted-foreground text-sm">
                  {item.description}
                </div>
              </div>
            </Animated>
          ))}
        </div>
      </div>
    </SlideLayout>
  )
}
