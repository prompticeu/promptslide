import { Github, Terminal } from "lucide-react";

import type { SlideProps } from "promptslide";
import { SlideLayoutCentered } from "@/layouts/slide-layout-centered";

export function SlideGetStarted({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="flex h-full w-full flex-col items-center justify-center text-center">
        <h1 className="text-foreground mb-8 text-5xl font-bold tracking-tight">
          Start Building Slides
        </h1>

        <div className="mb-12 w-full max-w-lg rounded-xl border border-border bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground text-xs font-mono">terminal</span>
          </div>
          <div className="space-y-1 text-left font-mono text-sm">
            <p className="text-muted-foreground">$ bun create slides my-deck</p>
            <p className="text-muted-foreground">$ cd my-deck && bun dev</p>
            <p className="text-green-400 mt-2">VITE ready on http://localhost:5173</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Github className="text-muted-foreground h-5 w-5" />
          <span className="text-primary text-lg font-medium">
            github.com/prompticeu/promptslide
          </span>
        </div>

        <p className="text-muted-foreground mt-6 max-w-md text-sm">
          Open source &middot; MIT License &middot; Works with any coding agent
        </p>
      </div>
    </SlideLayoutCentered>
  );
}
