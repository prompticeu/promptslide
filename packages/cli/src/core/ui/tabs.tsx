import { Tabs } from "@base-ui/react/tabs"

import { cn } from "../utils"
export const TabsRoot = Tabs.Root
export const TabsPanel = Tabs.Panel
export function TabsList({ className, ...props }: Tabs.List.Props) {
  return <Tabs.List {...props} className={cn("ps-tabs-list", className)} />
}
export function TabsTrigger({ className, ...props }: Tabs.Tab.Props) {
  return <Tabs.Tab {...props} className={cn("ps-tab", className)} />
}
