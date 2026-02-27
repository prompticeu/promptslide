import { Presentation } from "lucide-react";

import type { SlideProps } from "promptslide-core";
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered";

export function SlideTitle({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="relative flex h-full w-full flex-col items-center justify-center text-center">
        <Presentation className="text-primary mb-6 h-16 w-16" />

        <h1 className="text-foreground max-w-5xl text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl">
          {{ PROJECT_NAME }}
        </h1>

        <p className="text-muted-foreground mt-6 max-w-3xl text-xl font-light md:text-2xl">
          A presentation built with PromptSlide
        </p>

        <div className="text-muted-foreground mt-16 text-sm">
          Press <kbd className="rounded bg-card px-2 py-0.5 font-mono text-xs">Space</kbd> or{" "}
          <kbd className="rounded bg-card px-2 py-0.5 font-mono text-xs">&rarr;</kbd> to navigate
        </div>
      </div>
    </SlideLayoutCentered>
  );
}
