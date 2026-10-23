import { Tooltip as Primitive } from "@base-ui/react/tooltip"

import { useApplication } from "./application-context"
export default function TooltipContent({ label }: { label: string }) {
  const { portal } = useApplication()
  return (
    <Primitive.Portal container={portal}>
      <Primitive.Positioner sideOffset={6} style={{ zIndex: 150 }}>
        <Primitive.Popup role="tooltip" className="ps-popup ps-tooltip">
          {label}
        </Primitive.Popup>
      </Primitive.Positioner>
    </Primitive.Portal>
  )
}
