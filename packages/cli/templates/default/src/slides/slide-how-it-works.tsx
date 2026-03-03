import { ArrowRight } from "lucide-react";

import type { SlideProps } from "promptslide";
import { Animated } from "promptslide";
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered";

const steps = [
  {
    number: "1",
    title: "Scaffold",
    description: "bun create slides my-deck — pick a brand color and go",
    color: "from-blue-500/20 to-blue-600/5",
  },
  {
    number: "2",
    title: "Install the Skill",
    description: "The CLI prompts to install the PromptSlide skill for your agent",
    color: "from-violet-500/20 to-violet-600/5",
  },
  {
    number: "3",
    title: "Describe Your Deck",
    description: '"Create a 10-slide pitch deck for my fintech startup"',
    color: "from-pink-500/20 to-pink-600/5",
  },
  {
    number: "4",
    title: "Present & Export",
    description: "Fullscreen mode, grid view, or PDF download",
    color: "from-emerald-500/20 to-emerald-600/5",
  },
];

export function SlideHowItWorks({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered
      slideNumber={slideNumber}
      totalSlides={totalSlides}
      eyebrow="HOW IT WORKS"
      title="From Zero to Presentation in Minutes"
    >
      <div className="flex h-full items-center">
        <div className="flex w-full items-center justify-between gap-4">
          {steps.map((step, index) => (
            <Animated key={step.number} step={index + 1} animation="slide-up" delay={index * 0.05}>
              <div className="flex items-center gap-4">
                <div className={`rounded-xl border border-border bg-gradient-to-b ${step.color} p-6 w-[240px]`}>
                  <div className="text-primary mb-3 text-3xl font-bold">
                    {step.number}
                  </div>
                  <h3 className="text-foreground mb-2 text-lg font-semibold">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="text-muted-foreground h-5 w-5 shrink-0" />
                )}
              </div>
            </Animated>
          ))}
        </div>
      </div>
    </SlideLayoutCentered>
  );
}
