import type { SlideProps } from "promptslide"

import { Animated } from "promptslide"

import { SlideLayoutDark } from "@/layouts/slide-layout-dark"

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
    <SlideLayoutDark
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="TECH STACK"
      title="Built on Modern, Battle-Tested Tools"
    >
      <div className="relative flex h-full items-center">
        {/* Oversized accent */}
        <span className="pointer-events-none absolute -top-2 -right-2 select-none text-[180px] font-black leading-none text-white/3">
          06
        </span>

        <div className="w-full divide-y divide-white/10">
          {stack.map((item, i) => (
            <Animated key={item.name} step={1} animation="fade" delay={i * 0.08} duration={0.5}>
              <div className="grid grid-cols-5 items-baseline gap-8 py-5">
                <div className="col-span-2 flex items-baseline gap-3">
                  <span className="text-2xl font-bold tracking-tight text-white/90" style={{ fontFamily: "Space Grotesk" }}>
                    {item.name}
                  </span>
                  <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                    {item.role}
                  </span>
                </div>
                <p className="col-span-3 text-sm text-white/50">{item.description}</p>
              </div>
            </Animated>
          ))}
        </div>
      </div>
    </SlideLayoutDark>
  )
}
