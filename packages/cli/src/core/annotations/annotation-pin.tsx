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
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-110"
      style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
      title={`Annotation #${number}`}
    >
      {/* Glow ring */}
      {isSelected && !isResolved && (
        <div className="absolute inset-[-4px] animate-pulse rounded-full bg-[#FF6B35]/25 blur-sm" />
      )}
      <div
        className={`relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold shadow-lg backdrop-blur-sm transition-all duration-200 ${
          isSelected
            ? isResolved
              ? "bg-neutral-500/90 text-white ring-2 ring-neutral-400/50"
              : "bg-[#FF6B35] text-white ring-2 ring-[#FF6B35]/40 ring-offset-1 ring-offset-black/50"
            : isResolved
              ? "bg-neutral-700/80 text-neutral-400"
              : "bg-[#FF6B35]/90 text-white hover:bg-[#FF6B35]"
        }`}
      >
        {number}
      </div>
    </button>
  )
}
