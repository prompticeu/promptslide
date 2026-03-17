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
    <div className="flex h-full w-80 flex-shrink-0 flex-col border-l border-white/[0.06] bg-neutral-950/95 backdrop-blur-2xl">
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FF6B35]/15">
            <MessageCircle className="h-3.5 w-3.5 text-[#FF6B35]" />
          </div>
          <span className="text-sm font-medium text-white">Annotations</span>
          {open.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF6B35]/15 px-1.5 text-[11px] font-semibold text-[#FF6B35]">
              {open.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-neutral-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="flex-1 overflow-y-auto p-2">
        {annotations.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04]">
              <MessageCircle className="h-5 w-5 text-neutral-600" />
            </div>
            <p className="text-sm text-neutral-500">Click on slide elements to add annotations</p>
          </div>
        )}

        {open.length > 0 && (
          <div>
            <div className="mb-1.5 px-2 pt-1 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
              Open
            </div>
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
          <div className={open.length > 0 ? "mt-3" : ""}>
            <div className="mb-1.5 px-2 pt-1 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
              Resolved
            </div>
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
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect() }}
      className={`group relative mb-0.5 cursor-pointer rounded-xl p-2.5 transition-all duration-150 ${
        isSelected
          ? "bg-[#FF6B35]/10 ring-1 ring-[#FF6B35]/20"
          : "hover:bg-white/[0.04]"
      }`}
    >
      <button
        onClick={e => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute top-2 right-2 rounded-lg p-1 text-neutral-600 opacity-0 transition-all hover:bg-white/[0.08] hover:text-neutral-300 group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
            annotation.status === "open"
              ? "bg-[#FF6B35] text-white"
              : "bg-neutral-700 text-neutral-400"
          }`}
        >
          {number}
        </div>
        <div className="min-w-0 pr-4">
          <p className="text-[13px] leading-relaxed text-neutral-200">{annotation.body}</p>
          {annotation.target.contentNearPin && (
            <p className="mt-1 truncate text-[11px] text-neutral-600">
              {annotation.target.contentNearPin}
            </p>
          )}
          {annotation.resolution && (
            <p className="mt-1.5 text-[11px] text-emerald-400/80 italic">
              {annotation.resolution}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
