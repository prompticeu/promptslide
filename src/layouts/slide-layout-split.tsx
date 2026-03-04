import { useTheme, SlideFooter } from "promptslide"

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
  const theme = useTheme()

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        {/* Left panel — bold accent strip */}
        <div className="flex w-[38%] shrink-0 flex-col justify-center px-12 py-10" style={{ background: "oklch(0.08 0 0)" }}>
          {left}
        </div>

        {/* Right panel — content */}
        <div className="flex flex-1 flex-col justify-center px-14 py-10">
          {children}
        </div>
      </div>

      {/* Footer */}
      {!hideFooter && (
        <div className="absolute right-0 bottom-0 left-0 px-14 pb-6">
          <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} variant="light" />
        </div>
      )}
    </div>
  )
}
