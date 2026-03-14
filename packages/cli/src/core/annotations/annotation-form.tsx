import { useEffect, useRef, useState } from "react"
import { Send, X } from "lucide-react"

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
      className="absolute z-40 w-64 rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-2xl"
      style={{ left, right, top, bottom }}
      onClick={e => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400">Add annotation</span>
        <button
          onClick={onCancel}
          className="rounded p-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe the change you want..."
        className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-blue-500"
        rows={3}
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600"
        >
          <Send className="h-3 w-3" />
          Send
        </button>
      </div>
    </div>
  )
}
