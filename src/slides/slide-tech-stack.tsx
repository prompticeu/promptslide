import type { SlideProps } from "promptslide"

import { AnimatedGroup } from "promptslide"

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
    name: "TypeScript",
    role: "Type Safety",
    description: "Full type checking for slide props, themes, and component APIs"
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
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl print:hidden" />
        <div className="absolute -bottom-20 left-1/3 h-60 w-60 rounded-full bg-gradient-to-tr from-primary/10 to-transparent blur-2xl print:hidden" />
        {/* Print-friendly gradient replacement (blur doesn't render in PDF) */}
        <div
          className="pointer-events-none absolute inset-0 hidden print:block"
          style={{
            background:
              "radial-gradient(ellipse at 80% 10%, oklch(0.6 0.2 250 / 0.15) 0%, transparent 50%), radial-gradient(ellipse at 35% 90%, oklch(0.6 0.2 250 / 0.08) 0%, transparent 50%)"
          }}
        />

        {/* Glass cards */}
        <AnimatedGroup
          startStep={1}
          animation="scale"
          staggerDelay={0.08}
          className="relative z-10 grid w-full grid-cols-3 gap-4"
        >
          {stack.map(item => (
            <div
              key={item.name}
              className="rounded-2xl border border-white/[0.12] bg-white/[0.08] px-5 py-4 shadow-lg shadow-primary/5 backdrop-blur-md print:bg-white/[0.12] print:backdrop-blur-none"
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
