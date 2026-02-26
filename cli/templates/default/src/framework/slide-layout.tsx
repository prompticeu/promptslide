import { createContext, useContext } from "react"

// =============================================================================
// BRANDING CONTEXT
// =============================================================================

export interface SlideBranding {
  name: string
  logoUrl?: string
}

const BrandingContext = createContext<SlideBranding | null>(null)

export function SlideBrandingProvider({
  branding,
  children
}: {
  branding: SlideBranding
  children: React.ReactNode
}) {
  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}

// =============================================================================
// SLIDE LAYOUT
// =============================================================================

interface SlideLayoutProps {
  children: React.ReactNode
  slideNumber: number
  totalSlides: number
  title?: string
  subtitle?: string
  eyebrow?: string
  hideFooter?: boolean
}

export function SlideLayout({
  children,
  slideNumber,
  totalSlides,
  title,
  subtitle,
  eyebrow,
  hideFooter = false
}: SlideLayoutProps) {
  const branding = useBranding()

  return (
    <div className="bg-background text-foreground relative flex h-full w-full flex-col overflow-hidden px-12 pt-10 pb-6">
      {/* Header */}
      {(title || eyebrow) && (
        <div className="mb-6 shrink-0">
          {eyebrow && (
            <div className="text-primary mb-2 text-xs font-bold tracking-[0.2em] uppercase">
              {eyebrow}
            </div>
          )}
          {title && (
            <h2 className="text-foreground text-4xl font-bold tracking-tight">
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

      {/* Content Area */}
      <div className="min-h-0 w-full flex-1 overflow-hidden pt-2">
        {children}
      </div>

      {/* Footer */}
      {!hideFooter && (
        <div className="text-muted-foreground mt-4 flex shrink-0 items-center justify-between text-sm">
          <div className="text-foreground flex items-center gap-3 font-semibold tracking-tight">
            {branding?.logoUrl && (
              <img
                src={branding.logoUrl}
                alt={`${branding.name} Logo`}
                className="h-8 w-auto"
              />
            )}
            {branding?.name && (
              <span className="text-lg">{branding.name}</span>
            )}
          </div>
          <div className="font-mono">
            {slideNumber} / {totalSlides}
          </div>
        </div>
      )}
    </div>
  )
}
