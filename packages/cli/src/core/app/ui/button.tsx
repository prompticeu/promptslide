import type { ButtonHTMLAttributes } from "react"

import { cn } from "../../utils"

const variantStyles = {
  default:
    "bg-[oklch(0.661_0.201_41.38)] text-white hover:bg-[oklch(0.6_0.18_41.38)]",
  outline:
    "border border-neutral-700 bg-transparent hover:bg-neutral-800 text-neutral-200",
  secondary: "bg-neutral-800 text-neutral-200 hover:bg-neutral-700",
  ghost: "bg-transparent hover:bg-neutral-800/50 text-neutral-300",
  destructive: "bg-red-500/10 text-red-400 hover:bg-red-500/20",
} as const

const sizeStyles = {
  default: "h-8 px-3 text-sm gap-1.5",
  sm: "h-7 px-2.5 text-xs gap-1",
  lg: "h-9 px-4 text-sm gap-2",
  icon: "size-8",
  "icon-sm": "size-7",
} as const

type ButtonVariant = keyof typeof variantStyles
type ButtonSize = keyof typeof sizeStyles

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 select-none shrink-0",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    />
  )
}
