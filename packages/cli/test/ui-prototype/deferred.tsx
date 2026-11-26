import { lazy, Suspense, useState } from "react"

import { Action } from "./action"
const Controls = lazy(() => import("./viewer").then(m => ({ default: m.ViewerProbe })))
export function DeferredProbe() {
  const [open, setOpen] = useState(false)
  return (
    <div data-ps-probe>
      <Action selected />
      <button onClick={() => setOpen(true)}>Open application controls</button>
      {open && (
        <Suspense fallback={null}>
          <Controls />
        </Suspense>
      )}
    </div>
  )
}
