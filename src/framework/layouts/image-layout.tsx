import type { LayoutBaseProps } from "../types"
import { SlideFooter } from "./shared-footer"
import { cn } from "@/lib/utils"

interface ImageLayoutProps extends LayoutBaseProps {
  /** Image source URL */
  src: string
  /** Alt text */
  alt?: string
  /** Layout mode. Default: "side" */
  mode?: "side" | "overlay" | "full"
  /** Which side the image appears on (mode="side" only). Default: "right" */
  imageSide?: "left" | "right"
}

export function ImageLayout({
  children,
  slideNumber,
  totalSlides,
  src,
  alt = "",
  mode = "side",
  imageSide = "right",
  hideFooter = false,
  className,
}: ImageLayoutProps) {
  if (mode === "overlay") {
    return (
      <div className={cn("relative flex h-full w-full flex-col overflow-hidden", className)}>
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
        <div className="relative z-10 flex flex-1 flex-col justify-center px-12 pt-10 pb-6">
          <div className="max-w-[50%] text-white">
            {children}
          </div>
        </div>
        {!hideFooter && (
          <div className="relative z-10 px-12 pb-6">
            <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} variant="light" />
          </div>
        )}
      </div>
    )
  }

  if (mode === "full") {
    return (
      <div className={cn("relative flex h-full w-full flex-col overflow-hidden", className)}>
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
        {children && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/60 to-transparent px-12 pt-16 pb-16 text-white">
            {children}
          </div>
        )}
        {!hideFooter && (
          <div className="relative z-10 mt-auto px-12 pb-6">
            <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} variant="light" />
          </div>
        )}
      </div>
    )
  }

  // mode === "side"
  const imageEl = (
    <div className="h-full overflow-hidden">
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  )
  const contentEl = (
    <div className="flex flex-col justify-center px-8">
      {children}
    </div>
  )

  return (
    <div className={cn("bg-background text-foreground relative flex h-full w-full flex-col overflow-hidden", className)}>
      <div className="grid min-h-0 flex-1 grid-cols-2">
        {imageSide === "left" ? <>{imageEl}{contentEl}</> : <>{contentEl}{imageEl}</>}
      </div>
      {!hideFooter && (
        <div className="px-12 pb-6">
          <SlideFooter slideNumber={slideNumber} totalSlides={totalSlides} />
        </div>
      )}
    </div>
  )
}
