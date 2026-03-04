import { useTheme, SlideFooter } from "promptslide"

interface SlideLayoutDarkProps {
  children: React.ReactNode
  slideNumber: number
  totalSlides: number
  title?: string
  subtitle?: string
  eyebrow?: string
  hideFooter?: boolean
}

export function SlideLayoutDark({
  children,
  slideNumber,
  totalSlides,
  title,
  subtitle,
  eyebrow,
  hideFooter = false
}: SlideLayoutDarkProps) {
  const theme = useTheme()
  const headingFont = theme?.fonts?.heading
    ? { fontFamily: theme.fonts.heading }
    : undefined

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-foreground px-12 pt-10 pb-6 text-background">
      {/* Header */}
      {(title || eyebrow) && (
        <div className="mb-6 shrink-0">
          {eyebrow && (
            <div className="mb-2 text-xs font-bold tracking-[0.2em] uppercase" style={{ color: "oklch(0.7 0.2 250)" }}>
              {eyebrow}
            </div>
          )}
          {title && (
            <h2 className="text-4xl font-bold tracking-tight text-background" style={headingFont}>
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-2 max-w-4xl text-lg text-background/60">{subtitle}</p>}
        </div>
      )}

      {/* Content Area */}
      <div className="min-h-0 w-full flex-1 overflow-hidden pt-2">{children}</div>

      {/* Footer */}
      {!hideFooter && (
        <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} variant="light" />
      )}
    </div>
  )
}
