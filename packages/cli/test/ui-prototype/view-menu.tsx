import { Menu } from "@base-ui/react/menu"
import { Check, ChevronDown, Grid3X3, List, Monitor } from "lucide-react"

import "./theme.css"
export type ViewMode = "slide" | "list" | "grid"
const views = [
  { mode: "slide", label: "Presentation view", icon: Monitor },
  { mode: "list", label: "List view", icon: List },
  { mode: "grid", label: "Grid view", icon: Grid3X3 }
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
  const Icon = views.find(v => v.mode === value)!.icon
  return (
    <Menu.Root>
      <Menu.Trigger
        onKeyDown={event => {
          if (event.key.length === 1 || ["ArrowLeft", "ArrowRight"].includes(event.key))
            event.stopPropagation()
        }}
        data-ps-probe
        className="ps-probe-button"
        aria-label="View options"
        disabled={disabled}
      >
        <Icon size={16} />
        <ChevronDown size={12} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={4}>
          <Menu.Popup
            onKeyDown={event => {
              if (event.key.length === 1 || ["ArrowLeft", "ArrowRight"].includes(event.key))
                event.stopPropagation()
            }}
            data-ps-probe
            className="ps-probe-popup"
            aria-label="View options"
          >
            <Menu.RadioGroup value={value} onValueChange={next => onChange(next as ViewMode)}>
              {views.map(({ mode, label, icon: OptionIcon }) => (
                <Menu.RadioItem key={mode} value={mode}>
                  <OptionIcon size={16} />
                  {label}
                  <Menu.RadioItemIndicator>
                    <Check size={14} />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
