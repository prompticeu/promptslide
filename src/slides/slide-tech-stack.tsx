import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"

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
      <Animated step={1} animation="fade">
        <div className="flex h-full items-center">
          <div className="w-full divide-y divide-border">
            {stack.map((item) => (
              <div key={item.name} className="grid grid-cols-5 items-baseline gap-8 py-5">
                <div className="col-span-2 flex items-baseline gap-3">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {item.name}
                  </span>
                  <span className="text-xs font-medium tracking-wider text-primary uppercase">
                    {item.role}
                  </span>
                </div>
                <p className="col-span-3 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Animated>
    </SlideLayoutCentered>
  )
}
