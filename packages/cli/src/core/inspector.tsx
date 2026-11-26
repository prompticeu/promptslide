import { X } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { Button } from "./ui/button"
import { TabsRoot, TabsList, TabsTrigger, TabsPanel } from "./ui/tabs"
import { cn } from "./utils"
export type InspectorMode = "slide" | "editor" | "comments"
/** Stable, controlled panels let the source editor veto navigation with unsaved drafts. */
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
  const [visited, setVisited] = useState<Set<InspectorMode>>(() => new Set())
  useEffect(() => {
    if (mode) setVisited(previous => (previous.has(mode) ? previous : new Set([...previous, mode])))
  }, [mode])
  const tabs = [
    { id: "slide", label: "Slide" },
    ...(editorAvailable ? [{ id: "editor", label: "Elements" }] : []),
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
    >
      <TabsRoot
        value={mode ?? ""}
        onValueChange={next => {
          if (next === "slide" || next === "editor" || next === "comments") onSelect(next)
        }}
        className="flex h-full min-h-0 w-full flex-col border-l border-neutral-800"
      >
        <div
          data-ps-inspector-header
          className="flex shrink-0 items-center gap-1 border-b border-neutral-800 px-2 py-2"
        >
          <TabsList
            aria-label="Inspector sections"
            activateOnFocus={false}
            className="min-w-0 flex-1"
          >
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button size="icon" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
            <X size={16} />
          </Button>
        </div>
        <TabsPanel value="slide" keepMounted className="min-h-0 flex-1">
          {visited.has("slide") && slideSettings}
        </TabsPanel>
        <TabsPanel value="editor" keepMounted className="min-h-0 flex-1">
          <div
            data-ps-editor-panel
            data-open={mode === "editor" && visible}
            aria-hidden={mode !== "editor" || !visible}
            inert={mode !== "editor" || !visible}
            className="h-full w-full"
          />
        </TabsPanel>
        <TabsPanel value="comments" keepMounted className="min-h-0 flex-1">
          {visited.has("comments") && comments}
        </TabsPanel>
      </TabsRoot>
    </aside>
  )
}
