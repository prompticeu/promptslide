import { useTheme, SlideFooter, cn } from "promptslide"

interface SlideLayoutSplitProps {
  children: {
    left: React.ReactNode
    right: React.ReactNode
  }
  slideNumber: number
  totalSlides: number
  leftTitle?: string
  rightTitle?: string
  leftAccent?: boolean
  rightAccent?: boolean
  ratio?: "50/50" | "40/60" | "60/40"
  hideFooter?: boolean
}

const ratioClasses = {
  "50/50": "grid-cols-2",
  "40/60": "grid-cols-5",
  "60/40": "grid-cols-5"
} as const

export function SlideLayoutSplit({
  children,
  slideNumber,
  totalSlides,
  leftTitle,
  rightTitle,
  leftAccent = false,
  rightAccent = false,
  ratio = "50/50",
  hideFooter = false
}: SlideLayoutSplitProps) {
  const theme = useTheme()
  const headingFont = theme?.fonts?.heading ? { fontFamily: theme.fonts.heading } : undefined

  const leftSpan = ratio === "40/60" ? "col-span-2" : ratio === "60/40" ? "col-span-3" : ""
  const rightSpan = ratio === "40/60" ? "col-span-3" : ratio === "60/40" ? "col-span-2" : ""

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <div className={cn("grid flex-1 gap-0", ratioClasses[ratio])}>
        {/* Left Panel */}
        <div
          className={cn(
            "flex flex-col justify-center p-12",
            leftSpan,
            leftAccent && "border-r border-primary/10 bg-primary/5"
          )}
        >
          {leftTitle && (
            <h2
              className="mb-6 text-2xl font-bold tracking-tight text-foreground"
              style={headingFont}
            >
              {leftTitle}
            </h2>
          )}
          <div className="flex min-h-0 flex-1 flex-col justify-center">{children.left}</div>
        </div>

        {/* Right Panel */}
        <div
          className={cn(
            "flex flex-col justify-center p-12",
            rightSpan,
            rightAccent && "border-l border-primary/10 bg-primary/5"
          )}
        >
          {rightTitle && (
            <h2
              className="mb-6 text-2xl font-bold tracking-tight text-foreground"
              style={headingFont}
            >
              {rightTitle}
            </h2>
          )}
          <div className="flex min-h-0 flex-1 flex-col justify-center">{children.right}</div>
        </div>
      </div>

      {/* Footer */}
      {!hideFooter && (
        <div className="px-12 pb-6">
          <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />
        </div>
      )}
    </div>
  )
}
