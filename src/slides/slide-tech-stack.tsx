import type { SlideProps } from "promptslide-core"

import { AnimatedGroup } from "promptslide-core"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

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
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="TECH STACK"
      title="Built on Modern, Battle-Tested Tools"
    >
      <div className="relative flex h-full items-center">
        {/* Background gradient orbs */}
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-gradient-to-br from-primary/25 to-transparent blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-gradient-to-tr from-primary/15 to-transparent blur-xl" />

        {/* Glass cards */}
        <AnimatedGroup
          startStep={1}
          animation="scale"
          staggerDelay={0.08}
          className="relative z-10 grid w-full grid-cols-2 gap-5"
        >
          {stack.map(item => (
            <div
              key={item.name}
              className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 shadow-lg shadow-primary/5 backdrop-blur-md"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-bold text-primary">{item.name}</span>
                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  {item.role}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </AnimatedGroup>
      </div>
    </SlideLayoutCentered>
  )
}
