// Production-only cost probe. Every primitive is rendered so Rollup measures
// actual component imports, including popup content, rather than package size.
import { Button } from "@base-ui/react/button"
import { Checkbox } from "@base-ui/react/checkbox"
import { Menu } from "@base-ui/react/menu"
import { Popover } from "@base-ui/react/popover"
import { Tooltip } from "@base-ui/react/tooltip"
import { cva } from "class-variance-authority"
import { Check } from "lucide-react"

import "./theme.css"

const button = cva("ps-probe-button", {
  variants: {
    variant: { ghost: "ps-probe-ghost", selected: "ps-probe-selected" },
    size: { icon: "ps-probe-icon", default: "ps-probe-default" }
  },
  defaultVariants: { variant: "ghost", size: "default" }
})

export function Action({ selected = false }: { selected?: boolean }) {
  return (
    <Button
      className={button({ variant: selected ? "selected" : "ghost", size: "icon" })}
      aria-label="Edit slide"
      aria-pressed={selected}
    >
      ✎
    </Button>
  )
}
export function ViewerProbe() {
  return (
    <div data-ps-probe>
      <Action selected />
      <Checkbox.Root
        aria-label="Include slide in loop"
        defaultChecked
        className="ps-probe-checkbox"
      >
        <Checkbox.Indicator>
          <Check size={14} />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <Menu.Root>
        <Menu.Trigger className={button()}>View options</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-ps-probe className="ps-probe-popup">
              <Menu.RadioGroup defaultValue="slide">
                <Menu.RadioItem value="slide">
                  Presentation view
                  <Menu.RadioItemIndicator>
                    <Check size={14} />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
                <Menu.RadioItem value="list">List view</Menu.RadioItem>
                <Menu.RadioItem value="grid">Grid view</Menu.RadioItem>
              </Menu.RadioGroup>
              <Menu.Separator />
              <Menu.Item>Auto-loop</Menu.Item>
              <Menu.Item>Configure loop…</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger className={button()}>Comment</Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-ps-probe className="ps-probe-popup">
                Comment (C)
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <Popover.Root>
        <Popover.Trigger className={button()}>Annotation</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-ps-probe className="ps-probe-popup">
              <Popover.Title>New comment</Popover.Title>
              <Popover.Description>Add a comment to this slide</Popover.Description>
              <textarea aria-label="Comment" />
              <Popover.Close>Close</Popover.Close>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
