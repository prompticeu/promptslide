import type { SlideProps } from "promptslide";
import { Animated } from "promptslide";
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered";

const stack = [
  {
    name: "React 19",
    role: "UI Components",
    description: "Each slide is a React component with full access to the ecosystem",
  },
  {
    name: "Tailwind CSS 4",
    role: "Styling",
    description: "Utility-first CSS with OKLCH color system and dark mode support",
  },
  {
    name: "Framer Motion 12",
    role: "Animations",
    description: "Step animations, slide transitions, and shared-element morphs",
  },
  {
    name: "Vite 6",
    role: "Dev & Build",
    description: "Instant HMR in dev, static HTML/CSS/JS build for production",
  },
  {
    name: "PromptSlide CLI",
    role: "Tooling",
    description: "create, studio, build, preview — everything wired up out of the box",
  },
];

export function SlideTechStack({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
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
    </SlideLayoutCentered>
  );
}
