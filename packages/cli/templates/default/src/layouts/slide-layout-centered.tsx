import { useTheme, SlideFooter } from "@promptslide/core";

// =============================================================================
// SLIDE LAYOUT — CENTERED
// =============================================================================

interface SlideLayoutCenteredProps {
  children: React.ReactNode;
  slideNumber: number;
  totalSlides: number;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  hideFooter?: boolean;
}

export function SlideLayoutCentered({
  children,
  slideNumber,
  totalSlides,
  title,
  subtitle,
  eyebrow,
  hideFooter = false,
}: SlideLayoutCenteredProps) {
  const theme = useTheme();
  const headingFont = theme?.fonts?.heading
    ? { fontFamily: theme.fonts.heading }
    : undefined;

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
            <h2 className="text-foreground text-4xl font-bold tracking-tight" style={headingFont}>
              {title}
            </h2>
          )}
          {subtitle && <p className="text-muted-foreground mt-2 max-w-4xl text-lg">{subtitle}</p>}
        </div>
      )}

      {/* Content Area */}
      <div className="min-h-0 w-full flex-1 overflow-hidden pt-2">{children}</div>

      {/* Footer */}
      {!hideFooter && (
        <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />
      )}
    </div>
  );
}
