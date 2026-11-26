import type { ChangeEvent, InputHTMLAttributes } from "react"

import { Checkbox } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"

import "./theme.css"
// Compatibility adapter is only for the cost probe; the migration would use
// Base UI's checked-change API directly at application call sites.
export function LoopCheckbox({
  onChange,
  checked,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Checkbox.Root
      onKeyDown={event => {
        if (event.key.length === 1 || ["ArrowLeft", "ArrowRight"].includes(event.key))
          event.stopPropagation()
      }}
      data-ps-probe
      aria-label={props["aria-label"]}
      checked={!!checked}
      onCheckedChange={next =>
        onChange?.({ target: { checked: next } } as ChangeEvent<HTMLInputElement>)
      }
      className="ps-probe-checkbox"
    >
      <Checkbox.Indicator>
        <Check size={14} strokeWidth={3} />
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}
