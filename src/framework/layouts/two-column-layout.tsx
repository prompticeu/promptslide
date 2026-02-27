import type { LayoutBaseProps } from "../types"
import { useTheme } from "../theme-context"
import { SlideFooter } from "./shared-footer"
import { cn } from "@/lib/utils"

const RATIO_CLASSES: Record<string, string> = {
  "1:1": "grid-cols-2",
  "2:1": "grid-cols-[2fr_1fr]",
  "1:2": "grid-cols-[1fr_2fr]",
  "3:2": "grid-cols-[3fr_2fr]",
  "2:3": "grid-cols-[2fr_3fr]",
}

interface TwoColumnLayoutProps extends LayoutBaseProps {
  eyebrow?: string
  title?: string
  subtitle?: string
  /** Content for the left column */
  left: React.ReactNode
  /** Content for the right column */
  right: React.ReactNode
  /** Column ratio. Default: "1:1" */
  ratio?: "1:1" | "2:1" | "1:2" | "3:2" | "2:3"
  /** Gap between columns. Default: "gap-8" */
  gap?: string
}

export function TwoColumnLayout({
  slideNumber,
  totalSlides,
  eyebrow,
  title,
  subtitle,
  left,
  right,
  ratio = "1:1",
  gap = "gap-8",
  hideFooter = false,
  className,
}: TwoColumnLayoutProps) {
  const theme = useTheme()
  const headingFont = theme?.fonts?.heading
    ? { fontFamily: theme.fonts.heading }
    : undefined

  return (
    <div className={cn("bg-background text-foreground relative flex h-full w-full flex-col overflow-hidden px-12 pt-10 pb-6", className)}>
      {(title || eyebrow) && (
        <div className="mb-6 shrink-0">
          {eyebrow && (
            <div className="text-primary mb-2 text-xs font-bold tracking-[0.2em] uppercase">
              {eyebrow}
            </div>
          )}
          {title && (
            <h2
              className="text-foreground text-4xl font-bold tracking-tight"
              style={headingFont}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-muted-foreground mt-2 max-w-4xl text-lg">
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div className={cn("grid min-h-0 flex-1", RATIO_CLASSES[ratio], gap)}>
        <div className="min-h-0 overflow-hidden">{left}</div>
        <div className="min-h-0 overflow-hidden">{right}</div>
      </div>

      {!hideFooter && (
        <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />
      )}
    </div>
  )
}
