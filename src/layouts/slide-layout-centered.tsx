import { useTheme, SlideFooter } from "promptslide"

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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background px-14 pt-12 pb-6 text-foreground">
      {/* Header */}
      {(title || eyebrow) && (
        <div className="mb-8 shrink-0">
          {eyebrow && (
            <div className="mb-3 text-xs font-semibold tracking-[0.25em] text-primary uppercase">
              {eyebrow}
            </div>
          )}
          {title && (
            <h2 className="text-5xl font-bold tracking-tight text-foreground" style={headingFont}>
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-3 max-w-4xl text-lg text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {/* Content Area */}
      <div className="min-h-0 w-full flex-1 overflow-hidden">{children}</div>

      {/* Footer */}
      {!hideFooter && (
        <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} variant="light" />
      )}
    </div>
  )
}
