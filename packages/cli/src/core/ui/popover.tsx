import { Popover as Primitive } from "@base-ui/react/popover"

import { cn } from "../utils"
import { useApplication } from "./application-context"

export const Popover = Primitive.Root
export const PopoverTitle = Primitive.Title
export function PopoverContent({
  anchor,
  className,
  ...props
}: Primitive.Popup.Props & Pick<Primitive.Positioner.Props, "anchor">) {
  const { portal } = useApplication()
  return (
    <Primitive.Portal container={portal}>
      <Primitive.Positioner
        anchor={anchor}
        positionMethod="fixed"
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        className="z-[201]"
      >
        <Primitive.Popup {...props} className={cn("ps-popup", className)} />
      </Primitive.Positioner>
    </Primitive.Portal>
  )
}
