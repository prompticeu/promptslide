import { useEffect, useRef, useState } from "react"
import { ArrowUp, X } from "lucide-react"

interface AnnotationFormProps {
  xPercent: number
  yPercent: number
  onSubmit: (text: string) => void
  onCancel: () => void
}

export function AnnotationForm({ xPercent, yPercent, onSubmit, onCancel }: AnnotationFormProps) {
  const [text, setText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === "Escape") {
      onCancel()
    }
    e.stopPropagation()
  }

  // Position the form, flipping if near edges
  const left = xPercent > 70 ? undefined : `${xPercent}%`
  const right = xPercent > 70 ? `${100 - xPercent}%` : undefined
  const top = yPercent > 70 ? undefined : `${yPercent}%`
  const bottom = yPercent > 70 ? `${100 - yPercent}%` : undefined

  return (
    <div
      className="absolute z-40 w-72 overflow-hidden rounded-xl border border-white/[0.08] bg-neutral-900/95 shadow-2xl backdrop-blur-2xl"
      style={{ left, right, top, bottom }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
        <span className="text-xs font-medium tracking-wide text-neutral-400">Add annotation</span>
        <button
          onClick={onCancel}
          className="rounded-lg p-1 text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-neutral-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the change you want..."
          className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none transition-colors focus:border-[#FF6B35]/50 focus:bg-white/[0.06]"
          rows={3}
        />
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[11px] text-neutral-600">Enter to send</span>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF6B35] text-white shadow-lg shadow-[#FF6B35]/20 transition-all hover:bg-[#FF7A4A] hover:shadow-[#FF6B35]/30 disabled:opacity-30 disabled:shadow-none disabled:hover:bg-[#FF6B35]"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
