import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../utils"
import { Tooltip } from "./tooltip"

const buttonVariants = cva("ps-button", {
  variants: {
    variant: {
      ghost: "ps-button-ghost",
      outline: "ps-button-outline",
      primary: "ps-button-primary",
      destructive: "ps-button-danger",
      unstyled: "ps-button-canvas"
    },
    size: { default: "", icon: "ps-button-icon" }
  },
  defaultVariants: { variant: "ghost", size: "default" }
})
export function Button({
  className,
  variant,
  size,
  selected,
  title,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { selected?: boolean }) {
  const button = (
    <ButtonPrimitive
      {...props}
      title={title}
      data-slot="button"
      data-selected={selected}
      className={cn(
        variant === "unstyled" ? "ps-button-canvas" : buttonVariants({ variant, size }),
        className
      )}
    />
  )
  return title ? <Tooltip label={title}>{button}</Tooltip> : button
}
