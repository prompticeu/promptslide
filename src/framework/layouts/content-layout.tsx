import type { LayoutBaseProps } from "../types"
import { useTheme } from "../theme-context"
import { SlideFooter } from "./shared-footer"
import { cn } from "@/lib/utils"

interface ContentLayoutProps extends LayoutBaseProps {
  eyebrow?: string
  title?: string
  subtitle?: string
}

export function ContentLayout({
  children,
  slideNumber,
  totalSlides,
  eyebrow,
  title,
  subtitle,
  hideFooter = false,
  className,
}: ContentLayoutProps) {
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

      <div className="min-h-0 w-full flex-1 overflow-hidden pt-2">
        {children}
      </div>

      {!hideFooter && (
        <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />
      )}
    </div>
  )
}
