import { Check, Download, Play, RotateCcw } from "lucide-react"
import { useId, useState } from "react"

import type { LoopConfig, SlideConfig } from "../types"

import {
  includedSlides,
  loopDuration,
  loopSlideKey,
  stateDuration,
  validateLoopConfig
} from "./config.mjs"

const button =
  "rounded-md border border-neutral-700 px-2.5 py-2 text-xs hover:bg-neutral-800 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-orange-500"

function DurationInput({
  value,
  label,
  onCommit,
  onFocus,
  id
}: {
  value: number
  label: string
  onCommit: (value: number) => void
  onFocus?: () => void
  id?: string
}) {
  return (
    <span className="inline-flex w-20 shrink-0 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 focus-within:border-orange-500 focus-within:outline-2 focus-within:outline-orange-500/30">
      <input
        key={value}
        id={id}
        aria-label={label}
        className="min-w-0 w-full bg-transparent py-2 text-right text-sm tabular-nums text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        style={{ colorScheme: "dark" }}
        type="number"
        min="0.1"
        max="3600"
        step="0.1"
        defaultValue={value}
        onFocus={onFocus}
        onBlur={event => {
          const next = event.target.valueAsNumber
          if (Number.isFinite(next) && next >= 0.1 && next <= 3600) {
            if (next !== value) onCommit(next)
          } else event.target.value = String(value)
        }}
      />
      <span aria-hidden="true" className="text-xs text-neutral-500">
        s
      </span>
    </span>
  )
}

/** Slide-specific settings follow the viewer's current slide and animation step. */
export function LoopSettings({
  slides,
  currentSlide,
  animationStep,
  config,
  onChange,
  onStepChange,
  onSave,
  onStart,
  onRevert,
  dirty
}: {
  slides: SlideConfig[]
  currentSlide: number
  animationStep: number
  config: LoopConfig
  onChange: (config: LoopConfig) => void
  onStepChange: (step: number) => void
  onSave: (config: LoopConfig) => Promise<string>
  onStart: (config: LoopConfig) => void
  onRevert: () => void
  dirty: boolean
}) {
  const defaultDurationId = useId()
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const slide = slides[currentSlide]
  const key = slide ? loopSlideKey(slide, currentSlide) : ""
  const settings = config.slides[key]
  const changedSteps = settings?.steps !== undefined && settings.steps !== slide?.steps
  const updateDuration = (step: number, value: number | null) => {
    if (!slide) return
    const dwell = Array.from({ length: slide.steps + 1 }, (_, i) => settings?.dwell?.[i] ?? null)
    dwell[step] = value
    onChange({
      ...config,
      slides: { ...config.slides, [key]: { ...settings, steps: slide.steps, dwell } }
    })
  }
  const save = async () => {
    setSaving(true)
    try {
      setMessage(await onSave(validateLoopConfig(config)))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save loop settings")
    } finally {
      setSaving(false)
    }
  }
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(config, null, 2) + "\n"], { type: "application/json" })
    )
    const a = document.createElement("a")
    a.href = url
    a.download = "loop-config.json"
    a.click()
    URL.revokeObjectURL(url)
    setMessage(
      "Place loop-config.json in the project folder to include these settings in builds and publishing."
    )
  }
  return (
    <section
      aria-label="Slide settings"
      className="flex h-full min-h-0 flex-col text-sm text-white"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {slide && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Slide {currentSlide + 1}
            </p>
            <h2 className="mt-1 truncate text-base font-semibold">
              {slide.title || slide.id || `Slide ${currentSlide + 1}`}
            </h2>
            <p className="mt-1 text-xs text-neutral-400">
              Select slides in the thumbnail rail. Select a state below to preview it on the canvas.
            </p>
            <label className="mt-5 flex items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              Include in loop
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                <input
                  aria-label="Include current slide in loop"
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-neutral-600 bg-neutral-950 transition-colors checked:border-orange-500 checked:bg-orange-500 hover:border-neutral-400 checked:hover:border-orange-400 checked:hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                  type="checkbox"
                  checked={!settings?.excluded}
                  onChange={event =>
                    onChange({
                      ...config,
                      slides: {
                        ...config.slides,
                        [key]: { ...settings, excluded: !event.target.checked }
                      }
                    })
                  }
                />
                <Check
                  aria-hidden="true"
                  size={14}
                  strokeWidth={3}
                  className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100"
                />
              </span>
            </label>
            <h3 className="mb-2 mt-4 text-xs font-semibold text-neutral-300">
              State timings <span className="font-normal text-neutral-500">· seconds</span>
            </h3>
            {changedSteps && (
              <p role="status" className="mb-3 text-xs text-amber-300">
                This slide's step count changed. Review its timings; new states use the default.
              </p>
            )}
            <div className="space-y-1.5" aria-label="Slide states">
              {Array.from({ length: slide.steps + 1 }, (_, step) => {
                const label = step === 0 ? "Initial view" : `Step ${step}`
                const inherited = settings?.dwell?.[step] == null
                return (
                  <div
                    key={`${key}:${step}`}
                    className={`flex items-center gap-1 rounded-md border p-1 ${animationStep === step ? "border-orange-500/50 bg-orange-500/5" : "border-transparent"}`}
                  >
                    <button
                      aria-label={label}
                      aria-pressed={animationStep === step}
                      className="min-w-0 flex-1 rounded px-1 py-1.5 text-left text-xs hover:bg-neutral-800"
                      onClick={() => onStepChange(step)}
                    >
                      {label}
                      <span className="mt-0.5 block text-[10px] text-neutral-500">
                        {inherited ? "Default duration" : "Custom duration"}
                      </span>
                    </button>
                    <DurationInput
                      value={stateDuration(config, slide, currentSlide, step)}
                      label={`${label} duration in seconds`}
                      onFocus={() => onStepChange(step)}
                      onCommit={value => updateDuration(step, value)}
                    />
                    <button
                      className="rounded p-1 text-neutral-500 hover:text-white disabled:opacity-30"
                      disabled={inherited}
                      aria-label={`Use default for ${label.toLowerCase()}`}
                      title="Use default duration"
                      onClick={() => updateDuration(step, null)}
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-neutral-500">
              Durations include reveal animations. Allow enough time for videos and animations that
              play by themselves.
            </p>
            <button
              className={`${button} mt-3 w-full`}
              onClick={() => {
                const rest = { ...settings }
                delete rest.dwell
                delete rest.steps
                onChange({ ...config, slides: { ...config.slides, [key]: rest } })
              }}
            >
              Use default for this slide
            </button>
          </>
        )}
        <details className="mt-5 border-t border-neutral-800 pt-4" open>
          <summary className="cursor-pointer text-xs font-semibold text-neutral-300">
            Loop defaults
          </summary>
          <label
            htmlFor={defaultDurationId}
            className="mt-3 flex items-center justify-between gap-2 text-xs text-neutral-400"
          >
            Seconds per state
            <DurationInput
              id={defaultDurationId}
              value={config.defaultDuration}
              label="Default duration in seconds"
              onCommit={value => onChange({ ...config, defaultDuration: value })}
            />
          </label>
          <p className="mt-3 text-xs text-neutral-500">
            {includedSlides(config, slides).length} slides ·{" "}
            {loopDuration(config, slides).toFixed(1)}s + slide transitions
          </p>
        </details>
      </div>
      <footer className="shrink-0 space-y-2 border-t border-neutral-800 p-3">
        <p role="status" className="text-xs text-neutral-400">
          {dirty ? "Unsaved loop settings" : message || "Loop settings saved"}
        </p>
        <div className="flex gap-2">
          <button
            className={`${button} flex-1`}
            disabled={!dirty || saving}
            onClick={() => {
              onRevert()
              setMessage("")
            }}
          >
            Revert
          </button>
          <button
            className={`${button} flex-1 border-orange-500/50 text-orange-400`}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            className={`${button} flex items-center justify-center gap-1.5`}
            aria-label="Download loop settings"
            onClick={download}
          >
            <Download size={14} />
          </button>
          <button
            className={`${button} flex flex-1 items-center justify-center gap-1.5`}
            disabled={!includedSlides(config, slides).length || saving}
            onClick={() => onStart(validateLoopConfig(config))}
          >
            <Play size={14} /> Start loop
          </button>
        </div>
      </footer>
    </section>
  )
}
