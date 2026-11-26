import type { ComponentPropsWithoutRef } from "react"

import { Button } from "@base-ui/react/button"
import { Tooltip } from "@base-ui/react/tooltip"
import { cva } from "class-variance-authority"

import "./theme.css"

const variants = cva("ps-probe-button ps-probe-icon", {
  variants: { selected: { true: "ps-probe-selected" } }
})
type Props = Omit<
  ComponentPropsWithoutRef<"button">,
  "aria-label" | "aria-pressed" | "className"
> & { label: string; selected?: boolean }
export function ToolbarAction({ label, selected, title = label, children, ...props }: Props) {
  return (
    <Tooltip.Provider delay={300}>
      <Tooltip.Root>
        <Tooltip.Trigger
          onKeyDown={event => {
            if (event.key.length === 1 || ["ArrowLeft", "ArrowRight"].includes(event.key))
              event.stopPropagation()
          }}
          render={
            <Button
              {...props}
              data-ps-probe
              aria-label={label}
              aria-pressed={selected}
              className={variants({ selected })}
            />
          }
        >
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={4}>
            <Tooltip.Popup data-ps-probe className="ps-probe-popup">
              {title}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
