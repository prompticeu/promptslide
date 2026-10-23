import { Check, ChevronDown, Grid3X3, List, Monitor } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"

import { cn } from "./utils"

export type ViewMode = "slide" | "list" | "grid"

const views = [
  { mode: "slide", label: "Presentation view", shortcut: "V", icon: Monitor },
  { mode: "list", label: "List view", shortcut: "L", icon: List },
  { mode: "grid", label: "Grid view", shortcut: "G", icon: Grid3X3 }
] as const

export function ViewMenu({
  value,
  onChange,
  disabled
}: {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const active = views.find(view => view.mode === value)!
  const Icon = active.icon

  useLayoutEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
  }, [open])
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  return (
    <div
      role="group"
      aria-label="View selector"
      ref={root}
      className="relative flex"
      onBlur={event => {
        const next = event.relatedTarget
        if (next && !event.currentTarget.contains(next)) setOpen(false)
      }}
      onKeyDown={event => {
        // Toolbar navigation must not trigger slide advancement or deck shortcuts.
        event.stopPropagation()
        if (event.key === "Escape") {
          setOpen(false)
          trigger.current?.focus()
        } else if (open && event.key === "Tab") {
          trigger.current?.focus()
          setOpen(false)
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault()
          if (!open) {
            setOpen(true)
            return
          }
          const items = Array.from(
            root.current!.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
          )
          const index = items.indexOf(document.activeElement as HTMLButtonElement)
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? items.length - 1
                : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
          items[next]?.focus()
        }
      }}
    >
      <button
        ref={trigger}
        disabled={disabled}
        aria-label="View options"
        title={`View options · ${active.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-neutral-800 px-2 text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-orange-500"
        onClick={() => setOpen(previous => !previous)}
      >
        <Icon size={16} />
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label="View options"
          className="absolute left-0 top-10 w-56 rounded-lg border border-neutral-700 bg-neutral-950 p-1 text-sm text-white"
        >
          {views.map(({ mode, label, shortcut, icon: OptionIcon }) => (
            <button
              key={mode}
              role="menuitemradio"
              aria-checked={mode === value}
              tabIndex={-1}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-neutral-300 hover:bg-neutral-800 focus:bg-neutral-800 focus:outline-none",
                mode === value && "text-white"
              )}
              onClick={() => {
                onChange(mode)
                setOpen(false)
                trigger.current?.focus()
              }}
            >
              <OptionIcon size={16} />
              <span className="flex-1">{label}</span>
              <span aria-hidden="true" className="text-xs text-neutral-500">
                {shortcut}
              </span>
              <Check size={14} className={mode === value ? "text-orange-400" : "invisible"} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
