import { useBranding } from "@promptslide/core"

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
  const branding = useBranding()

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
          {title && <h2 className="text-4xl font-bold tracking-tight text-foreground">{title}</h2>}
          {subtitle && <p className="mt-2 max-w-4xl text-lg text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      {/* Content Area */}
      <div className="min-h-0 w-full flex-1 overflow-hidden pt-2">{children}</div>

      {/* Footer */}
      {!hideFooter && (
        <div className="mt-4 flex shrink-0 items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-3 font-semibold tracking-tight text-foreground">
            {branding?.logoUrl && (
              <img src={branding.logoUrl} alt={`${branding.name} Logo`} className="h-8 w-auto" />
            )}
            {branding?.name && <span className="text-lg">{branding.name}</span>}
          </div>
          <div className="font-mono">
            {slideNumber} / {totalSlides}
          </div>
        </div>
      )}
    </div>
  )
}
