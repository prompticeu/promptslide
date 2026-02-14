import { Github, Terminal } from "lucide-react"

import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

export function SlideGetStarted({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
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
            <p className="text-muted-foreground">$ git clone https://github.com/prompticeu/powervibe</p>
            <p className="text-muted-foreground">$ cd powervibe && npm install</p>
            <p className="text-muted-foreground">$ npm run dev</p>
            <p className="text-green-400 mt-2">VITE ready on http://localhost:5173</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Github className="text-muted-foreground h-5 w-5" />
          <span className="text-primary text-lg font-medium">
            github.com/prompticeu/powervibe
          </span>
        </div>

        <p className="text-muted-foreground mt-6 max-w-md text-sm">
          Open source &middot; MIT License &middot; Works with any coding agent
        </p>
      </div>
    </SlideLayout>
  )
}
