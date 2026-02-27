import { useTheme, SlideFooter } from "promptslide"

// =============================================================================
// SLIDE LAYOUT — CENTERED
// =============================================================================

interface SlideLayoutCenteredProps {
  children: React.ReactNode
  slideNumber: number
  totalSlides: number
  title?: string
  subtitle?: string
  eyebrow?: string
  hideFooter?: boolean
}

export function SlideLayoutCentered({
  children,
  slideNumber,
  totalSlides,
  title,
  subtitle,
  eyebrow,
  hideFooter = false
}: SlideLayoutCenteredProps) {
  const theme = useTheme()
  const headingFont = theme?.fonts?.heading
    ? { fontFamily: theme.fonts.heading }
    : undefined

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background px-12 pt-10 pb-6 text-foreground">
      {/* Header */}
      {(title || eyebrow) && (
        <div className="mb-6 shrink-0">
          {eyebrow && (
            <div className="mb-2 text-xs font-bold tracking-[0.2em] text-primary uppercase">
              {eyebrow}
            </div>
          )}
          {title && (
            <h2 className="text-4xl font-bold tracking-tight text-foreground" style={headingFont}>
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-2 max-w-4xl text-lg text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {/* Content Area */}
      <div className="min-h-0 w-full flex-1 overflow-hidden pt-2">{children}</div>

      {/* Footer */}
      {!hideFooter && (
        <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />
      )}
    </div>
  )
}
