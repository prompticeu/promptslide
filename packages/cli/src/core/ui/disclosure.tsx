import { Collapsible } from "@base-ui/react/collapsible"

import { cn } from "../utils"
export function Disclosure({
  open,
  className,
  ...props
}: Omit<Collapsible.Root.Props, "open"> & { open?: boolean }) {
  return (
    <Collapsible.Root {...props} defaultOpen={open} className={cn("ps-disclosure", className)} />
  )
}
export function DisclosureTrigger({ className, ...props }: Collapsible.Trigger.Props) {
  return <Collapsible.Trigger {...props} className={cn("ps-disclosure-trigger", className)} />
}
export const DisclosureContent = Collapsible.Panel
