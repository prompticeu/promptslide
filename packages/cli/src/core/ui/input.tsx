import type { ComponentPropsWithRef } from "react"

import { Input as Primitive } from "@base-ui/react/input"

import { cn } from "../utils"
export function Input({ className, ...props }: Primitive.Props) {
  return <Primitive className={cn("ps-input", className)} {...props} />
}
export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea data-slot="textarea" className={cn("ps-textarea", className)} {...props} />
}
