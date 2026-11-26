import { Dialog as Primitive } from "@base-ui/react/dialog"

import { cn } from "../utils"
import { useApplication } from "./application-context"
export const Dialog = Primitive.Root
export const DialogTitle = Primitive.Title
export const DialogDescription = Primitive.Description
export function DialogContent({ className, ...props }: Primitive.Popup.Props) {
  const { portal } = useApplication()
  return (
    <Primitive.Portal container={portal}>
      <Primitive.Backdrop className="ps-dialog-backdrop" />
      <Primitive.Popup {...props} className={cn("ps-dialog", className)} />
    </Primitive.Portal>
  )
}
