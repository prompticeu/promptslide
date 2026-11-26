import type { ReactNode } from "react"

import { Menu } from "@base-ui/react/menu"
import { createContext, lazy, Suspense, useContext, useEffect, useState } from "react"

export type MenuOption = {
  label: string
  value?: string
  icon?: ReactNode
  shortcut?: string
  onClick?: () => void
}
export type MenuContentProps = {
  items: MenuOption[]
  value?: string
  onValueChange?: (value: string) => void
  align?: "start" | "center" | "end"
  className?: string
  "aria-label"?: string
}
const OpenContext = createContext(false)
const preloadMenu = () => import("./dropdown-menu-content")
const Content = lazy(preloadMenu)
export function DropdownMenu({
  open: controlledOpen,
  defaultOpen = false,
  modal = false,
  onOpenChange,
  children,
  ...props
}: Menu.Root.Props) {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? localOpen
  useEffect(() => {
    const close = () => setLocalOpen(false)
    document.addEventListener("fullscreenchange", close)
    return () => document.removeEventListener("fullscreenchange", close)
  }, [])
  return (
    <OpenContext.Provider value={open}>
      <Menu.Root
        {...props}
        modal={modal}
        open={open}
        onOpenChange={(next, details) => {
          setLocalOpen(next)
          onOpenChange?.(next, details)
        }}
      >
        {children}
      </Menu.Root>
    </OpenContext.Provider>
  )
}
export function DropdownMenuTrigger({ onPointerEnter, onFocus, ...props }: Menu.Trigger.Props) {
  return (
    <Menu.Trigger
      {...props}
      onPointerEnter={event => {
        void preloadMenu()
        onPointerEnter?.(event)
      }}
      onFocus={event => {
        void preloadMenu()
        onFocus?.(event)
      }}
    />
  )
}
/** Keep the trigger mounted while the positioned popup loads on first intent. */
export function DropdownMenuContent(props: MenuContentProps) {
  const open = useContext(OpenContext)
  return open ? (
    <Suspense
      fallback={
        <span role="status" className="sr-only">
          Loading menu…
        </span>
      }
    >
      <Content {...props} />
    </Suspense>
  ) : null
}
