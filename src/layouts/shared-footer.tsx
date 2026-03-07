import { useTheme } from "promptslide"

interface SlideFooterProps {
  slideNumber: number
  totalSlides: number
  /** Use light text/logo for dark slide backgrounds */
  variant?: "default" | "light"
}

export function SlideFooter({ slideNumber, totalSlides, variant = "default" }: SlideFooterProps) {
  const theme = useTheme()
  if (!theme) return null

  const logoUrl = variant === "light"
    ? (theme.logo?.fullLight ?? theme.logo?.full)
    : theme.logo?.full

  const textClass = variant === "light"
    ? "text-white/70"
    : "text-muted-foreground"

  const nameClass = variant === "light"
    ? "text-white font-semibold"
    : "text-foreground font-semibold"

  return (
    <div className={`mt-4 flex shrink-0 items-center justify-between text-sm ${textClass}`}>
      <div className={`flex items-center gap-3 tracking-tight ${nameClass}`}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt={`${theme.name} Logo`}
            className="h-8 w-auto"
          />
        )}
        <span className="text-lg">{theme.name}</span>
      </div>
      <div className="font-mono">
        {slideNumber} / {totalSlides}
      </div>
    </div>
  )
}
