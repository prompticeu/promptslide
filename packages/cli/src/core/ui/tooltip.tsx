import { Tooltip as Primitive } from "@base-ui/react/tooltip"
import { lazy, Suspense, useState, type ReactElement } from "react"
const preloadTooltip = () => import("./tooltip-content")
const Content = lazy(preloadTooltip)
export function Tooltip({ label, children }: { label: string; children: ReactElement }) {
  const [open, setOpen] = useState(false)
  return (
    <Primitive.Provider delay={350}>
      <Primitive.Root open={open} onOpenChange={setOpen}>
        <Primitive.Trigger
          render={children}
          onPointerEnter={() => {
            void preloadTooltip()
          }}
          onFocus={() => {
            void preloadTooltip()
          }}
        />
        {open && (
          <Suspense fallback={null}>
            <Content label={label} />
          </Suspense>
        )}
      </Primitive.Root>
    </Primitive.Provider>
  )
}
