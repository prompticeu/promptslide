import type { ComponentPropsWithoutRef } from "react"

import { cn } from "./utils"

type ToolbarActionProps = Omit<
  ComponentPropsWithoutRef<"button">,
  "aria-label" | "aria-pressed" | "className"
> & {
  label: string
  selected?: boolean
}

/** Shared icon action for both the viewer toolbar and the editor's toolbar portal. */
export function ToolbarAction({
  label,
  selected,
  title = label,
  children,
  ...props
}: ToolbarActionProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={title}
      className={cn(
        "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B35] disabled:cursor-default disabled:opacity-35 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
        selected
          ? "border-[#FF6B35]/50 bg-[#FF6B35]/15 text-[#FF6B35] enabled:hover:border-[#FF6B35] enabled:hover:bg-[#FF6B35]/25"
          : "text-neutral-400 enabled:hover:bg-neutral-800 enabled:hover:text-white"
      )}
    >
      {children}
    </button>
  )
}
