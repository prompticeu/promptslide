import { Animated } from "@/framework/animated"
import { SlideLayout } from "@/framework/slide-layout"
import type { SlideProps } from "@/framework/types"

export function SlideSplitScreen({ slideNumber, totalSlides }: SlideProps) {
  return (
    <SlideLayout slideNumber={slideNumber} totalSlides={totalSlides} hideFooter>
      <div className="-mx-12 -mt-12 -mb-6 grid h-[calc(100%+4.5rem)] grid-cols-5">
        {/* Left panel — bold statement on solid primary */}
        <Animated step={1} animation="slide-right" className="col-span-2 flex flex-col justify-center bg-primary p-12">
          <h2 className="text-5xl font-bold leading-tight text-primary-foreground">
            Bold Statement Here
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80">
            Supporting context that reinforces the headline.
          </p>
        </Animated>

        {/* Right panel — detailed content */}
        <div className="col-span-3 flex flex-col justify-center space-y-6 p-12">
          <Animated step={2} animation="slide-left">
            <div className="flex items-start gap-4">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">First Point</h3>
                <p className="text-muted-foreground">Description goes here</p>
              </div>
            </div>
          </Animated>

          <Animated step={2} animation="slide-left" delay={0.08}>
            <div className="flex items-start gap-4">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Second Point</h3>
                <p className="text-muted-foreground">Description goes here</p>
              </div>
            </div>
          </Animated>

          <Animated step={2} animation="slide-left" delay={0.16}>
            <div className="flex items-start gap-4">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Third Point</h3>
                <p className="text-muted-foreground">Description goes here</p>
              </div>
            </div>
          </Animated>
        </div>
      </div>
    </SlideLayout>
  )
}
// deck-config.ts: { component: SlideSplitScreen, steps: 2 }
