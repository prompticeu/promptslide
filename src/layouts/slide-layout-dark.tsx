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
    <div className="relative flex h-full w-full flex-col overflow-hidden px-14 pt-12 pb-6" style={{ background: "oklch(0.08 0 0)", color: "oklch(0.95 0 0)" }}>
      {/* Header */}
      {(title || eyebrow) && (
        <div className="mb-8 shrink-0">
          {eyebrow && (
            <div className="mb-3 text-xs font-semibold tracking-[0.25em] text-primary uppercase">
              {eyebrow}
            </div>
          )}
          {title && (
            <h2 className="text-5xl font-bold tracking-tight" style={{ ...headingFont, color: "oklch(0.97 0 0)" }}>
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-3 max-w-4xl text-lg" style={{ color: "oklch(0.6 0 0)" }}>{subtitle}</p>}
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
