import { MessageCircle, Trash2, X } from "lucide-react"
import type { Annotation } from "./types"

interface AnnotationPanelProps {
  annotations: Annotation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function AnnotationPanel({ annotations, selectedId, onSelect, onDelete, onClose }: AnnotationPanelProps) {
  const open = annotations.filter(a => a.status === "open")
  const resolved = annotations.filter(a => a.status === "resolved")

  return (
    <div className="absolute top-0 right-0 z-50 flex h-full w-72 flex-col border-l border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Annotations</span>
          {open.length > 0 && (
            <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">
              {open.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {annotations.length === 0 && (
          <div className="p-4 text-center text-sm text-neutral-600">
            Click on slide elements to add annotations
          </div>
        )}

        {open.length > 0 && (
          <div className="p-2">
            <div className="mb-1 px-2 text-xs font-medium tracking-wider text-neutral-500 uppercase">Open</div>
            {open.map((a, i) => (
              <AnnotationItem
                key={a.id}
                annotation={a}
                number={i + 1}
                isSelected={a.id === selectedId}
                onSelect={() => onSelect(a.id)}
                onDelete={() => onDelete(a.id)}
              />
            ))}
          </div>
        )}

        {resolved.length > 0 && (
          <div className="p-2">
            <div className="mb-1 px-2 text-xs font-medium tracking-wider text-neutral-500 uppercase">Resolved</div>
            {resolved.map((a, i) => (
              <AnnotationItem
                key={a.id}
                annotation={a}
                number={open.length + i + 1}
                isSelected={a.id === selectedId}
                onSelect={() => onSelect(a.id)}
                onDelete={() => onDelete(a.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AnnotationItem({
  annotation,
  number,
  isSelected,
  onSelect,
  onDelete
}: {
  annotation: Annotation
  number: number
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={`group mb-1 cursor-pointer rounded-lg p-2 transition-colors ${
        isSelected ? "bg-neutral-800" : "hover:bg-neutral-900"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div
            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              annotation.status === "open"
                ? "bg-blue-500 text-white"
                : "bg-neutral-600 text-neutral-300"
            }`}
          >
            {number}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-neutral-200 leading-snug">{annotation.body}</p>
            {annotation.target.contentNearPin && (
              <p className="mt-0.5 truncate text-xs text-neutral-600">
                {annotation.target.contentNearPin}
              </p>
            )}
            {annotation.resolution && (
              <p className="mt-1 text-xs text-green-400/80 italic">
                {annotation.resolution}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={e => {
            e.stopPropagation()
            onDelete()
          }}
          className="flex-shrink-0 rounded p-1 text-neutral-600 opacity-0 transition-opacity hover:bg-neutral-700 hover:text-neutral-300 group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
