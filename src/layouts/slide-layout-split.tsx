import { SlideFooter } from "promptslide"

interface SlideLayoutSplitProps {
  children: React.ReactNode
  slideNumber: number
  totalSlides: number
  left: React.ReactNode
  hideFooter?: boolean
}

export function SlideLayoutSplit({
  children,
  slideNumber,
  totalSlides,
  left,
  hideFooter = false
}: SlideLayoutSplitProps) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        {/* Left panel — 35% width, primary tinted background */}
        <div className="flex w-[35%] shrink-0 flex-col justify-center bg-primary/5 px-10 py-10">
          {left}
        </div>

        {/* Right panel — 65% width, main content */}
        <div className="flex flex-1 flex-col justify-center px-12 py-10">
          {children}
        </div>
      </div>

      {/* Footer */}
      {!hideFooter && (
        <div className="absolute right-0 bottom-0 left-0 px-12 pb-6">
          <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />
        </div>
      )}
    </div>
  )
}
