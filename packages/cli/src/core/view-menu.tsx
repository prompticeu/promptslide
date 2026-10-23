import { ChevronDown, Grid3X3, List, Monitor } from "lucide-react"

import { Button } from "./ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "./ui/dropdown-menu"

export type ViewMode = "slide" | "list" | "grid"
const views = [
  { mode: "slide", label: "Presentation view", shortcut: "V", icon: Monitor },
  { mode: "list", label: "List view", shortcut: "L", icon: List },
  { mode: "grid", label: "Grid view", shortcut: "G", icon: Grid3X3 }
] as const
export function ViewMenu({
  value,
  onChange,
  disabled
}: {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  disabled: boolean
}) {
  const active = views.find(view => view.mode === value)!,
    Icon = active.icon
  return (
    <div role="group" aria-label="View selector" className="flex">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              disabled={disabled}
              aria-label="View options"
              title={`View options · ${active.label}`}
            />
          }
        >
          <Icon size={16} />
          <ChevronDown size={12} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          aria-label="View options"
          className="w-56"
          value={value}
          onValueChange={next => onChange(next as ViewMode)}
          items={views.map(({ mode, label, shortcut, icon: OptionIcon }) => ({
            value: mode,
            label,
            shortcut,
            icon: <OptionIcon size={16} />
          }))}
        />
      </DropdownMenu>
    </div>
  )
}
