import {
  FileDown,
  Fullscreen,
  Grid3X3,
  Keyboard,
  Palette,
  Sparkles,
} from "lucide-react";

import type { SlideProps } from "promptslide";
import { Animated } from "promptslide";
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered";

const features = [
  {
    icon: Sparkles,
    title: "Step & Morph Animations",
    description: "Click-to-reveal steps, stagger groups, and shared-element morphs between slides",
  },
  {
    icon: Fullscreen,
    title: "Presentation Mode",
    description: "True fullscreen with viewport scaling at native 1280x720 resolution",
  },
  {
    icon: Grid3X3,
    title: "Grid Overview",
    description: "Thumbnail grid of all slides — click any to jump directly",
  },
  {
    icon: FileDown,
    title: "PDF Export",
    description: "List view optimized for browser print — one-click PDF download",
  },
  {
    icon: Palette,
    title: "Themeable",
    description: "OKLCH color system with brand name, logo, fonts, and dark mode built in",
  },
  {
    icon: Keyboard,
    title: "Agent Skill",
    description: "Install the PromptSlide skill so your agent knows the full slide API",
  },
];

export function SlideFeatures({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
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
    </SlideLayoutCentered>
  );
}
