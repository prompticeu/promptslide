import type { LayoutBaseProps } from "../types"
import { useTheme } from "../theme-context"
import { SlideFooter } from "./shared-footer"
import { cn } from "../utils"

interface QuoteLayoutProps extends LayoutBaseProps {
  /** The quote text */
  quote: string
  /** Who said it */
  attribution?: string
  /** Role/title of the person */
  role?: string
}

export function QuoteLayout({
  children,
  slideNumber,
  totalSlides,
  quote,
  attribution,
  role,
  hideFooter = false,
  className,
}: QuoteLayoutProps) {
  const theme = useTheme()
  const bodyFont = theme?.fonts?.body
    ? { fontFamily: theme.fonts.body }
    : undefined

  return (
    <div className={cn("bg-background text-foreground relative flex h-full w-full flex-col overflow-hidden px-12 pt-10 pb-6", className)}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {/* Decorative quote mark */}
        <div className="text-primary/20 pointer-events-none select-none font-serif text-[120px] leading-none">
          &ldquo;
        </div>

        <blockquote
          className="text-foreground -mt-10 max-w-4xl text-3xl font-light italic leading-relaxed"
          style={bodyFont}
        >
          {quote}
        </blockquote>

        {(attribution || role) && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <div className="bg-primary/40 h-px w-16" />
            {attribution && (
              <div className="text-foreground mt-2 text-lg font-semibold">
                {attribution}
              </div>
            )}
            {role && (
              <div className="text-muted-foreground text-sm">
                {role}
              </div>
            )}
          </div>
        )}

        {children && (
          <div className="mt-6">{children}</div>
        )}
      </div>

      {!hideFooter && (
        <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />
      )}
    </div>
  )
}
