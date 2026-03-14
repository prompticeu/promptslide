interface AnnotationPinProps {
  number: number
  status: "open" | "resolved"
  xPercent: number
  yPercent: number
  isSelected: boolean
  onClick: () => void
}

export function AnnotationPin({ number, status, xPercent, yPercent, isSelected, onClick }: AnnotationPinProps) {
  const isResolved = status === "resolved"

  return (
    <button
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
      style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
      title={`Annotation #${number}`}
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-lg transition-colors ${
          isSelected
            ? "bg-blue-500 text-white ring-2 ring-blue-300 ring-offset-1 ring-offset-black"
            : isResolved
              ? "bg-neutral-600 text-neutral-300"
              : "bg-blue-500 text-white"
        }`}
      >
        {number}
      </div>
    </button>
  )
}
