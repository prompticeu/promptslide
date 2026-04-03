import type { HTMLAttributes } from "react"

import { cn } from "../../utils"

const variantStyles = {
  default: "bg-[oklch(0.661_0.201_41.38)] text-white",
  secondary: "bg-neutral-800 text-neutral-300",
  outline: "border border-neutral-700 text-neutral-300",
  ghost: "bg-neutral-800/50 text-neutral-400",
} as const

type BadgeVariant = keyof typeof variantStyles

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({
  className,
  variant = "secondary",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
}
