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
