import type { RefObject } from "react"

import { X } from "lucide-react"
import { useId, useRef } from "react"

import type { Job, Issue } from "./powerpoint-button"

import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog"
import { Disclosure, DisclosureTrigger, DisclosureContent } from "../ui/disclosure"
import { Select } from "../ui/select"

const issueLabels: Record<string, [string, string]> = {
  FONT_DOWNLOAD_FAILED: [
    "Web fonts did not load",
    "The export may use substitute fonts. Retry the export when the font source is available."
  ],
  STYLESHEET_DOWNLOAD_FAILED: [
    "Slide styling did not load",
    "Some styling could not be loaded. Retry the export before relying on its layout."
  ],
  FONT_UNAVAILABLE: [
    "Fonts could not be embedded",
    "Install the original fonts on the computer opening this file to keep the typography consistent."
  ],
  FONT_EMBEDDING_RESTRICTED: [
    "Font embedding is restricted",
    "These fonts require installation on the recipient’s computer."
  ],
  SVG_EFFECT_FALLBACK: [
    "Some effects are graphics",
    "Masked or filtered artwork keeps its appearance as an image."
  ],
  COMPLEX_COMPOSITION_FALLBACK: [
    "Some components are graphics",
    "Complex clipped layouts keep their appearance as images; their contents cannot be edited separately."
  ],
  SVG_TEXT_AFFINE_FALLBACK: [
    "Some transformed labels are graphics",
    "These labels keep their appearance as images rather than editable text."
  ],
  SVG_TEXT_OUTLINED: [
    "Some labels are outlined",
    "Letters are editable shapes rather than editable text."
  ],
  CLIPPED_PAINT_FALLBACK: [
    "Clipped edges are graphics",
    "Content inside clipped layouts remains editable. Partially visible elements are kept as images."
  ],
  SVG_PATTERN_MASK_APPROXIMATED: [
    "Dot patterns use native shapes",
    "Each dot is editable, with closely matched mask transparency."
  ],
  MULTIPLE_FONT_FALLBACK: [
    "Some symbols use fallback fonts",
    "Text using multiple fonts may have different spacing in PowerPoint."
  ],
  GRADIENT_INTERPOLATION_APPROXIMATED: [
    "Transparent gradients are approximated",
    "Gradients remain editable, with a closely matched color and transparency falloff."
  ],
  ELLIPTICAL_GRADIENT_APPROXIMATED: [
    "Elliptical glows use grouped shapes",
    "Glows remain editable. Some presentation apps may show seams between the shapes."
  ],
  SVG_GROUP_OPACITY_APPROXIMATED: [
    "Overlapping transparency may differ",
    "Transparency is applied to individual shapes, which can affect overlapping edges."
  ]
}

function groupIssues(issues: Issue[]) {
  const groups = new Map<string, { code: string; severity: string; issues: Issue[] }>()
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.code}`
    const group = groups.get(key) || { code: issue.code, severity: issue.severity, issues: [] }
    group.issues.push(issue)
    groups.set(key, group)
  }
  return [...groups.values()]
}

interface PowerPointDialogProps {
  open: boolean
  busy: boolean
  cancelling: boolean
  job: Job | null
  error: string
  hasRevealSteps: boolean
  hasDraft: boolean
  builds: string
  savedOnly: boolean
  onBuildsChange: (value: string) => void
  onSavedOnlyChange: (value: boolean) => void
  onClose: () => void
  onStart: () => void | Promise<void>
  onCancel: () => void | Promise<void>
  onReport: () => void | Promise<void>
  triggerRef: RefObject<HTMLDivElement | null>
}

export function PowerPointDialog({
  open,
  busy,
  cancelling,
  job,
  error,
  hasRevealSteps,
  hasDraft,
  builds,
  savedOnly,
  onBuildsChange: setBuilds,
  onSavedOnlyChange: setSavedOnly,
  onClose: close,
  onStart: start,
  onCancel: cancel,
  onReport: report,
  triggerRef: button
}: PowerPointDialogProps) {
  const dialog = useRef<HTMLDivElement>(null)
  const revealId = useId()
  const savedVersionId = useId()
  const status = cancelling
    ? "Cancelling export…"
    : job?.status === "rejected"
      ? "Export needs attention"
      : job?.status === "succeeded-with-issues"
        ? "PowerPoint exported"
        : job?.status === "succeeded"
          ? "PowerPoint exported"
          : job?.status === "failed"
            ? "Export failed"
            : job?.status === "cancelled"
              ? "Export cancelled"
              : busy
                ? "Exporting PowerPoint…"
                : "Export PowerPoint"
  const finished = !!job?.hasFile && !busy
  const issueGroups = groupIssues(job?.issues || [])
  const warnings = issueGroups.filter(group => group.severity !== "info")
  const information = issueGroups.filter(group => group.severity === "info")
  const progress = job?.progress
  const rendering = progress?.phase === "rendering"
  const progressLabel = rendering
    ? progress.completed < progress.total
      ? `Converting slide ${Math.min(progress.completed + 1, progress.total)} of ${progress.total}`
      : "Finishing your PowerPoint"
    : "Preparing your slides"
  const progressPercent = progress?.total
    ? Math.min(100, Math.max(0, (progress.completed / progress.total) * 100))
    : 0
  const description = busy
    ? "Converting your slides to PowerPoint."
    : finished
      ? "Your .pptx file is ready. The download has started."
      : "Keep text, shapes, and supported effects editable in PowerPoint."
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && !busy) close()
      }}
    >
      <DialogContent
        ref={dialog}
        initialFocus={dialog}
        finalFocus={() => button.current?.querySelector("button") ?? null}
        className="max-h-[90vh] max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#111111] p-0 text-neutral-100"
        style={{ outline: "none" }}
      >
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-lg font-semibold">{status}</DialogTitle>
            <Button
              variant="unstyled"
              type="button"
              aria-label="Close export"
              disabled={busy}
              onClick={close}
              className="-mr-1 -mt-1 rounded-lg p-2 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B35] disabled:opacity-30"
            >
              <X size={18} />
            </Button>
          </div>
          <DialogDescription className="mt-2 text-sm leading-relaxed text-neutral-400">
            {description}
          </DialogDescription>
        </div>
        <div className="px-6">
          {hasRevealSteps && !busy && !job ? (
            <Disclosure className="mt-5 rounded border border-neutral-800 p-3 text-sm">
              <DisclosureTrigger className="cursor-pointer font-medium">
                Animation options
              </DisclosureTrigger>
              <DisclosureContent>
                <p className="mt-2 text-neutral-400">
                  By default, each slide includes all revealed content.
                </p>
                <label htmlFor={revealId} className="mt-3 block">
                  Slide reveals
                  <Select
                    id={revealId}
                    aria-label="Slide reveals"
                    value={builds}
                    disabled={busy}
                    onChange={e => setBuilds(e.target.value)}
                    className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 p-2"
                  >
                    <option value="final">Show all content</option>
                    <option value="slides">One slide per reveal</option>
                    <option value="native">Animate reveals in PowerPoint</option>
                  </Select>
                </label>
              </DisclosureContent>
            </Disclosure>
          ) : null}
          {hasDraft && !busy && !job ? (
            <div className="mt-4 rounded border border-amber-700 p-3 text-sm">
              <p>There are unsaved editor changes.</p>
              <label htmlFor={savedVersionId} className="mt-2 flex items-center gap-2">
                <Checkbox
                  id={savedVersionId}
                  aria-label="Export the last saved version"
                  checked={savedOnly}
                  onCheckedChange={setSavedOnly}
                />
                Export the last saved version
              </label>
              <Button
                variant="unstyled"
                type="button"
                className="mt-2 underline"
                onClick={() => {
                  close()
                  window.dispatchEvent(
                    new CustomEvent("promptslide:editor-request", {
                      detail: { open: true }
                    })
                  )
                }}
              >
                Open editor to save changes
              </Button>
            </div>
          ) : null}
          <div role="status" aria-live="polite" className="sr-only">
            {busy ? progressLabel : status}
          </div>
          {busy ? (
            <div className="py-6">
              <div className="mb-3 flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-neutral-200">{progressLabel}</span>
                {rendering ? (
                  <span className="text-xs tabular-nums text-neutral-500">
                    {progress.completed} / {progress.total} ready
                  </span>
                ) : null}
              </div>
              <div
                role="progressbar"
                aria-label="Slide conversion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={rendering ? Math.round(progressPercent) : undefined}
                className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
              >
                <div
                  className={`h-full rounded-full bg-[#FF6B35] transition-[width] duration-500 ${!rendering ? "w-1/4 motion-safe:animate-pulse" : ""}`}
                  style={rendering ? { width: `${progressPercent}%` } : undefined}
                />
              </div>
              <p className="mt-3 text-xs text-neutral-500">
                Complex slides may take a little longer.
              </p>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          {!busy && warnings.length ? (
            <Disclosure
              className="mt-5 text-sm"
              open={
                job?.status === "failed" ||
                job?.status === "rejected" ||
                warnings.some(
                  group =>
                    group.code.startsWith("FONT_") || group.code === "STYLESHEET_DOWNLOAD_FAILED"
                ) ||
                undefined
              }
            >
              <DisclosureTrigger className="cursor-pointer text-neutral-300 marker:text-neutral-500 hover:text-white">
                <span className="ml-1">
                  {warnings.length} compatibility {warnings.length === 1 ? "note" : "notes"}
                </span>
              </DisclosureTrigger>
              <DisclosureContent>
                <ul className="mt-4 space-y-4 pl-4">
                  {warnings.map(group => {
                    const slides = [
                      ...new Set(group.issues.map(issue => issue.source?.slideId).filter(Boolean))
                    ]
                    const [title, detail] = issueLabels[group.code] || [
                      group.code.replace(/_/g, " ").toLowerCase(),
                      group.issues[0]?.message || "Compatibility details are unavailable."
                    ]
                    return (
                      <li key={`${group.severity}:${group.code}`}>
                        <p
                          className={`text-sm font-medium ${group.code.startsWith("FONT_") || group.severity === "error" ? "text-amber-200" : "text-neutral-200"}`}
                        >
                          {title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-400">{detail}</p>
                        <p className="mt-1.5 text-[11px] text-neutral-500">
                          {group.issues.length} {group.issues.length === 1 ? "element" : "elements"}
                          {slides.length
                            ? ` · ${slides.length} ${slides.length === 1 ? "slide" : "slides"}`
                            : ""}
                        </p>
                        {group.code.startsWith("FONT_") && issueLabels[group.code] ? (
                          <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                            {[...new Set(group.issues.map(issue => issue.message))].join(" ")}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </DisclosureContent>
            </Disclosure>
          ) : null}
          {!busy && information.length ? (
            <Disclosure className="my-4 text-xs text-neutral-500">
              <DisclosureTrigger className="cursor-pointer hover:text-neutral-300">
                Conversion details
              </DisclosureTrigger>
              <DisclosureContent>
                <ul className="mt-2 space-y-2 text-neutral-400">
                  {information.map(group => (
                    <li key={group.code}>
                      {group.issues[0]?.message || "Compatibility details are unavailable."}{" "}
                      <span className="text-neutral-500">({group.issues.length})</span>
                    </li>
                  ))}
                </ul>
              </DisclosureContent>
            </Disclosure>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 px-6 pb-6 pt-5">
          {job && !busy && job.status !== "cancelled" ? (
            <Button
              variant="unstyled"
              type="button"
              onClick={() => void report()}
              className="rounded-lg px-3 py-2 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B35]"
            >
              Download report
            </Button>
          ) : null}
          {busy ? (
            <Button
              variant="unstyled"
              type="button"
              disabled={cancelling}
              onClick={() => void cancel()}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B35]"
            >
              {cancelling ? "Cancelling…" : "Cancel export"}
            </Button>
          ) : (
            <Button
              variant="unstyled"
              type="button"
              disabled={hasDraft && !savedOnly}
              onClick={() => void start()}
              className={
                finished
                  ? "rounded-lg px-3 py-2 text-xs text-neutral-400 hover:bg-white/5 hover:text-white"
                  : "rounded-lg bg-[#FF6B35] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#ff824f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B35] disabled:opacity-40"
              }
            >
              {job ? "Export again" : "Export .pptx"}
            </Button>
          )}
          {finished ? (
            <Button
              variant="unstyled"
              type="button"
              onClick={close}
              className="rounded-lg bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#ff824f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B35]"
            >
              Done
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
