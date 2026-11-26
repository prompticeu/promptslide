import { Select as Primitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"
import { Children, isValidElement } from "react"

import { useApplication } from "./application-context"
/** Preserves the editor's existing source-draft value handlers. */
type Option = { value?: string; children?: React.ReactNode }
export function Select({
  children,
  value,
  onChange,
  className,
  disabled,
  ...props
}: {
  children: React.ReactNode
  value?: string
  onChange?: (event: { target: { value: string } }) => void
  className?: string
  disabled?: boolean
  "aria-label"?: string
  id?: string
  name?: string
}) {
  const { portal } = useApplication()
  const options = Children.toArray(children).filter(isValidElement<Option>)
  return (
    <Primitive.Root
      items={options.map(option => ({
        value: option.props.value ?? String(option.props.children ?? ""),
        label: option.props.children
      }))}
      value={value ?? ""}
      disabled={disabled}
      name={props.name}
      onValueChange={next => onChange?.({ target: { value: next ?? "" } })}
    >
      <Primitive.Trigger
        aria-label={props["aria-label"]}
        id={props.id}
        className={className ? `ps-select-trigger ${className}` : "ps-select-trigger"}
      >
        <Primitive.Value />
        <Primitive.Icon>
          <ChevronDown size={14} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal container={portal}>
        <Primitive.Positioner style={{ zIndex: 210 }} sideOffset={4} alignItemWithTrigger={false}>
          <Primitive.Popup className="ps-popup">
            <Primitive.List>
              {options.map((option, index) => (
                <Primitive.Item
                  key={option.props.value ?? index}
                  value={option.props.value ?? String(option.props.children ?? "")}
                  className="ps-select-item"
                >
                  <Primitive.ItemText>{option.props.children}</Primitive.ItemText>
                  <Primitive.ItemIndicator className="ps-menu-indicator">
                    <Check size={14} />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
            </Primitive.List>
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
