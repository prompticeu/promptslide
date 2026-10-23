import { Slider as Primitive } from "@base-ui/react/slider"
export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <Primitive.Root
      value={value}
      min={min}
      max={max}
      step={step}
      onValueChange={next => onChange(Array.isArray(next) ? next[0]! : next)}
    >
      <Primitive.Control className="ps-range-control">
        <Primitive.Track className="ps-range-track">
          <Primitive.Indicator className="ps-range-indicator" />
          <Primitive.Thumb aria-label={label} className="ps-range-thumb" />
        </Primitive.Track>
      </Primitive.Control>
    </Primitive.Root>
  )
}
