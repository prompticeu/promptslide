import type { LayoutBaseProps } from "../types"
import { useTheme } from "../theme-context"
import { SlideFooter } from "./shared-footer"
import { cn } from "@/lib/utils"

interface TitleLayoutProps extends LayoutBaseProps {
  /** Main title */
  title: string
  /** Optional subtitle */
  subtitle?: string
  /** Background image URL (overrides theme default) */
  backgroundImage?: string
  /** Dark background with light text */
  dark?: boolean
}

export function TitleLayout({
  children,
  slideNumber,
  totalSlides,
  title,
  subtitle,
  backgroundImage,
  dark = false,
  hideFooter = false,
  className,
}: TitleLayoutProps) {
  const theme = useTheme()
  const headingFont = theme?.fonts?.heading
    ? { fontFamily: theme.fonts.heading }
    : undefined

  const bgImage = backgroundImage ?? theme?.assets?.backgroundImage
  const logoUrl = theme?.logo?.icon ?? theme?.logo?.full

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden",
        dark ? "bg-primary text-white" : "bg-background text-foreground",
        className
      )}
    >
      {/* Background layer */}
      {bgImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImage})` }}
        >
          <div className={cn(
            "absolute inset-0",
            dark ? "bg-black/50" : "bg-background/80"
          )} />
        </div>
      ) : !dark && (
        <>
          <div className="from-primary/20 via-background to-background absolute inset-0 bg-gradient-to-br" />
          <div className="bg-primary/10 absolute top-[-20%] right-[-10%] h-[60%] w-[40%] rounded-full blur-3xl" />
          <div className="bg-primary/5 absolute bottom-[-10%] left-[-5%] h-[40%] w-[30%] rounded-full blur-2xl" />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-12 text-center">
        {logoUrl && (
          <img
            src={dark ? (theme?.logo?.iconLight ?? theme?.logo?.fullLight ?? logoUrl) : logoUrl}
            alt={`${theme?.name} Logo`}
            className="mb-8 h-16 w-auto"
          />
        )}
        <h1
          className={cn(
            "max-w-4xl text-7xl font-bold tracking-tight",
            dark ? "text-white" : "text-foreground"
          )}
          style={headingFont}
        >
          {title}
        </h1>
        {subtitle && (
          <p className={cn(
            "mt-6 max-w-2xl text-xl",
            dark ? "text-white/70" : "text-muted-foreground"
          )}>
            {subtitle}
          </p>
        )}
        {children && (
          <div className="mt-8">{children}</div>
        )}
      </div>

      {/* Footer */}
      {!hideFooter && (
        <div className="relative z-10 px-12 pb-6">
          <SlideFooter
            slideNumber={slideNumber}
            totalSlides={totalSlides}
            variant={dark ? "light" : "default"}
          />
        </div>
      )}
    </div>
  )
}
