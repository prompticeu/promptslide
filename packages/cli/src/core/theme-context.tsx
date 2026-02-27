import { createContext, useContext, useMemo } from "react"
import type { ThemeConfig } from "./types"

const ThemeContext = createContext<ThemeConfig | null>(null)

/**
 * Access the full theme config. Returns null outside SlideThemeProvider.
 */
export function useTheme(): ThemeConfig | null {
  return useContext(ThemeContext)
}

function buildCssOverrides(theme: ThemeConfig): React.CSSProperties {
  const style: Record<string, string> = {}

  if (theme.colors?.primary) style["--primary"] = theme.colors.primary
  if (theme.colors?.primaryForeground) style["--primary-foreground"] = theme.colors.primaryForeground
  if (theme.colors?.secondary) style["--secondary"] = theme.colors.secondary
  if (theme.colors?.secondaryForeground) style["--secondary-foreground"] = theme.colors.secondaryForeground
  if (theme.colors?.accent) style["--accent"] = theme.colors.accent
  if (theme.colors?.accentForeground) style["--accent-foreground"] = theme.colors.accentForeground

  if (theme.fonts?.heading) style["--font-heading"] = theme.fonts.heading
  if (theme.fonts?.body) style["--font-body"] = theme.fonts.body

  return style as React.CSSProperties
}

interface SlideThemeProviderProps {
  theme: ThemeConfig
  children: React.ReactNode
}

/**
 * Provides the full theme to all descendants.
 * Injects CSS variable overrides via inline style.
 */
export function SlideThemeProvider({ theme, children }: SlideThemeProviderProps) {
  const cssOverrides = useMemo(() => buildCssOverrides(theme), [theme])

  return (
    <ThemeContext.Provider value={theme}>
      <div style={cssOverrides} className="contents">
        {children}
      </div>
    </ThemeContext.Provider>
  )
}
