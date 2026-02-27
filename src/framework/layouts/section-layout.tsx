import type { LayoutBaseProps } from "../types"
import { useTheme } from "../theme-context"
import { SlideFooter } from "./shared-footer"
import { cn } from "@/lib/utils"

interface SectionLayoutProps extends LayoutBaseProps {
  /** Section number or label, e.g. "01" or "Part Two" */
  eyebrow?: string
  /** Section title */
  title: string
  /** Optional description */
  subtitle?: string
}

export function SectionLayout({
  children,
  slideNumber,
  totalSlides,
  eyebrow,
  title,
  subtitle,
  hideFooter = false,
  className,
}: SectionLayoutProps) {
  const theme = useTheme()
  const headingFont = theme?.fonts?.heading
    ? { fontFamily: theme.fonts.heading }
    : undefined

  return (
    <div className={cn("bg-background text-foreground relative flex h-full w-full flex-col overflow-hidden px-12 pb-6", className)}>
      <div className="flex flex-1 flex-col justify-center">
        {eyebrow && (
          <div className="text-primary mb-4 text-2xl font-bold tracking-[0.15em] uppercase">
            {eyebrow}
          </div>
        )}
        <h2
          className="text-foreground max-w-4xl text-6xl font-bold leading-tight tracking-tight"
          style={headingFont}
        >
          {title}
        </h2>
        <div className="bg-primary mt-6 h-1.5 w-24 rounded-full" />
        {subtitle && (
          <p className="text-muted-foreground mt-6 max-w-2xl text-xl">
            {subtitle}
          </p>
        )}
        {children && (
          <div className="mt-8">{children}</div>
        )}
      </div>

      {!hideFooter && (
        <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />
      )}
    </div>
  )
}
