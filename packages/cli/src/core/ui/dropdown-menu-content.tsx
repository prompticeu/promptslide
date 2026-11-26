import { Menu } from "@base-ui/react/menu"
import { Check } from "lucide-react"

import type { MenuContentProps, MenuOption } from "./dropdown-menu"

import { cn } from "../utils"
import { useApplication } from "./application-context"
function Label({ item }: { item: MenuOption }) {
  return (
    <>
      {item.icon}
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span aria-hidden className="text-xs text-neutral-500">
          {item.shortcut}
        </span>
      )}
    </>
  )
}
export default function DropdownMenuContent({
  items,
  value,
  onValueChange,
  align = "start",
  className,
  ...props
}: MenuContentProps) {
  const { portal } = useApplication()
  return (
    <Menu.Portal container={portal}>
      <Menu.Positioner align={align} sideOffset={6} style={{ zIndex: 150 }}>
        <Menu.Popup {...props} className={cn("ps-popup", className)}>
          {value !== undefined ? (
            <Menu.RadioGroup value={value} onValueChange={next => onValueChange?.(String(next))}>
              {items.map(item => (
                <Menu.RadioItem value={item.value!} key={item.value} className="ps-menu-item">
                  <Label item={item} />
                  <Menu.RadioItemIndicator className="ps-menu-indicator">
                    <Check size={14} />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          ) : (
            items.map(item => (
              <Menu.Item className="ps-menu-item" key={item.label} onClick={item.onClick}>
                <Label item={item} />
              </Menu.Item>
            ))
          )}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}
