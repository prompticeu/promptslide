import { Checkbox as Primitive } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"

import { cn } from "../utils"
export function Checkbox({ className, ...props }: Primitive.Root.Props) {
  return (
    <Primitive.Root {...props} className={cn("ps-checkbox", className)}>
      <Primitive.Indicator>
        <Check size={14} strokeWidth={3} />
      </Primitive.Indicator>
    </Primitive.Root>
  )
}
