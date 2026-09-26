import { Check, Pencil, PanelRightClose, RotateCcw, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { Annotation } from "./types"

interface AnnotationPanelProps {
  annotations: Annotation[]
  unlinkedAnnotations?: Annotation[]
  selectedId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: Partial<Pick<Annotation, "body" | "status">>) => void
  onClose: () => void
}

export function AnnotationPanel({
  annotations,
  unlinkedAnnotations = [],
  selectedId,
  onSelect,
  onHover,
  onDelete,
  onUpdate,
  onClose
}: AnnotationPanelProps) {
  const open = annotations.filter(a => a.status === "open")
  const resolved = annotations.filter(a => a.status === "resolved")
  const total = annotations.length + unlinkedAnnotations.length
  const numberFor = (annotation: Annotation) =>
    annotations.findIndex(a => a.id === annotation.id) + 1

  return (
    <div className="flex h-full w-80 max-w-[90vw] flex-shrink-0 flex-col border-l border-neutral-800 bg-neutral-950 text-white">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <button
          onClick={onClose}
          className="rounded p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          aria-label="Hide comments"
          title="Hide comments (C)"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
        <span className="text-right text-sm font-semibold">Comments ({total})</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {annotations.length === 0 && unlinkedAnnotations.length === 0 && (
          <div className="flex flex-col gap-4 px-3 py-6">
            <WorkflowHint />
          </div>
        )}

        {open.length > 0 && (
          <div>
            <div className="mb-1.5 px-2 pt-1 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
              Open
            </div>
            {open.map(a => (
              <AnnotationItem
                key={a.id}
                annotation={a}
                number={numberFor(a)}
                isSelected={a.id === selectedId}
                onSelect={() => onSelect(a.id)}
                onHover={hovered => onHover(hovered ? a.id : null)}
                onDelete={() => onDelete(a.id)}
                onUpdate={patch => onUpdate(a.id, patch)}
              />
            ))}
          </div>
        )}

        {resolved.length > 0 && (
          <div className={open.length > 0 ? "mt-3" : ""}>
            <div className="mb-1.5 px-2 pt-1 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
              Resolved
            </div>
            {resolved.map(a => (
              <AnnotationItem
                key={a.id}
                annotation={a}
                number={numberFor(a)}
                isSelected={a.id === selectedId}
                onSelect={() => onSelect(a.id)}
                onHover={hovered => onHover(hovered ? a.id : null)}
                onDelete={() => onDelete(a.id)}
                onUpdate={patch => onUpdate(a.id, patch)}
              />
            ))}
          </div>
        )}
        {unlinkedAnnotations.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 px-2 pt-1 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
              Removed slides
            </div>
            {unlinkedAnnotations.map((a, i) => (
              <div key={a.id}>
                <p className="px-2 text-[11px] text-neutral-500">{a.slideTitle || a.slideId}</p>
                <AnnotationItem
                  annotation={a}
                  number={i + 1}
                  isSelected={a.id === selectedId}
                  onSelect={() => onSelect(a.id)}
                  onHover={hovered => onHover(hovered ? a.id : null)}
                  onDelete={() => onDelete(a.id)}
                  onUpdate={patch => onUpdate(a.id, patch)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {annotations.length + unlinkedAnnotations.length > 0 && (
        <>
          <div className="border-t border-neutral-800" />
          <div className="px-3 py-3">
            <WorkflowHint />
          </div>
        </>
      )}
    </div>
  )
}

function WorkflowHint() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">Workflow</p>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/15 text-[10px] font-semibold text-[#FF6B35]">
          1
        </div>
        <p className="text-[12px] leading-snug text-neutral-400">
          Comment on everything you want to fix
        </p>
      </div>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/15 text-[10px] font-semibold text-[#FF6B35]">
          2
        </div>
        <p className="text-[12px] leading-snug text-neutral-400">Switch to your coding agent</p>
      </div>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/15 text-[10px] font-semibold text-[#FF6B35]">
          3
        </div>
        <p className="text-[12px] leading-snug text-neutral-400">"Fix open comments"</p>
      </div>
    </div>
  )
}

function AnnotationItem({
  annotation,
  number,
  isSelected,
  onSelect,
  onHover,
  onDelete,
  onUpdate
}: {
  annotation: Annotation
  number: number
  isSelected: boolean
  onSelect: () => void
  onHover: (hovered: boolean) => void
  onDelete: () => void
  onUpdate: (patch: Partial<Pick<Annotation, "body" | "status">>) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(annotation.body)
  const editRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (isEditing) editRef.current?.focus()
  }, [isEditing])
  const saveEdit = () => {
    const body = draft.trim()
    if (!body) return
    if (body !== annotation.body) onUpdate({ body })
    setIsEditing(false)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onKeyDown={e => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) onSelect()
      }}
      className={`group relative mb-0.5 cursor-pointer rounded-xl p-2.5 transition-all duration-150 ${
        isSelected ? "bg-[#FF6B35]/10 ring-1 ring-[#FF6B35]/20" : "hover:bg-white/[0.04]"
      }`}
    >
      <div className="absolute top-2 right-2 z-10 flex gap-0.5 rounded-full border border-neutral-700 bg-neutral-900/70 p-0.5 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          title="Edit comment"
          aria-label="Edit comment"
          onClick={e => {
            e.stopPropagation()
            setDraft(annotation.body)
            setIsEditing(true)
          }}
          className="rounded-full p-1 text-neutral-400 hover:bg-white/[0.08] hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title={annotation.status === "open" ? "Resolve comment" : "Reopen comment"}
          aria-label={annotation.status === "open" ? "Resolve comment" : "Reopen comment"}
          onClick={e => {
            e.stopPropagation()
            onHover(false)
            onUpdate({ status: annotation.status === "open" ? "resolved" : "open" })
          }}
          className="rounded-full p-1 text-neutral-400 hover:bg-white/[0.08] hover:text-white"
        >
          {annotation.status === "open" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          title="Delete comment"
          aria-label="Delete comment"
          onClick={e => {
            e.stopPropagation()
            onDelete()
          }}
          className="rounded-full p-1 text-neutral-400 hover:bg-white/[0.08] hover:text-white"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
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
        <div className="min-w-0 flex-1 pr-4">
          {isEditing ? (
            <div>
              <textarea
                ref={editRef}
                value={draft}
                onClick={e => e.stopPropagation()}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") setIsEditing(false)
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveEdit()
                }}
                className="w-full resize-y rounded border border-neutral-700 bg-neutral-900 p-2 text-[13px] text-white outline-none focus:border-[#FF6B35]"
                rows={3}
                maxLength={4096}
              />
              <div className="mt-1 flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    saveEdit()
                  }}
                  disabled={!draft.trim()}
                  className="text-[#FF6B35] disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    setIsEditing(false)
                  }}
                  className="text-neutral-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed text-neutral-200">{annotation.body}</p>
          )}
          {annotation.target.contentNearPin && (
            <p className="mt-1 truncate text-[11px] text-neutral-600">
              {annotation.target.contentNearPin}
            </p>
          )}
          {annotation.resolution && (
            <p className="mt-1.5 text-[11px] text-emerald-400/80 italic">{annotation.resolution}</p>
          )}
        </div>
      </div>
    </div>
  )
}
