import type { ReactNode } from "react"

import { X } from "lucide-react"
import { useId } from "react"

import { cn } from "./utils"

export type InspectorMode = "slide" | "editor" | "comments"

/** Core-owned docking and navigation; development tools portal into the editor slot. */
export function Inspector({
  mode,
  visible,
  editorAvailable,
  width,
  overlay,
  onSelect,
  onClose,
  slideSettings,
  comments
}: {
  mode: InspectorMode | null
  visible: boolean
  editorAvailable: boolean
  width: number
  overlay: boolean
  onSelect: (mode: InspectorMode) => void
  onClose: () => void
  slideSettings: ReactNode
  comments: ReactNode
}) {
  const prefix = useId()
  const tabs: { id: InspectorMode; label: string }[] = [
    { id: "slide", label: "Slide" },
    ...(editorAvailable ? [{ id: "editor" as const, label: "Elements" }] : []),
    { id: "comments", label: "Comments" }
  ]
  const closeLabel =
    mode === "editor"
      ? "Done editing"
      : mode === "comments"
        ? "Hide comments"
        : "Close slide settings"
  return (
    <aside
      data-ps-inspector
      aria-label="Inspector"
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        "h-full shrink-0 overflow-hidden bg-neutral-950 text-white transition-[width,transform] duration-200 ease-out motion-reduce:transition-none print:hidden",
        overlay && "fixed inset-y-0 right-0 z-[60]",
        overlay && !visible && "translate-x-full"
      )}
      style={{ width: visible ? width : 0, maxWidth: overlay ? "90vw" : undefined }}
      onKeyDown={event => {
        // Native button activation must not also advance the presentation.
        if (
          (event.key === " " || event.key === "Enter") &&
          (event.target as HTMLElement).closest("button")
        )
          event.stopPropagation()
      }}
    >
      <div className="flex h-full min-h-0 w-full flex-col border-l border-neutral-800">
        <div
          data-ps-inspector-header
          className="flex shrink-0 items-center gap-1 border-b border-neutral-800 px-2 py-2"
        >
          <div
            role="tablist"
            aria-label="Inspector sections"
            className="flex min-w-0 flex-1 gap-1"
            onKeyDown={event => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
              event.preventDefault()
              event.stopPropagation()
              const buttons = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>("button")
              )
              const index = buttons.indexOf(event.target as HTMLButtonElement)
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) %
                      buttons.length
              buttons[next]?.focus()
            }}
          >
            {tabs.map(tab => (
              <button
                key={tab.id}
                id={`${prefix}-tab-${tab.id}`}
                role="tab"
                aria-selected={mode === tab.id}
                aria-controls={`${prefix}-panel-${tab.id}`}
                tabIndex={mode === tab.id ? 0 : -1}
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-orange-500",
                  mode === tab.id ? "bg-neutral-800 text-white" : "text-neutral-400"
                )}
                onClick={() => onSelect(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className="shrink-0 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-orange-500"
          >
            <X size={16} />
          </button>
        </div>
        <div
          id={`${prefix}-panel-slide`}
          role="tabpanel"
          aria-labelledby={`${prefix}-tab-slide`}
          hidden={mode !== "slide"}
          className="min-h-0 flex-1"
        >
          {slideSettings}
        </div>
        <div
          id={`${prefix}-panel-editor`}
          role="tabpanel"
          aria-labelledby={`${prefix}-tab-editor`}
          hidden={mode !== "editor"}
          className="min-h-0 flex-1"
        >
          <div
            data-ps-editor-panel
            data-open={mode === "editor" && visible}
            aria-hidden={mode !== "editor" || !visible}
            inert={mode !== "editor" || !visible}
            className="h-full w-full"
          />
        </div>
        <div
          id={`${prefix}-panel-comments`}
          role="tabpanel"
          aria-labelledby={`${prefix}-tab-comments`}
          hidden={mode !== "comments"}
          className="min-h-0 flex-1"
        >
          {comments}
        </div>
      </div>
    </aside>
  )
}
