import type { ComponentPropsWithoutRef } from "react"

import { Button } from "./ui/button"

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
    <Button
      {...props}
      type="button"
      size="icon"
      selected={selected}
      aria-label={label}
      aria-pressed={selected}
      title={title}
    >
      {children}
    </Button>
  )
}
