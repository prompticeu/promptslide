import type { SlideProps } from "promptslide-core"

import { Animated } from "promptslide-core"

import { SlideLayoutCentered } from "@/layouts/slide-layout-centered"

export function SlideSolution({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayoutCentered slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="-mx-12 -mt-12 -mb-6 grid h-[calc(100%+4.5rem)] grid-cols-5">
        {/* Left panel — bold statement on solid primary */}
        <Animated
          step={1}
          animation="slide-right"
          className="col-span-2 flex flex-col justify-center bg-primary p-12"
        >
          <h2 className="text-5xl leading-tight font-bold text-primary-foreground">
            Describe it.
            <br />
            See it.
            <br />
            Present it.
          </h2>
          <p className="mt-6 text-lg text-primary-foreground/80">
            Tell your coding agent what slides you need. Watch them appear in real-time.
          </p>
        </Animated>

        {/* Right panel — terminal demo */}
        <div className="col-span-3 flex items-center justify-center p-12">
          <Animated step={2} animation="slide-left" className="w-full">
            <div className="w-full rounded-xl border border-border bg-card p-6">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <div className="h-3 w-3 rounded-full bg-green-500/60" />
                <span className="ml-2 font-mono text-xs text-muted-foreground">terminal</span>
              </div>
              <div className="space-y-2 font-mono text-sm">
                <p className="text-muted-foreground">$ npm run dev</p>
                <p className="text-green-400">VITE v6.4 ready in 400ms</p>
                <p className="mt-4 text-muted-foreground">$ claude</p>
                <p className="text-foreground">
                  &gt; Create a pitch deck about our AI product with slides for problem, solution,
                  market, team, and fundraising
                </p>
                <p className="mt-2 text-primary">Creating 6 slides...</p>
              </div>
            </div>
          </Animated>
        </div>
      </div>
    </SlideLayoutCentered>
  )
}
