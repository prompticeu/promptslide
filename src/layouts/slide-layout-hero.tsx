import { useTheme, SlideFooter } from "promptslide"

interface SlideLayoutHeroProps {
  children?: React.ReactNode
  slideNumber: number
  totalSlides: number
  eyebrow?: string
  title: string
  subtitle?: string
  hideFooter?: boolean
}

export function SlideLayoutHero({
  children,
  slideNumber,
  totalSlides,
  eyebrow,
  title,
  subtitle,
  hideFooter = false
}: SlideLayoutHeroProps) {
  const theme = useTheme()
  const headingFont = theme?.fonts?.heading ? { fontFamily: theme.fonts.heading } : undefined

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
      <div className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute right-10 bottom-1/4 h-64 w-64 rounded-full bg-primary/5 blur-2xl" />

      {/* Content: pushed to bottom-left */}
      <div className="relative z-10 flex flex-1 flex-col justify-end px-16 pb-20">
        {eyebrow && (
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </div>
        )}
        <h1
          className="max-w-4xl text-6xl font-bold leading-tight tracking-tight text-foreground"
          style={headingFont}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-xl font-light text-muted-foreground">{subtitle}</p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>

      {/* Footer */}
      {!hideFooter && (
        <div className="relative z-10 px-12 pb-6">
          <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />
        </div>
      )}
    </div>
  )
}
